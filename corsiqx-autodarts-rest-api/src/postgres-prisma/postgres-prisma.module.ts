import { Global, Module } from '@nestjs/common';
import { PostgresPrismaService } from './postgres-prisma.service';

@Global()
@Module({
  providers: [PostgresPrismaService],
  exports: [PostgresPrismaService],
})
export class PostgresPrismaModule {}
