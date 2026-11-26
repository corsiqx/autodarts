import { Module } from '@nestjs/common';
import { AutodartsApiClient } from './autodarts-api.client';
import { AutodartsAuthClient } from './autodarts-auth.client';
import { AutodartsSessionService } from './autodarts-session.service';

@Module({
  providers: [AutodartsAuthClient, AutodartsSessionService, AutodartsApiClient],
  exports: [AutodartsAuthClient, AutodartsSessionService, AutodartsApiClient],
})
export class AutodartsModule {}
