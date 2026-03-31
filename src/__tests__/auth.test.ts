// src/__tests__/auth.test.ts
import { describe, it, expect } from 'bun:test';
import { createAuthService } from '../local-server/auth';

describe('AuthService', () => {
  it('generates a valid token that passes validation', () => {
    const auth = createAuthService();
    const token = auth.generateToken('req-1');
    const result = auth.validateToken(token, 'req-1');
    expect(result.valid).toBe(true);
  });

  it('rejects token with wrong requestId', () => {
    const auth = createAuthService();
    const token = auth.generateToken('req-1');
    const result = auth.validateToken(token, 'req-2');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('mismatch');
  });

  it('rejects token after single use', () => {
    const auth = createAuthService();
    const token = auth.generateToken('req-1');
    auth.validateToken(token, 'req-1'); // first use
    const result = auth.validateToken(token, 'req-1'); // second use
    expect(result.valid).toBe(false);
    expect(result.error).toContain('already used');
  });

  it('rejects a malformed token', () => {
    const auth = createAuthService();
    const result = auth.validateToken('not-a-jwt', 'req-1');
    expect(result.valid).toBe(false);
  });

  it('tokens from different instances are independent', () => {
    const auth1 = createAuthService();
    const auth2 = createAuthService();
    const token = auth1.generateToken('req-1');
    // auth2 has different secret, should reject
    const result = auth2.validateToken(token, 'req-1');
    expect(result.valid).toBe(false);
  });
});
