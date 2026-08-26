import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

@Injectable()
export class NotificationCredentialsService {
  constructor(private readonly config: ConfigService) {}

  encrypt(value: object) {
    const key = this.key();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(value), 'utf8'),
      cipher.final(),
    ]);
    return [iv, cipher.getAuthTag(), ciphertext]
      .map((part) => part.toString('base64url'))
      .join('.');
  }

  decrypt<T>(value: string): T {
    const [iv, tag, ciphertext] = value
      .split('.')
      .map((part) => Buffer.from(part, 'base64url'));
    if (!iv || !tag || !ciphertext) {
      throw new InternalServerErrorException('Stored notification credentials are invalid');
    }
    const decipher = createDecipheriv('aes-256-gcm', this.key(), iv);
    decipher.setAuthTag(tag);
    return JSON.parse(
      Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8'),
    ) as T;
  }

  private key() {
    const encoded = this.config.get<string>('NOTIFICATION_CREDENTIALS_KEY');
    const key = encoded ? Buffer.from(encoded, 'base64') : Buffer.alloc(0);
    console.log(key, key.length)
    if (key.length !== 32) {
      throw new InternalServerErrorException(
        'NOTIFICATION_CREDENTIALS_KEY must be a base64-encoded 32-byte key',
      );
    }
    return key;
  }
}
