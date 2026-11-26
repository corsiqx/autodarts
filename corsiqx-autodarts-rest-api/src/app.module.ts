import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { PostgresPrismaModule } from './postgres-prisma/postgres-prisma.module';
import { CryptoModule } from './crypto/crypto.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { PlayModule } from './play/play.module';
import { StatsModule } from './stats/stats.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PostgresPrismaModule,
    CryptoModule,
    UsersModule,
    DashboardModule,
    PlayModule,
    StatsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
