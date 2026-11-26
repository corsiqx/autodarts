import {
  BadGatewayException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { Prisma } from '../../generated/postgres-prisma';
import {
  AutodartsAuthClient,
  AutodartsAuthError,
  AutodartsTokens,
} from '../autodarts/autodarts-auth.client';
import { CredentialsCipherService } from '../crypto/credentials-cipher.service';
import { PostgresPrismaService } from '../postgres-prisma/postgres-prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

/** Public shape of a user. Never expose email or password data to the user list. */
export type UserSummary = { id: string; name: string };

export interface LoginResult {
  user: UserSummary;
  autodarts: { userId: string; username: string | null; expiresAt: string };
}

/** Reuse a stored access token only if it is valid for at least this long. */
const ACCESS_TOKEN_MIN_REMAINING_MS = 60_000;

const summarySelect = { id: true, name: true } satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  /** One login per user at a time: refresh tokens rotate, parallel refreshes would invalidate each other. */
  private readonly loginsInFlight = new Map<string, Promise<LoginResult>>();

  constructor(
    private readonly prisma: PostgresPrismaService,
    private readonly autodarts: AutodartsAuthClient,
    private readonly cipher: CredentialsCipherService,
  ) {}

  findAll(): Promise<UserSummary[]> {
    return this.prisma.user.findMany({
      select: summarySelect,
      orderBy: { name: 'asc' },
    });
  }

  /** Checks the credentials against Autodarts first, so only working accounts are stored. */
  async create(dto: CreateUserDto): Promise<LoginResult> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });
    if (existing) {
      throw this.emailTaken();
    }

    const tokens = await this.autodartsCall(() =>
      this.autodarts.login(dto.email, dto.password),
    );
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });

    try {
      const user = await this.prisma.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          passwordHash,
          passwordEncrypted: this.cipher.encrypt(dto.password),
          autodartsSession: { create: this.sessionData(tokens) },
        },
        select: summarySelect,
      });
      return this.toResult(user, tokens);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw this.emailTaken();
      }
      throw error;
    }
  }

  login(userId: string): Promise<LoginResult> {
    const running = this.loginsInFlight.get(userId);
    if (running) {
      return running;
    }
    const login = this.performLogin(userId).finally(() =>
      this.loginsInFlight.delete(userId),
    );
    this.loginsInFlight.set(userId, login);
    return login;
  }

  /** Valid access token, else refresh token, else email and stored password. */
  private async performLogin(userId: string): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...summarySelect,
        email: true,
        passwordEncrypted: true,
        autodartsSession: true,
      },
    });
    if (!user) {
      throw new NotFoundException({
        code: 'user_not_found',
        message: 'Account nicht gefunden.',
      });
    }

    const summary = { id: user.id, name: user.name };
    const session = user.autodartsSession;

    if (
      session &&
      session.accessTokenExpiresAt.getTime() - Date.now() >
        ACCESS_TOKEN_MIN_REMAINING_MS
    ) {
      await this.prisma.autodartsSession.update({
        where: { userId },
        data: { lastLoginAt: new Date() },
      });
      return this.toResult(summary, {
        userId: session.autodartsUserId,
        username: session.autodartsUsername,
        expiresAt: session.accessTokenExpiresAt,
      });
    }

    if (session?.refreshTokenEncrypted) {
      try {
        const tokens = await this.autodarts.refresh(
          this.cipher.decrypt(session.refreshTokenEncrypted),
        );
        await this.saveSession(userId, tokens);
        return this.toResult(summary, tokens);
      } catch (error) {
        if (
          error instanceof AutodartsAuthError &&
          error.code === 'unavailable'
        ) {
          throw this.toHttpError(error);
        }
        this.logger.log(
          `Refresh for user ${userId} failed, falling back to password login`,
        );
      }
    }

    if (!user.passwordEncrypted) {
      throw new ConflictException({
        code: 'credentials_missing',
        message:
          'Für diesen Account ist kein Autodarts-Passwort hinterlegt. Lege ihn neu an.',
      });
    }

    const tokens = await this.autodartsCall(() =>
      this.autodarts.login(
        user.email,
        this.cipher.decrypt(user.passwordEncrypted!),
      ),
    );
    await this.saveSession(userId, tokens);
    return this.toResult(summary, tokens);
  }

  private async saveSession(
    userId: string,
    tokens: AutodartsTokens,
  ): Promise<void> {
    const data = { ...this.sessionData(tokens), lastLoginAt: new Date() };
    await this.prisma.autodartsSession.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  }

  private sessionData(tokens: AutodartsTokens) {
    return {
      autodartsUserId: tokens.userId,
      autodartsUsername: tokens.username,
      accessTokenEncrypted: this.cipher.encrypt(tokens.accessToken),
      accessTokenExpiresAt: tokens.expiresAt,
      refreshTokenEncrypted: tokens.refreshToken
        ? this.cipher.encrypt(tokens.refreshToken)
        : null,
    };
  }

  private toResult(
    user: UserSummary,
    tokens: Pick<AutodartsTokens, 'userId' | 'username' | 'expiresAt'>,
  ): LoginResult {
    return {
      user,
      autodarts: {
        userId: tokens.userId,
        username: tokens.username,
        expiresAt: tokens.expiresAt.toISOString(),
      },
    };
  }

  private async autodartsCall<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
      if (error instanceof AutodartsAuthError) {
        throw this.toHttpError(error);
      }
      throw error;
    }
  }

  private toHttpError(error: AutodartsAuthError): HttpException {
    switch (error.code) {
      case 'invalid_credentials':
      case 'invalid_token':
        return new UnprocessableEntityException({
          code: 'autodarts_invalid_credentials',
          message: 'Autodarts hat E-Mail oder Passwort abgelehnt.',
        });
      case 'consent_required':
        return new ForbiddenException({
          code: 'autodarts_consent_required',
          message:
            'Bitte akzeptiere zuerst die neuen Bedingungen auf play.autodarts.com.',
        });
      default:
        return new BadGatewayException({
          code: 'autodarts_unavailable',
          message: 'Autodarts ist gerade nicht erreichbar.',
        });
    }
  }

  private emailTaken(): ConflictException {
    return new ConflictException({
      code: 'email_taken',
      message: 'Diese E-Mail ist bereits registriert.',
    });
  }
}
