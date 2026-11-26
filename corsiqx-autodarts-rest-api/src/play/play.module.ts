import { Module } from '@nestjs/common';
import { AutodartsModule } from '../autodarts/autodarts.module';
import { PlayController } from './play.controller';
import { PlayService } from './play.service';

@Module({
  imports: [AutodartsModule],
  controllers: [PlayController],
  providers: [PlayService],
})
export class PlayModule {}
