import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const toolRoot = join(currentDir, '..');
const repoRoot = join(toolRoot, '..', '..');

const requiredFiles = [
  'tools/map-builder/index.html',
  'tools/map-builder/vite.config.ts',
  'tools/map-builder/tsconfig.json',
  'tools/map-builder/src/App.tsx',
  'tools/map-builder/src/main.tsx',
  'tools/map-builder/src/domain/project.ts',
  'tools/map-builder/src/domain/ids.ts',
  'tools/map-builder/src/domain/loadGodotProject.ts',
  'tools/map-builder/src/domain/buildWorldGraph.ts',
  'tools/map-builder/src/domain/layoutWorldGraph.ts',
  'tools/map-builder/src/domain/godotTscnRoom.ts',
  'tools/map-builder/src/domain/roomIndex.ts',
  'tools/map-builder/src/domain/roomCanvasInteraction.ts',
  'tools/map-builder/src/domain/applyWorldGraphEdits.ts',
  'tools/map-builder/src/domain/applyRoomEdits.ts',
  'tools/map-builder/src/domain/validateBuilderProject.ts',
  'tools/map-builder/src/ui/WorldGraph.tsx',
  'tools/map-builder/src/ui/StageNode.tsx',
  'tools/map-builder/src/ui/StageInspector.tsx',
  'tools/map-builder/src/ui/RoomEditor.tsx',
  'tools/map-builder/src/ui/RoomCanvas.tsx',
  'tools/map-builder/src/ui/ObjectPalette.tsx',
  'tools/map-builder/src/ui/ValidationPanel.tsx',
  'tools/map-builder/src/ui/GeneratedPreview.tsx',
  'godot/levels/map_builder.ui.json',
  'godot/levels/generated/procedural_level_overrides.source.json',
];

for (const relativePath of requiredFiles) {
  if (!existsSync(join(repoRoot, relativePath))) {
    throw new Error(`[map:builder:check] missing ${relativePath}`);
  }
}

const packageJson = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
const scripts = packageJson.scripts ?? {};
const dependencies = packageJson.dependencies ?? {};
const devDependencies = packageJson.devDependencies ?? {};

assertEqual(scripts['map:builder'], 'vite --config tools/map-builder/vite.config.ts', 'map:builder script');
assertEqual(scripts['map:builder:check'], 'node tools/map-builder/scripts/check-map-builder-source.mjs', 'map:builder:check script');
assertEqual(scripts['map:builder:build'], 'vite build --config tools/map-builder/vite.config.ts', 'map:builder:build script');

for (const dependencyName of ['@xyflow/react', 'elkjs', 'react', 'react-dom', 'zod']) {
  if (dependencies[dependencyName] === undefined) {
    throw new Error(`[map:builder:check] missing dependency ${dependencyName}`);
  }
}

for (const dependencyName of ['vite', '@vitejs/plugin-react', '@types/react', '@types/react-dom']) {
  if (devDependencies[dependencyName] === undefined) {
    throw new Error(`[map:builder:check] missing devDependency ${dependencyName}`);
  }
}

for (const forbiddenDependency of ['phaser', 'matter-js']) {
  if (dependencies[forbiddenDependency] !== undefined || devDependencies[forbiddenDependency] !== undefined) {
    throw new Error(`[map:builder:check] forbidden legacy dependency ${forbiddenDependency}`);
  }
}

const worldGraphSource = readFileSync(join(toolRoot, 'src', 'ui', 'WorldGraph.tsx'), 'utf8');
if (!worldGraphSource.includes('@xyflow/react')) {
  throw new Error('[map:builder:check] WorldGraph must use @xyflow/react');
}

const uiState = JSON.parse(readFileSync(join(repoRoot, 'godot', 'levels', 'map_builder.ui.json'), 'utf8'));
if (uiState.version !== 1 || typeof uiState.nodes !== 'object' || uiState.nodes === null) {
  throw new Error('[map:builder:check] invalid map_builder.ui.json');
}

const overrides = JSON.parse(readFileSync(join(repoRoot, 'godot', 'levels', 'generated', 'procedural_level_overrides.source.json'), 'utf8'));
if (overrides.version !== 1 || typeof overrides.levels !== 'object' || overrides.levels === null || Array.isArray(overrides.levels)) {
  throw new Error('[map:builder:check] invalid procedural_level_overrides.source.json');
}

execFileSync(process.execPath, [
  join(repoRoot, 'node_modules', 'typescript', 'lib', 'tsc.js'),
  '-p',
  join(toolRoot, 'tsconfig.json'),
  '--noEmit',
], {
  cwd: repoRoot,
  stdio: 'inherit',
});

console.log('[map:builder:check] map builder source is valid.');

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`[map:builder:check] expected ${label} to be ${expected}`);
  }
}
