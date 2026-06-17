import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

const readText = (relativePath: string): string =>
  readFileSync(join(repoRoot, relativePath), 'utf8');

describe('Godot v2 export workflow', () => {
  it('defines canonical Godot export presets for headless and public web builds', () => {
    const presetPath = join(repoRoot, 'godot', 'export_presets.cfg');

    expect(existsSync(presetPath)).toBe(true);

    const preset = readFileSync(presetPath, 'utf8');
    expect(preset).toContain('name="Linux Headless"');
    expect(preset).toContain('platform="Linux/X11"');
    expect(preset).toContain('export_path="../dist-godot/fake-kirdy.x86_64"');
    expect(preset).toContain('name="Web"');
    expect(preset).toContain('platform="Web"');
    expect(preset).toContain('export_path="../dist/index.html"');
    expect(preset).toContain('variant/thread_support=false');
    expect(preset).toContain('vram_texture_compression/for_mobile=false');
    expect(preset).not.toContain('vram_texture_compression/for_mobile=true');
    expect(preset).toContain('html/canvas_resize_policy=2');
  });

  it('adds a graceful Godot export wrapper and package scripts', () => {
    const packageJson = JSON.parse(readText('package.json')) as {
      scripts?: Record<string, string>;
    };
    const script = readText('scripts/export-godot.mjs');

    expect(packageJson.scripts?.['godot:export']).toContain('scripts/export-godot.mjs');
    expect(packageJson.scripts?.['godot:export:web']).toContain('--preset=Web --out=dist/index.html');
    expect(packageJson.scripts?.['build:godot']).toBe('npm run godot:export:web --');
    expect(packageJson.scripts?.['build:public']).toBe('npm run godot:export:web -- --clean --require-export');
    expect(packageJson.scripts?.['build:legacy:web']).toBeUndefined();
    expect(packageJson.scripts?.build).toBe('npm run build:godot --');
    expect(packageJson.scripts?.['check:godot']).toContain('npm run godot:export -- --check');
    expect(script).toContain('export_presets.cfg');
    expect(script).toContain("const defaultPreset = 'Web'");
    expect(script).toContain("join(repoRoot, 'dist', 'index.html')");
    expect(script).toContain('--require-export');
    expect(script).toContain('--clean');
    expect(script).toContain('Godot is not installed; skipped export');
    expect(script).toContain('export templates are not installed; skipped export');
  });

  it('can validate the export configuration without requiring export templates', () => {
    const output = execFileSync('node', ['scripts/export-godot.mjs', '--check'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });

    expect(output).toContain('[godot:export]');
    expect(output).toContain('export preset available: Web');
  });

  it('forwards build:godot arguments to the export wrapper', () => {
    const output = execFileSync('npm', ['run', 'build:godot', '--', '--check'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });

    expect(output).toContain('export preset available: Web');
  });

  it('forwards default build arguments to the Godot export wrapper', () => {
    const output = execFileSync('npm', ['run', 'build', '--', '--check'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });

    expect(output).toContain('export preset available: Web');
  });

  it('keeps the Linux export preset available through explicit arguments', () => {
    const output = execFileSync('npm', [
      'run',
      'godot:export',
      '--',
      '--check',
      '--preset=Linux Headless',
    ], {
      cwd: repoRoot,
      encoding: 'utf8',
    });

    expect(output).toContain('export preset available: Linux Headless');
  });

  it('configures GitHub Pages deployment to publish the Godot Web export', () => {
    const workflow = readText('.github/workflows/test.yml');

    expect(workflow).toContain('GODOT_VERSION: 4.6.3');
    expect(workflow).toContain('GODOT_STATUS: stable');
    expect(workflow).toContain('Godot_v${GODOT_VERSION}-${GODOT_STATUS}_linux.x86_64.zip');
    expect(workflow).toContain('Godot_v${GODOT_VERSION}-${GODOT_STATUS}_export_templates.tpz');
    expect(workflow.match(/curl --fail --location --show-error --retry 3 --retry-delay 2 --retry-all-errors/g)).toHaveLength(2);
    expect(workflow).toContain('unzip -t /tmp/godot/godot.zip');
    expect(workflow).toContain('unzip -t /tmp/godot/export_templates.tpz');
    expect(workflow).toContain('sudo apt-get install -y ffmpeg');
    expect(workflow).toContain('npm run build:public');
    expect(workflow).toContain('path: dist');
    expect(workflow).not.toContain('build:legacy:web');
  });

  it('deploys the Godot Web export artifact built by the test job', () => {
    const workflow = readText('.github/workflows/test.yml');
    const installStepCount = workflow.match(/name: Install Godot export tooling/g)?.length ?? 0;
    const buildPublicCount = workflow.match(/npm run build:public/g)?.length ?? 0;

    expect(workflow).toContain('uses: actions/upload-artifact@v4');
    expect(workflow).toContain('uses: actions/download-artifact@v4');
    expect(workflow).toContain('name: godot-web-dist');
    expect(workflow).toContain('if-no-files-found: error');
    expect(installStepCount).toBe(1);
    expect(buildPublicCount).toBe(1);
  });

  it('documents the default Godot Web build command and removes Phaser deployment guidance', () => {
    const readme = readText('README.md');
    const agents = readText('AGENTS.md');

    expect(readme).toContain('npm run godot:export');
    expect(readme).toContain('npm run build:public');
    expect(readme).toContain('Godot Web');
    expect(readme).toContain('npm run build');
    expect(readme).not.toContain('deployed Phaser build');
    expect(agents).toContain('npm run godot:export');
    expect(agents).toContain('npm run build:public');
    expect(agents).toContain('npm run build');
    expect(existsSync(join(repoRoot, 'docs', 'godot-v2', 'full-migration-execplan.md'))).toBe(false);
  });

  it('uses the web-compatible Godot renderer for browser exports', () => {
    const project = readText('godot/project.godot');

    expect(project).toContain('[rendering]');
    expect(project).toContain('renderer/rendering_method.web="gl_compatibility"');
  });

  it('installs a Canvas 2D fallback for browsers without WebGL 2', () => {
    const packageJson = JSON.parse(readText('package.json')) as {
      scripts?: Record<string, string>;
    };
    const exportScript = readText('scripts/export-godot.mjs');
    const fallbackInstaller = readText('scripts/install-godot-web-fallback.mjs');
    const docs = readText('docs/godot-v2/web-fallback.md');

    expect(packageJson.scripts?.['godot:web-fallback']).toContain('scripts/install-godot-web-fallback.mjs');
    expect(exportScript).toContain('installWebFallback');
    expect(fallbackInstaller).toContain('webgl-fallback.js');
    expect(fallbackInstaller).toContain('function hasWebGL2()');
    expect(fallbackInstaller).toContain('getContext("webgl2")');
    expect(fallbackInstaller).not.toContain('getContext("webgl")');
    expect(fallbackInstaller).not.toContain('getContext("experimental-webgl")');
    expect(fallbackInstaller).toContain('getContext("2d")');
    expect(fallbackInstaller).toContain('data-kirdy-canvas2d-fallback');
    expect(fallbackInstaller).toContain('Godot Web export artifacts are missing');
    expect(docs).toContain('Canvas 2D fallback');
    expect(docs).toContain('WebGL 2 unavailable');
  });

  it('can inject the fallback script into an exported HTML page', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'fake-kirdy-web-fallback-'));

    try {
      writeFileSync(
        join(tempDir, 'index.html'),
        '<!doctype html><html><head><title>Fake Kirdy</title></head><body><canvas id="canvas"></canvas></body></html>',
      );

      execFileSync('node', ['scripts/install-godot-web-fallback.mjs', `--export-dir=${tempDir}`], {
        cwd: repoRoot,
        encoding: 'utf8',
      });
      execFileSync('node', ['scripts/install-godot-web-fallback.mjs', `--export-dir=${tempDir}`], {
        cwd: repoRoot,
        encoding: 'utf8',
      });

      const html = readFileSync(join(tempDir, 'index.html'), 'utf8');
      const fallbackScript = readFileSync(join(tempDir, 'webgl-fallback.js'), 'utf8');

      expect(html.match(/webgl-fallback\.js/g)).toHaveLength(1);
      expect(html).toContain('<script src="./webgl-fallback.js" defer></script>');
      expect(fallbackScript).toContain('requestAnimationFrame');
      expect(fallbackScript).toContain('drawFallbackScene');
      expect(fallbackScript).toContain('data-kirdy-canvas2d-fallback');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
