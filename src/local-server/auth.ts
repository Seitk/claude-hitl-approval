// src/local-server/auth.ts
import jwt from 'jsonwebtoken';
import { randomBytes, randomUUID } from 'crypto';
import type { AuthService } from '../shared/types';

const TOKEN_TTL_SECONDS = 300; // 5 minutes

export function createAuthService(): AuthService {
  const secret = randomBytes(32).toString('hex');
  const usedJtis = new Set<string>();

  return {
    generateToken(requestId: string): string {
      const jti = randomUUID();
      return jwt.sign({ requestId, jti }, secret, {
        expiresIn: TOKEN_TTL_SECONDS,
      });
    },

    validateToken(token: string, requestId: string): { valid: boolean; error?: string } {
      let payload: { requestId: string; jti: string };
      try {
        payload = jwt.verify(token, secret) as { requestId: string; jti: string };
      } catch (err) {
        return { valid: false, error: (err as Error).message };
      }

      if (payload.requestId !== requestId) {
        return { valid: false, error: 'Token requestId mismatch' };
      }
      if (usedJtis.has(payload.jti)) {
        return { valid: false, error: 'Token already used' };
      }

      usedJtis.add(payload.jti);
      return { valid: true };
    },
  };
}
