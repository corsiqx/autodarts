import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const VERSION = 'v1';

/**
 * Reversible encryption for secrets we must send back out (Autodarts password and tokens).
 * Format: `v1.<iv>.<authTag>.<ciphertext>`, each part base64url.
 */
@Injectable()
export class CredentialsCipherService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const raw = config.get<string>('CREDENTIALS_ENCRYPTION_KEY');
    const key = raw ? Buffer.from(raw, 'base64') : Buffer.alloc(0);
    if (key.length !== 32) {
      throw new Error(
        'CREDENTIALS_ENCRYPTION_KEY must be 32 bytes, base64 encoded. ' +
          "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
      );
    }
    this.key = key;
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    return [VERSION, iv, cipher.getAuthTag(), ciphertext]
      .map((part) =>
        typeof part === 'string' ? part : part.toString('base64url'),
      )
      .join('.');
  }

  decrypt(payload: string): string {
    const [version, iv, tag, ciphertext] = payload.split('.');
    if (version !== VERSION || !iv || !tag || !ciphertext) {
      throw new Error('Unsupported encrypted payload');
    }
    const decipher = createDecipheriv(
      ALGORITHM,
      this.key,
      Buffer.from(iv, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }
}
