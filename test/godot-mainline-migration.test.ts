import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

const readText = (relativePath: string): string =>
  readFileSync(join(repoRoot, relativePath), 'utf8');

describe('Godot mainline migration contract', () => {
  it('keeps a self-contained full migration ExecPlan with required living sections', () => {
    const planPath = join(repoRoot, 'docs', 'godot-v2', 'full-migration-execplan.md');

    expect(existsSync(planPath)).toBe(true);

    const plan = readFileSync(planPath, 'utf8');

    [
      'Progress',
      'Surprises & Discoveries',
      'Decision Log',
      'Outcomes & Retrospective',
      'Godot canonical',
      'legacy/reference',
      'Milestone 10',
    ].forEach((requiredText) => {
      expect(plan).toContain(requiredText);
    });
  });

  it('promotes the Godot project to a canonical repo-level location', () => {
    expect(existsSync(join(repoRoot, 'godot', 'project.godot'))).toBe(true);

    const project = readText('godot/project.godot');
    const replayRunner = readText('godot/tests/run_replay.gd');
    expect(project).toContain('run/main_scene=');
    expect(project).toContain('GameSession');
    expect(replayRunner).toContain('session.auto_start = false');
  });

  it('adds graceful Godot and trace commands to package scripts', () => {
    const manifest = JSON.parse(readText('package.json')) as {
      scripts?: Record<string, string>;
    };

    expect(manifest.scripts?.['check:godot']).toContain('scripts/check-godot.mjs');
    expect(manifest.scripts?.dev).toBe('npm run godot:run --');
    expect(manifest.scripts?.['godot:run']).toContain('godot');
    expect(manifest.scripts?.['godot:replay']).toContain('scripts/run-godot-replay.mjs');
    expect(manifest.scripts?.['dev:legacy:web']).toBeUndefined();
    expect(manifest.scripts?.['preview:legacy:web']).toBeUndefined();
    expect(manifest.scripts?.['trace:summary']).toContain('scripts/trace-summary.mjs');
    expect(manifest.scripts?.test).toContain('check:godot');
  });

  it('updates repo guidance and README for Godot canonical development', () => {
    const agents = readText('AGENTS.md');
    const readme = readText('README.md');

    expect(agents).toContain('Godot canonical');
    expect(agents).toContain('Phaser legacy/reference');
    expect(readme).toContain('Godot');
    expect(readme).toContain('npm run dev');
    expect(readme).toContain('legacy/reference source');
    expect(readme).toContain('godot:run');
    expect(readme).toContain('trace:summary');
  });
});
