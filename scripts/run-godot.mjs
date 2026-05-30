import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = process.cwd();
const godotRoot = join(repoRoot, 'godot');
const projectPath = join(godotRoot, 'project.godot');
const args = process.argv.slice(2);
const checkOnly = args.includes('--check');

if (!existsSync(projectPath)) {
  console.error('[godot:run] Missing canonical Godot project at godot/project.godot');
  process.exit(1);
}

const executable = findGodotExecutable();

if (executable === null) {
  console.error('[godot:run] Godot executable was not found.');
  console.error('[godot:run] Install Godot 4 as `godot` or `godot4`. Set GODOT_BIN to the executable path if needed.');
  process.exit(1);
}

if (checkOnly) {
  const version = readVersion(executable.command);
  console.log(`[godot:run] Godot executable available: ${executable.label}`);
  if (version !== null) {
    console.log(`[godot:run] ${version}`);
  }
  process.exit(0);
}

const result = spawnSync(executable.command, ['--path', godotRoot, ...args], {
  stdio: 'inherit',
});

if (result.error?.code === 'ENOENT') {
  console.error(`[godot:run] Godot executable disappeared before launch: ${executable.label}`);
  process.exit(1);
}

if (result.error) {
  console.error(`[godot:run] Failed to launch Godot: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 0);

function findGodotExecutable() {
  const candidates = [
    process.env.GODOT_BIN ? { command: process.env.GODOT_BIN, label: process.env.GODOT_BIN } : null,
    { command: 'godot', label: 'godot' },
    { command: 'godot4', label: 'godot4' },
  ].filter(Boolean);

  for (const candidate of candidates) {
    const version = readVersion(candidate.command);
    if (version !== null) {
      return candidate;
    }
  }

  return null;
}

function readVersion(command) {
  const result = spawnSync(command, ['--version'], {
    encoding: 'utf8',
  });

  if (result.error?.code === 'ENOENT' || result.status !== 0) {
    return null;
  }

  return String(result.stdout ?? '').trim();
}
