import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = process.cwd();
const projectPath = join(repoRoot, 'godot', 'project.godot');

if (!existsSync(projectPath)) {
  console.error('[check:godot] Missing canonical Godot project at godot/project.godot');
  process.exit(1);
}

const result = spawnSync('godot', ['--version'], {
  encoding: 'utf8',
});

if (result.error?.code === 'ENOENT') {
  console.log('[check:godot] Godot is not installed; skipped executable validation.');
  process.exit(0);
}

if (result.status !== 0) {
  console.error('[check:godot] Godot executable validation failed.');
  if (result.stderr) {
    console.error(result.stderr.trim());
  }
  process.exit(result.status ?? 1);
}

console.log(`[check:godot] ${result.stdout.trim()}`);
