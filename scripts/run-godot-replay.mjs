import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = process.cwd();
const godotRoot = join(repoRoot, 'godot');
const userArgs = process.argv.slice(2);
const replayArgs = userArgs.length > 0
  ? userArgs
  : [
      '--replay',
      'res://tests/replays/combat_capture_swallow_goal.json',
      '--out',
      'user://combat_capture_swallow_goal.ndjson',
    ];

if (!existsSync(join(godotRoot, 'project.godot'))) {
  console.error('[godot:replay] Missing canonical Godot project at godot/project.godot');
  process.exit(1);
}

const version = spawnSync('godot', ['--version'], { encoding: 'utf8' });
if (version.error?.code === 'ENOENT') {
  console.log('[godot:replay] Godot is not installed; skipped headless replay.');
  process.exit(0);
}

const result = spawnSync(
  'godot',
  ['--path', godotRoot, '--headless', '--script', 'tests/run_replay.gd', '--', ...replayArgs],
  {
    encoding: 'utf8',
    stdio: 'inherit',
  },
);

if (result.error) {
  console.error(`[godot:replay] ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 0);
