import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, '..');
const godotRoot = join(repoRoot, 'godot');

const readRepoFile = (relativePath: string): string =>
  readFileSync(join(repoRoot, relativePath), 'utf8');

describe('Godot v2 performance budget checks', () => {
  it('defines an explicit Godot performance command and budget', () => {
    const packageJson = JSON.parse(readRepoFile('package.json')) as {
      scripts?: Record<string, string>;
    };
    const scriptPath = join(repoRoot, 'scripts', 'check-godot-performance.mjs');
    const budgetPath = join(godotRoot, 'tests', 'performance_budget.json');
    const docsPath = join(repoRoot, 'docs', 'godot-v2', 'performance-testing.md');

    expect(packageJson.scripts?.['godot:performance']).toBe('node scripts/check-godot-performance.mjs');
    expect(existsSync(scriptPath)).toBe(true);
    expect(existsSync(budgetPath)).toBe(true);
    expect(existsSync(docsPath)).toBe(true);

    const script = readRepoFile('scripts/check-godot-performance.mjs');
    expect(script).toContain('performance_budget.json');
    expect(script).toContain('min_effective_trace_fps');
    expect(script).toContain('max_replay_wall_time_ms');
    expect(script).toContain('max_replay_rss_bytes');
    expect(script).toContain('max_import_wall_time_ms');
    expect(script).toContain('process.hrtime.bigint');
    expect(script).toContain('readPeakRssBytes');
    expect(script).toContain('trace-summary.mjs');
    expect(script).toContain('Godot is not installed');

    const budget = JSON.parse(readFileSync(budgetPath, 'utf8')) as {
      version: number;
      target_fps: number;
      min_effective_trace_fps: number;
      max_replay_wall_time_ms: number;
      max_replay_rss_bytes: number;
      max_import_wall_time_ms: number;
      replay_ids: string[];
    };
    expect(budget.version).toBe(1);
    expect(budget.target_fps).toBe(60);
    expect(budget.min_effective_trace_fps).toBeGreaterThanOrEqual(59);
    expect(budget.max_replay_wall_time_ms).toBeGreaterThan(0);
    expect(budget.max_replay_rss_bytes).toBeGreaterThan(0);
    expect(budget.max_import_wall_time_ms).toBeGreaterThan(0);
    expect(budget.replay_ids.length).toBeGreaterThanOrEqual(2);

    const docs = readFileSync(docsPath, 'utf8');
    expect(docs).toContain('Performance Testing');
    expect(docs).toContain('npm run godot:performance');
    expect(docs).toContain('60 FPS');
    expect(docs).toContain('RSS');
    expect(docs).toContain('load time');
  });

  it('defines a browser 60 FPS gate for the Godot Web export', () => {
    const packageJson = JSON.parse(readRepoFile('package.json')) as {
      scripts?: Record<string, string>;
    };
    const scriptPath = join(repoRoot, 'scripts', 'check-godot-web-performance.mjs');
    const budgetPath = join(godotRoot, 'tests', 'web_performance_budget.json');
    const workflow = readRepoFile('.github/workflows/test.yml');
    const docs = readRepoFile('docs/godot-v2/performance-testing.md');

    expect(packageJson.scripts?.['godot:web-performance']).toBe('node scripts/check-godot-web-performance.mjs');
    expect(existsSync(scriptPath)).toBe(true);
    expect(existsSync(budgetPath)).toBe(true);

    const script = readRepoFile('scripts/check-godot-web-performance.mjs');
    expect(script).toContain('web_performance_budget.json');
    expect(script).toContain('requestAnimationFrame');
    expect(script).toContain('min_browser_raf_fps');
    expect(script).toContain('max_browser_frame_ms');
    expect(script).toContain('remote-debugging-port');
    expect(script).toContain('Godot Web export artifacts are missing');
    expect(script).toContain('Browser executable was not found');

    const budget = JSON.parse(readFileSync(budgetPath, 'utf8')) as {
      version: number;
      target_fps: number;
      min_browser_raf_fps: number;
      max_browser_frame_ms: number;
      sample_ms: number;
      export_dir: string;
    };
    expect(budget.version).toBe(1);
    expect(budget.target_fps).toBe(60);
    expect(budget.min_browser_raf_fps).toBeGreaterThanOrEqual(58);
    expect(budget.max_browser_frame_ms).toBeLessThanOrEqual(50);
    expect(budget.sample_ms).toBeGreaterThanOrEqual(1000);
    expect(budget.export_dir).toBe('dist');

    expect(workflow).toContain('npm run godot:web-performance');
    expect(docs).toContain('npm run godot:web-performance');
    expect(docs).toContain('browser 60 FPS');
    expect(docs).toContain('requestAnimationFrame');
  });
});
