import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

const readPackageScripts = (): Record<string, string> => {
  const packageJson = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>;
  };
  return packageJson.scripts ?? {};
};

const writeFixtureExport = (exportDir: string): void => {
  mkdirSync(exportDir, { recursive: true });
  writeFileSync(
    join(exportDir, 'index.html'),
    `<!doctype html>
<html>
  <head><title>Fake Kirdy</title></head>
  <body>
    <canvas id="canvas" tabindex="0"></canvas>
    <script src="./fake-kirdy.js"></script>
  </body>
</html>
`,
  );
  writeFileSync(join(exportDir, 'fake-kirdy.js'), 'console.log("boot");\n');
  writeFileSync(join(exportDir, 'fake-kirdy.wasm'), 'wasm');
  writeFileSync(join(exportDir, 'fake-kirdy.pck'), 'pck');
  writeFileSync(join(exportDir, 'webgl-fallback.js'), 'document.querySelector("canvas");\n');
};

const writeFixtureContract = (path: string, exportDir: string): void => {
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        version: 1,
        export_dir: exportDir,
        required_artifacts: ['index.html', '*.js', '*.wasm', '*.pck'],
        required_html_markers: ['<canvas', 'fake-kirdy.js'],
        required_headers: ['Cross-Origin-Opener-Policy', 'Cross-Origin-Embedder-Policy'],
        forbidden_console_patterns: ['Error', 'Unhandled', 'Failed to load', 'wasm streaming compile failed'],
        smoke_steps: [
          {
            id: 'canvas_visible',
            category: 'canvas',
            expression: 'document.querySelectorAll("canvas").length >= 1',
            expected: true,
          },
          {
            id: 'keyboard_input_dispatch',
            category: 'input',
            expression: 'window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" })) === true',
            expected: true,
          },
          {
            id: 'pause_input_dispatch',
            category: 'pause',
            expression: 'window.dispatchEvent(new KeyboardEvent("keydown", { code: "Escape" })) === true',
            expected: true,
          },
          {
            id: 'map_input_dispatch',
            category: 'map',
            expression: 'window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyM" })) === true',
            expected: true,
          },
        ],
        runtime: {
          warmup_ms: 250,
          max_boot_wait_ms: 2000,
          min_canvas_count: 1,
          min_fps: 30,
          sample_ms: 250,
        },
        rules: {
          export_artifact: { severity: 'error' },
          html_marker: { severity: 'error' },
          server_header_contract: { severity: 'error' },
          smoke_step_coverage: { severity: 'error' },
          browser_missing: { severity: 'error' },
          console_error: { severity: 'error' },
          runtime_smoke_step: { severity: 'error' },
        },
      },
      null,
      2,
    )}\n`,
  );
};

describe('Godot Web smoke', () => {
  it('defines a Web smoke command, contract, and full-check hook', () => {
    const scripts = readPackageScripts();

    expect(scripts['godot:web-smoke']).toBe('node scripts/check-godot-web-smoke.mjs');
    expect(scripts['check:godot']).toContain('godot:web-smoke');
    expect(scripts['check:full']).toContain('godot:web-smoke -- --require-export --require-browser');
    expect(existsSync(join(repoRoot, 'scripts', 'check-godot-web-smoke.mjs'))).toBe(true);
    expect(existsSync(join(repoRoot, 'godot', 'tests', 'web_smoke_contract.json'))).toBe(true);
  });

  it('passes a fixture with export artifacts, server headers, console guards, and input smoke steps', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'fake-kirdy-web-smoke-'));
    const exportDir = join(tempDir, 'dist');
    const contractPath = join(tempDir, 'web_smoke_contract.json');

    try {
      writeFixtureExport(exportDir);
      writeFixtureContract(contractPath, exportDir);

      const result = spawnSync(process.execPath, ['scripts/check-godot-web-smoke.mjs', '--contract', contractPath, '--require-export', '--json'], {
        cwd: repoRoot,
        encoding: 'utf8',
      });

      expect(result.status).toBe(0);
      const report = JSON.parse(result.stdout) as {
        failed_checks: unknown[];
        categories: Record<string, number>;
      };
      expect(report.failed_checks).toEqual([]);
      expect(report.categories).toMatchObject({
        export_artifacts: 4,
        smoke_steps: 4,
        server_headers: 2,
        console_guards: 4,
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('fails with useful evidence when export artifacts or smoke coverage are missing', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'fake-kirdy-web-smoke-broken-'));
    const exportDir = join(tempDir, 'dist');
    const contractPath = join(tempDir, 'web_smoke_contract.json');

    try {
      mkdirSync(exportDir, { recursive: true });
      writeFileSync(join(exportDir, 'index.html'), '<!doctype html><html><body></body></html>\n');
      writeFixtureContract(contractPath, exportDir);

      const result = spawnSync(process.execPath, ['scripts/check-godot-web-smoke.mjs', '--contract', contractPath, '--require-export', '--json'], {
        cwd: repoRoot,
        encoding: 'utf8',
      });

      expect(result.status).toBe(1);
      const report = JSON.parse(result.stdout) as {
        failed_checks: { rule: string; message: string }[];
      };
      expect(report.failed_checks).toContainEqual(expect.objectContaining({ rule: 'export_artifact' }));
      expect(report.failed_checks).toContainEqual(expect.objectContaining({ rule: 'html_marker' }));
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('uses retryable browser profile cleanup for CI teardown races', () => {
    const source = readFileSync(join(repoRoot, 'scripts', 'check-godot-web-smoke.mjs'), 'utf8');

    expect(source).toContain('maxRetries');
    expect(source).toContain('retryDelay');
  });

  it('attaches console guards before navigating the exported page', () => {
    const source = readFileSync(join(repoRoot, 'scripts', 'check-godot-web-smoke.mjs'), 'utf8');

    expect(source).toContain("'data:text/html,<html></html>'");
    expect(source).toContain("await cdp.send('Page.navigate'");
    expect(source).toContain('url: server.url');
    expect(source).toContain('createPageTarget(debugPort');
    expect(source).toContain("method: 'PUT'");
    expect(source.indexOf("await cdp.send('Page.navigate'")).toBeGreaterThan(source.indexOf("await cdp.send('Log.enable')"));
    expect(source.indexOf("await cdp.send('Page.navigate'")).toBeLessThan(source.indexOf('await sleep(numberValue(runtime.warmup_ms'));
  });

  it('validates canonical Web smoke contract and CI/full enforcement wiring', () => {
    const result = spawnSync(process.execPath, ['scripts/check-godot-web-smoke.mjs', '--json'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    const report = JSON.parse(result.stdout) as {
      failed_checks: unknown[];
      categories: Record<string, number>;
      smoke_steps: { id: string; category: string }[];
    };
    expect(report.failed_checks).toEqual([]);
    expect(report.categories.smoke_steps).toBeGreaterThanOrEqual(5);
    expect(report.smoke_steps.map((step) => step.category)).toEqual(
      expect.arrayContaining(['load', 'canvas', 'input', 'pause', 'map', 'console']),
    );

    const workflow = readFileSync(join(repoRoot, '.github', 'workflows', 'test.yml'), 'utf8');
    expect(workflow).toContain('npm run godot:web-smoke -- --require-export --require-browser');
  });
});
