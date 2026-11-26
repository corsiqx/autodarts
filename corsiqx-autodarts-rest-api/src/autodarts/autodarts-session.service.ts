import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CredentialsCipherService } from '../crypto/credentials-cipher.service';
import { PostgresPrismaService } from '../postgres-prisma/postgres-prisma.service';
import {
  AutodartsAuthClient,
  AutodartsAuthError,
  AutodartsTokens,
} from './autodarts-auth.client';
import {
  autodartsAuthHttpError,
  withAutodartsAuthErrors,
} from './autodarts-errors';

/** Reuse a stored access token only if it is valid for at least this long. */
const ACCESS_TOKEN_MIN_REMAINING_MS = 60_000;

export interface ActiveSession {
  user: { id: string; name: string };
  autodartsUserId: string;
  autodartsUsername: string | null;
  accessToken: string;
  expiresAt: Date;
}

/**
 * Keeps a working Autodarts access token per stored account:
 * valid token, else refresh token, else email and stored password.
 */
@Injectable()
export class AutodartsSessionService {
  private readonly logger = new Logger(AutodartsSessionService.name);
  /** One renewal per user at a time: refresh tokens rotate, parallel refreshes would invalidate each other. */
  private readonly inFlight = new Map<string, Promise<ActiveSession>>();

  constructor(
    private readonly prisma: PostgresPrismaService,
    private readonly auth: AutodartsAuthClient,
    private readonly cipher: CredentialsCipherService,
  ) {}

  /** `forceRenew` skips the stored access token, e.g. after Autodarts answered 401 to it. */
  ensure(userId: string, forceRenew = false): Promise<ActiveSession> {
    const running = this.inFlight.get(userId);
    if (running) {
      return running;
    }
    const session = this.resolve(userId, forceRenew).finally(() =>
      this.inFlight.delete(userId),
    );
    this.inFlight.set(userId, session);
    return session;
  }

  /** Stores tokens of a fresh login (used when an account is created). */
  sessionData(tokens: AutodartsTokens) {
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

  private async resolve(
    userId: string,
    forceRenew: boolean,
  ): Promise<ActiveSession> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
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
    const stored = user.autodartsSession;

    if (
      stored &&
      !forceRenew &&
      stored.accessTokenExpiresAt.getTime() - Date.now() >
        ACCESS_TOKEN_MIN_REMAINING_MS
    ) {
      return {
        user: summary,
        autodartsUserId: stored.autodartsUserId,
        autodartsUsername: stored.autodartsUsername,
        accessToken: this.cipher.decrypt(stored.accessTokenEncrypted),
        expiresAt: stored.accessTokenExpiresAt,
      };
    }

    if (stored?.refreshTokenEncrypted) {
      try {
        const tokens = await this.auth.refresh(
          this.cipher.decrypt(stored.refreshTokenEncrypted),
        );
        return this.save(summary, tokens);
      } catch (error) {
        if (
          error instanceof AutodartsAuthError &&
          error.code === 'unavailable'
        ) {
          throw autodartsAuthHttpError(error);
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

    const encrypted = user.passwordEncrypted;
    const tokens = await withAutodartsAuthErrors(() =>
      this.auth.login(user.email, this.cipher.decrypt(encrypted)),
    );
    return this.save(summary, tokens);
  }

  private async save(
    user: ActiveSession['user'],
    tokens: AutodartsTokens,
  ): Promise<ActiveSession> {
    const data = { ...this.sessionData(tokens), lastLoginAt: new Date() };
    await this.prisma.autodartsSession.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...data },
      update: data,
    });
    return {
      user,
      autodartsUserId: tokens.userId,
      autodartsUsername: tokens.username,
      accessToken: tokens.accessToken,
      expiresAt: tokens.expiresAt,
    };
  }
}
