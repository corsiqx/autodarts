import { Module } from '@nestjs/common';
import { AutodartsModule } from '../autodarts/autodarts.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AutodartsModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
