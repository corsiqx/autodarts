import { Injectable } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/postgres-prisma';

@Injectable()
export class PostgresPrismaService extends PrismaClient {
  constructor() {
    super({
      adapter: new PrismaPg({
        connectionString: process.env.POSTGRES_DATABASE_URL,
      }),
    });
  }
}
