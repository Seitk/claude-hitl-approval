import { describe, it, expect } from 'bun:test';
import { matchesAnyRule } from '../shared/patterns';
import type { HitlRule } from '../shared/types';

const rules: HitlRule[] = [
  { tool: 'Bash', pattern: 'rm *' },
  { tool: 'Bash', pattern: 'git push*' },
  { tool: 'Write', pattern: '*' },
];

describe('matchesAnyRule', () => {
  it('matches rm with wildcard', () => {
    expect(matchesAnyRule('Bash', 'rm -rf ./dist', rules)).toBe(true);
  });

  it('matches git push with args', () => {
    expect(matchesAnyRule('Bash', 'git push origin main', rules)).toBe(true);
  });

  it('matches any Write command', () => {
    expect(matchesAnyRule('Write', '/any/path.txt', rules)).toBe(true);
  });

  it('does not match safe Bash command', () => {
    expect(matchesAnyRule('Bash', 'ls -la', rules)).toBe(false);
  });

  it('does not match wrong tool', () => {
    expect(matchesAnyRule('Read', '/some/path.txt', rules)).toBe(false);
  });

  it('returns false for empty rules', () => {
    expect(matchesAnyRule('Bash', 'rm foo', [])).toBe(false);
  });
});
