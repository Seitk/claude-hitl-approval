import { describe, it, expect } from 'bun:test';
import { extractCommand, extractDescription, buildContextRequestMessage, buildDenialMessage } from '../hook/hook';

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

describe('extractDescription', () => {
  it('extracts description string from tool_input', () => {
    expect(extractDescription({ command: 'rm -rf dist', description: 'Delete dist directory' }))
      .toBe('Delete dist directory');
  });

  it('returns null when description is missing', () => {
    expect(extractDescription({ command: 'ls' })).toBeNull();
  });

  it('returns null when description is empty string', () => {
    expect(extractDescription({ command: 'ls', description: '' })).toBeNull();
  });

  it('returns null when description is whitespace', () => {
    expect(extractDescription({ command: 'ls', description: '   ' })).toBeNull();
  });

  it('trims whitespace from description', () => {
    expect(extractDescription({ description: '  Run tests  ' })).toBe('Run tests');
  });

  it('returns null when description is not a string', () => {
    expect(extractDescription({ description: 42 })).toBeNull();
  });
});

describe('buildContextRequestMessage', () => {
  it('includes HITL_CONTEXT_REQUIRED prefix', () => {
    const msg = buildContextRequestMessage('Bash', 'rm -rf dist');
    expect(msg).toContain('HITL_CONTEXT_REQUIRED');
  });

  it('includes the tool name and command', () => {
    const msg = buildContextRequestMessage('Bash', 'git push origin main');
    expect(msg).toContain('Bash');
    expect(msg).toContain('git push origin main');
  });

  it('asks for description parameter', () => {
    const msg = buildContextRequestMessage('Bash', 'rm -rf dist');
    expect(msg).toContain('description');
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
