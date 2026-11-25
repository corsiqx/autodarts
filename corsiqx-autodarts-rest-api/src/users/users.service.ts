import { ConflictException, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { Prisma } from '../../generated/postgres-prisma';
import { PostgresPrismaService } from '../postgres-prisma/postgres-prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

/** Public shape of a user. Never expose email or passwordHash to the user list. */
export type UserSummary = { id: string; name: string };

const summarySelect = { id: true, name: true } satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PostgresPrismaService) {}

  findAll(): Promise<UserSummary[]> {
    return this.prisma.user.findMany({
      select: summarySelect,
      orderBy: { name: 'asc' },
    });
  }

  async create(dto: CreateUserDto): Promise<UserSummary> {
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });

    try {
      return await this.prisma.user.create({
        data: { name: dto.name, email: dto.email, passwordHash },
        select: summarySelect,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Diese E-Mail ist bereits registriert.');
      }
      throw error;
    }
  }
}
