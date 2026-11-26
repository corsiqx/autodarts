import { ConflictException, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { Prisma } from '../../generated/postgres-prisma';
import { AutodartsAuthClient } from '../autodarts/autodarts-auth.client';
import { withAutodartsAuthErrors } from '../autodarts/autodarts-errors';
import { AutodartsSessionService } from '../autodarts/autodarts-session.service';
import { CredentialsCipherService } from '../crypto/credentials-cipher.service';
import { PostgresPrismaService } from '../postgres-prisma/postgres-prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

/** Public shape of a user. Never expose email or password data to the user list. */
export type UserSummary = { id: string; name: string };

export interface LoginResult {
  user: UserSummary;
  autodarts: { userId: string; username: string | null; expiresAt: string };
}

const summarySelect = { id: true, name: true } satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PostgresPrismaService,
    private readonly auth: AutodartsAuthClient,
    private readonly sessions: AutodartsSessionService,
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

    const tokens = await withAutodartsAuthErrors(() =>
      this.auth.login(dto.email, dto.password),
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
          autodartsSession: { create: this.sessions.sessionData(tokens) },
        },
        select: summarySelect,
      });
      return {
        user,
        autodarts: {
          userId: tokens.userId,
          username: tokens.username,
          expiresAt: tokens.expiresAt.toISOString(),
        },
      };
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

  /** Logs the stored account into Autodarts (valid token, refresh token or password). */
  async login(userId: string): Promise<LoginResult> {
    const session = await this.sessions.ensure(userId);
    await this.prisma.autodartsSession.update({
      where: { userId },
      data: { lastLoginAt: new Date() },
    });
    return {
      user: session.user,
      autodarts: {
        userId: session.autodartsUserId,
        username: session.autodartsUsername,
        expiresAt: session.expiresAt.toISOString(),
      },
    };
  }

  private emailTaken(): ConflictException {
    return new ConflictException({
      code: 'email_taken',
      message: 'Diese E-Mail ist bereits registriert.',
    });
  }
}
