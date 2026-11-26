import { Global, Module } from '@nestjs/common';
import { CredentialsCipherService } from './credentials-cipher.service';

@Global()
@Module({
  providers: [CredentialsCipherService],
  exports: [CredentialsCipherService],
})
export class CryptoModule {}
