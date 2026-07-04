import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AppConfigService } from '@/config/config.module';

/**
 * Encapsulates password hashing so the algorithm/cost can change in one place.
 * bcryptjs is pure-JS (no native build step) — a deliberate portability choice.
 */
@Injectable()
export class PasswordService {
  constructor(private readonly config: AppConfigService) {}

  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.config.get('BCRYPT_ROUNDS'));
  }

  compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
