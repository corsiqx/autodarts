import { Module } from '@nestjs/common';
import { AutodartsAuthClient } from './autodarts-auth.client';

@Module({
  providers: [AutodartsAuthClient],
  exports: [AutodartsAuthClient],
})
export class AutodartsModule {}
