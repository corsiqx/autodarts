import { Module } from '@nestjs/common';
import { AutodartsModule } from '../autodarts/autodarts.module';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

@Module({
  imports: [AutodartsModule],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
