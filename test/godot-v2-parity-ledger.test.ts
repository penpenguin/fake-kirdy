import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, '..');

describe('retired Godot v2 Phaser parity ledger', () => {
  it('keeps parity ledger validation out of canonical package commands', () => {
    const packageJson = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.['godot:parity-ledger']).toBeUndefined();
    expect(packageJson.scripts?.['check:godot']).not.toContain('godot:parity-ledger');
    expect(existsSync(join(repoRoot, 'scripts', 'check-godot-parity-ledger.mjs'))).toBe(false);
  });

  it('documents legacy retirement without an active parity ledger gate', () => {
    const boundary = readFileSync(
      join(repoRoot, 'docs', 'godot-v2', 'legacy-reference-boundary.md'),
      'utf8',
    );
    const readme = readFileSync(join(repoRoot, 'README.md'), 'utf8');
    const agents = readFileSync(join(repoRoot, 'AGENTS.md'), 'utf8');

    expect(existsSync(join(repoRoot, 'docs', 'godot-v2', 'phaser-parity-ledger.md'))).toBe(false);
    expect(existsSync(join(repoRoot, 'docs', 'godot-v2', 'phaser-parity-ledger.json'))).toBe(false);
    expect(boundary).not.toContain('godot:parity-ledger');
    expect(readme).not.toContain('godot:parity-ledger');
    expect(agents).not.toContain('godot:parity-ledger');
    expect(boundary).toContain('retired after the Godot mainline switch');
  });
});
