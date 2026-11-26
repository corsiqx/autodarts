import { Module } from '@nestjs/common';
import { AutodartsModule } from '../autodarts/autodarts.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [AutodartsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
