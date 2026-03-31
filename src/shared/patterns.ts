import type { HitlRule } from './types';

/**
 * Match a command string against a glob pattern.
 *
 * Shell commands are flat strings containing spaces, flags, and path separators.
 * Standard glob libraries (e.g. minimatch) treat `*` as matching anything except
 * `/`, which breaks patterns like `rm *` against `rm -rf ./dist`. This converter
 * treats `*` as matching any sequence of characters including `/` and spaces,
 * which is the expected behaviour for command-string patterns.
 */
function globToRegex(pattern: string): RegExp {
  // Escape all regex special characters except `*`.
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  // Replace one or more `*` with `.*` (match anything, including `/`).
  const regexSource = escaped.replace(/\*+/g, '.*');
  return new RegExp(`^${regexSource}$`);
}

export function matchesAnyRule(
  toolName: string,
  command: string,
  rules: HitlRule[],
): boolean {
  return rules.some(
    (rule) => rule.tool === toolName && globToRegex(rule.pattern).test(command),
  );
}
