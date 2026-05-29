import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = process.cwd();
const packageJson = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
const scripts = packageJson.scripts ?? {};
const dependencies = packageJson.dependencies ?? {};
const devDependencies = packageJson.devDependencies ?? {};

const legacyCommands = [];
const legacyDependencies = ['matter-js', 'phaser', 'vite'].filter(
  (dependencyName) => dependencies[dependencyName] || devDependencies[dependencyName],
);
const legacySourceDirs = ['legacy/phaser-reference/src', 'legacy/phaser-reference/public'].filter((directoryName) =>
  existsSync(join(repoRoot, directoryName)),
);
const legacyConfigFiles = ['legacy/phaser-reference/index.html', 'legacy/phaser-reference/vite.config.ts'].filter((fileName) =>
  existsSync(join(repoRoot, fileName)),
);

const inventory = {
  canonical_runtime: 'godot',
  canonical_project_dir: 'godot',
  legacy_runtime: {
    status: 'removed from canonical repository',
    required_by_canonical_runtime: false,
    source_dirs: legacySourceDirs,
    config_files: legacyConfigFiles,
    commands: legacyCommands,
    dependencies: legacyDependencies,
  },
  retirement_gates: [
    'canonical replay suite passes',
    'Godot export or export-template skip is documented',
    'legacy migration decision recorded',
    'Phaser reference behavior is ported or explicitly deprecated',
    'root Phaser/Vite dependencies removed',
  ],
};

process.stdout.write(`${JSON.stringify(inventory, null, 2)}\n`);
