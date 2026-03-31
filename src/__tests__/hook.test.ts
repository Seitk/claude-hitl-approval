import { describe, it, expect } from 'bun:test';
import { extractCommand, buildDenialMessage } from '../hook/hook';

describe('extractCommand', () => {
  it('extracts command from Bash tool_input', () => {
    expect(extractCommand('Bash', { command: 'rm -rf dist' })).toBe('rm -rf dist');
  });

  it('extracts file_path from Write tool_input', () => {
    expect(extractCommand('Write', { file_path: '/foo/bar.ts', content: '...' })).toBe('/foo/bar.ts');
  });

  it('extracts file_path from Edit tool_input', () => {
    expect(extractCommand('Edit', { file_path: '/foo/bar.ts' })).toBe('/foo/bar.ts');
  });

  it('falls back to JSON for unknown tools', () => {
    const result = extractCommand('UnknownTool', { foo: 'bar' });
    expect(result).toBe('{"foo":"bar"}');
  });
});

describe('buildDenialMessage', () => {
  it('includes HITL prefix, request ID, and status command', () => {
    const msg = buildDenialMessage('abc-123', 'denied');
    expect(msg).toContain('HITL:');
    expect(msg).toContain('abc-123');
    expect(msg).toContain('Do NOT retry');
  });

  it('mentions timeout for timeout status', () => {
    const msg = buildDenialMessage('abc-123', 'timeout');
    expect(msg).toContain('timed out');
    expect(msg).toContain('abc-123');
  });
});
