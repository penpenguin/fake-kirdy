import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, '..');
const ledgerPath = join(repoRoot, 'docs', 'godot-v2', 'phaser-parity-ledger.json');

describe('Godot v2 Phaser parity ledger', () => {
  it('tracks Phaser reference systems against Godot canonical evidence', () => {
    expect(existsSync(ledgerPath)).toBe(true);

    const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8')) as {
      version?: number;
      canonical_runtime?: string;
      legacy_reference?: string;
      entries?: Array<{
        id?: string;
        status?: string;
        retirement_blocker?: boolean;
        godot_evidence?: string[];
        validation?: string[];
      }>;
    };

    expect(ledger.version).toBe(1);
    expect(ledger.canonical_runtime).toBe('godot');
    expect(ledger.legacy_reference).toBe('phaser-matter');
    expect(ledger.entries?.length).toBeGreaterThanOrEqual(10);

    const byId = new Map(ledger.entries?.map((entry) => [entry.id, entry]));
    expect(byId.get('player-controller')?.status).toBe('ported');
    expect(byId.get('player-controller')?.godot_evidence).toEqual(
      expect.arrayContaining(['godot/scripts/player/PlayerController.gd']),
    );
    expect(byId.get('replay-trace-metrics')?.validation).toEqual(
      expect.arrayContaining(['npm run godot:replay-suite']),
    );
    expect(byId.get('representative-stage-topology')?.status).toBe('ported');
    expect(byId.get('representative-stage-topology')?.retirement_blocker).toBe(false);
    expect(byId.get('audio-and-polish')?.status).toBe('deferred');
    expect(byId.get('audio-and-polish')?.retirement_blocker).toBe(false);
    expect(byId.get('export-packaging')?.status).toBe('ported');
    expect(byId.get('export-packaging')?.retirement_blocker).toBe(false);
    expect(byId.get('phaser-vite-runtime-retirement')?.status).toBe('ported');
    expect(byId.get('phaser-vite-runtime-retirement')?.retirement_blocker).toBe(false);
  });

  it('provides a check command that validates ledger evidence paths and reports blockers', () => {
    const packageJson = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.['godot:parity-ledger']).toContain(
      'scripts/check-godot-parity-ledger.mjs',
    );
    expect(packageJson.scripts?.['check:godot']).toContain('godot:parity-ledger');

    const output = execFileSync('node', ['scripts/check-godot-parity-ledger.mjs', '--check'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    const summary = JSON.parse(output) as {
      entry_count?: number;
      blocker_count?: number;
      blockers?: string[];
      statuses?: Record<string, number>;
    };

    expect(summary.entry_count).toBeGreaterThanOrEqual(10);
    expect(summary.statuses?.ported).toBeGreaterThan(0);
    expect(summary.blocker_count).toBe(0);
    expect(summary.blockers).toEqual([]);
  });

  it('passes explicitly when a retirement workflow asks for blocker enforcement', () => {
    const result = spawnSync('node', ['scripts/check-godot-parity-ledger.mjs', '--fail-on-blockers'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('"blocker_count": 0');
  });

  it('documents how to use the ledger before removing Phaser dependencies', () => {
    const docsPath = join(repoRoot, 'docs', 'godot-v2', 'phaser-parity-ledger.md');
    expect(existsSync(docsPath)).toBe(true);

    const docs = readFileSync(docsPath, 'utf8');
    const boundary = readFileSync(
      join(repoRoot, 'docs', 'godot-v2', 'legacy-reference-boundary.md'),
      'utf8',
    );

    expect(docs).toContain('phaser-parity-ledger.json');
    expect(docs).toContain('godot:parity-ledger');
    expect(docs).toContain('--fail-on-blockers');
    expect(boundary).toContain('phaser-parity-ledger.json');
    expect(boundary).toContain('godot:parity-ledger');
  });
});
