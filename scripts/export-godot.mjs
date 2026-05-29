import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = process.cwd();
const godotRoot = join(repoRoot, 'godot');
const projectPath = join(godotRoot, 'project.godot');
const presetPath = join(godotRoot, 'export_presets.cfg');
const defaultPreset = 'Web';
const defaultOutPath = join(repoRoot, 'dist', 'index.html');

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const cleanOutput = args.includes('--clean');
const requireExport = args.includes('--require-export');
const preset = readOption('--preset') ?? defaultPreset;
const outPath = resolve(readOption('--out') ?? defaultOutPath);

if (!existsSync(projectPath)) {
  console.error('[godot:export] Missing canonical Godot project at godot/project.godot');
  process.exit(1);
}

if (!existsSync(presetPath)) {
  console.error('[godot:export] Missing Godot export presets at godot/export_presets.cfg');
  process.exit(1);
}

const presetNames = readPresetNames();
if (!presetNames.includes(preset)) {
  console.error(`[godot:export] Missing export preset: ${preset}`);
  console.error(`[godot:export] Available presets: ${presetNames.join(', ') || '(none)'}`);
  process.exit(1);
}

if (checkOnly) {
  const version = readGodotVersion();
  console.log(`[godot:export] export preset available: ${preset}`);
  if (version === null) {
    console.log('[godot:export] Godot is not installed; skipped export executable validation.');
  } else {
    console.log(`[godot:export] ${version}`);
  }
  process.exit(0);
}

const version = readGodotVersion();
if (version === null) {
  if (requireExport) {
    console.error('[godot:export] Godot is not installed; cannot create required export.');
    process.exit(1);
  }
  console.log('[godot:export] Godot is not installed; skipped export.');
  process.exit(0);
}

if (cleanOutput) {
  cleanOutputDirectory(outPath);
}

mkdirSync(dirname(outPath), { recursive: true });

const result = spawnSync('godot', [
  '--headless',
  '--path',
  godotRoot,
  '--export-release',
  preset,
  outPath,
], {
  encoding: 'utf8',
});

const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
if (result.status === 0) {
  if (output.length > 0) {
    console.log(output);
  }
  console.log(`[godot:export] exported ${preset} to ${outPath}`);
  process.exit(0);
}

if (isMissingExportTemplate(output)) {
  if (requireExport) {
    console.error('[godot:export] Godot export templates are not installed; required export failed.');
    if (output.length > 0) {
      console.error(output);
    }
    process.exit(result.status ?? 1);
  }
  console.log('[godot:export] Godot export templates are not installed; skipped export.');
  if (output.length > 0) {
    console.log(output);
  }
  process.exit(0);
}

console.error('[godot:export] Godot export failed.');
if (output.length > 0) {
  console.error(output);
}
process.exit(result.status ?? 1);

function readOption(name) {
  const prefix = `${name}=`;
  const value = args.find((arg) => arg.startsWith(prefix));
  return value === undefined ? null : value.slice(prefix.length);
}

function readPresetNames() {
  const text = readFileSync(presetPath, 'utf8');
  return [...text.matchAll(/^name="([^"]+)"$/gm)].map((match) => match[1]);
}

function readGodotVersion() {
  const result = spawnSync('godot', ['--version'], {
    encoding: 'utf8',
  });

  if (result.error?.code === 'ENOENT') {
    return null;
  }

  if (result.status !== 0) {
    return null;
  }

  return String(result.stdout ?? '').trim();
}

function isMissingExportTemplate(output) {
  return /export templates?|template.*not.*installed|No export template|Could not find.*template/i.test(output);
}

function cleanOutputDirectory(path) {
  const outputDir = dirname(path);
  const repoRelativeDir = relative(repoRoot, outputDir);
  if (
    outputDir === repoRoot ||
    repoRelativeDir === '' ||
    repoRelativeDir.startsWith('..') ||
    isAbsolute(repoRelativeDir)
  ) {
    console.error(`[godot:export] Refusing to clean unsafe output directory: ${outputDir}`);
    process.exit(1);
  }

  rmSync(outputDir, { recursive: true, force: true });
}
