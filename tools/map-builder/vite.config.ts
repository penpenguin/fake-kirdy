import react from '@vitejs/plugin-react';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { defineConfig, type Plugin } from 'vite';
import { parseAuthoredSceneRoom, patchAuthoredSceneRoom } from './src/domain/godotTscnRoom';
import type { AuthoredScenesSource, CatalogLevel, LevelCatalogSource, StageDefinition, StageManifest } from './src/domain/project';

const execFileAsync = promisify(execFile);
const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(currentDir, '..', '..');

type CommandResult = {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
};

type SaveRequest = {
  stageManifest?: unknown;
  proceduralLevelOverrides?: unknown;
  authoredScenes?: AuthoredScenesSource;
  uiState?: unknown;
  runChecks?: boolean;
};

const jsonPaths = {
  stageManifest: join(repoRoot, 'godot', 'levels', 'stage_manifest.json'),
  catalogSource: join(repoRoot, 'godot', 'levels', 'level_catalog.source.json'),
  proceduralLevels: join(repoRoot, 'godot', 'levels', 'generated', 'procedural_levels.json'),
  proceduralLevelOverrides: join(repoRoot, 'godot', 'levels', 'generated', 'procedural_level_overrides.source.json'),
  uiState: join(repoRoot, 'godot', 'levels', 'map_builder.ui.json'),
};

export default defineConfig({
  root: currentDir,
  plugins: [
    react(),
    mapBuilderApiPlugin(),
  ],
  build: {
    outDir: resolve(repoRoot, 'dist', 'map-builder'),
    emptyOutDir: true,
  },
});

function mapBuilderApiPlugin(): Plugin {
  return {
    name: 'fake-kirdy-map-builder-api',
    configureServer(server) {
      server.middlewares.use('/api/map-builder/project', async (request, response, next) => {
        if (request.method !== 'GET') {
          next();
          return;
        }

        try {
          const stageManifest = await readJson(jsonPaths.stageManifest) as StageManifest;
          const catalogSource = await readJson(jsonPaths.catalogSource) as LevelCatalogSource;
          sendJson(response, 200, {
            stageManifest,
            catalogSource,
            proceduralLevels: await readJson(jsonPaths.proceduralLevels),
            proceduralLevelOverrides: await readJsonOrDefault(jsonPaths.proceduralLevelOverrides, { version: 1, levels: {} }),
            authoredScenes: await readAuthoredScenes(stageManifest, catalogSource),
            uiState: await readJsonOrDefault(jsonPaths.uiState, {
              version: 1,
              nodes: {},
              viewport: { x: 0, y: 0, zoom: 0.85 },
            }),
          });
        } catch (error) {
          sendJson(response, 500, errorPayload(error));
        }
      });

      server.middlewares.use('/api/map-builder/save', async (request, response, next) => {
        if (request.method !== 'POST') {
          next();
          return;
        }

        try {
          const body = JSON.parse(await readBody(request)) as SaveRequest;
          await writeJson(jsonPaths.stageManifest, body.stageManifest);
          await writeJson(jsonPaths.proceduralLevelOverrides, body.proceduralLevelOverrides);
          await writeAuthoredScenes(body.authoredScenes, body.stageManifest as StageManifest | undefined);
          await writeJson(jsonPaths.uiState, body.uiState);

          const commands = body.runChecks === false
            ? []
            : [
                ['npm', ['run', 'godot:procedural-levels']],
                ['npm', ['run', 'godot:catalog']],
                ['npm', ['run', 'godot:content-check']],
                ['npm', ['run', 'godot:scene-lint']],
                ['npm', ['run', 'godot:level-graph']],
              ] as const;
          const commandResults: CommandResult[] = [];

          for (const [command, args] of commands) {
            commandResults.push(await runCommand(command, args));
          }

          sendJson(response, commandResults.some((result) => result.exitCode !== 0) ? 422 : 200, {
            ok: commandResults.every((result) => result.exitCode === 0),
            commandResults,
          });
        } catch (error) {
          sendJson(response, 500, errorPayload(error));
        }
      });
    },
  };
}

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function readJsonOrDefault(filePath: string, fallback: unknown): Promise<unknown> {
  if (!existsSync(filePath)) {
    return fallback;
  }
  return readJson(filePath);
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function readAuthoredScenes(stageManifest: StageManifest, catalogSource: LevelCatalogSource): Promise<AuthoredScenesSource> {
  const stagesById = new Map(stageManifest.stages.map((stage) => [stage.id, stage]));
  const scenes = [];

  for (const level of catalogSource.levels) {
    if (!isLevelScene(level)) {
      continue;
    }
    const scenePath = godotPathToRepoPath(level.scene_path);
    scenes.push(parseAuthoredSceneRoom({
      catalogLevel: level,
      stage: level.stage_id === undefined ? undefined : stagesById.get(level.stage_id),
      sceneText: await readFile(scenePath, 'utf8'),
    }));
  }

  return {
    version: 1,
    scenes,
  };
}

async function writeAuthoredScenes(authoredScenes: AuthoredScenesSource | undefined, stageManifest: StageManifest | undefined): Promise<void> {
  if (authoredScenes === undefined) {
    return;
  }

  const stagesById = new Map((stageManifest?.stages ?? []).map((stage) => [stage.id, stage]));
  for (const scene of authoredScenes.scenes) {
    if (!isLevelScene(scene)) {
      continue;
    }
    const scenePath = godotPathToRepoPath(scene.scene_path);
    const currentText = await readFile(scenePath, 'utf8');
    const currentRoom = parseAuthoredSceneRoom({
      catalogLevel: scene,
      stage: scene.stage_id === undefined ? undefined : stagesById.get(scene.stage_id),
      sceneText: currentText,
    });
    if (JSON.stringify(currentRoom.runtime_layout) === JSON.stringify(scene.runtime_layout)) {
      continue;
    }
    await writeFile(scenePath, patchAuthoredSceneRoom(currentText, scene));
  }
}

function isLevelScene(level: Pick<CatalogLevel, 'scene_path'>): boolean {
  return level.scene_path.startsWith('res://levels/') && level.scene_path.endsWith('.tscn');
}

function godotPathToRepoPath(path: string): string {
  if (!path.startsWith('res://')) {
    throw new Error(`Only res:// paths are supported by the map builder: ${path}`);
  }
  return join(repoRoot, 'godot', path.slice('res://'.length));
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function runCommand(command: string, args: readonly string[]): Promise<CommandResult> {
  try {
    const result = await execFileAsync(command, [...args], {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 8,
    });

    return {
      command: [command, ...args].join(' '),
      exitCode: 0,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } catch (error) {
    const failed = error as NodeJS.ErrnoException & {
      stdout?: string;
      stderr?: string;
      code?: number;
    };

    return {
      command: [command, ...args].join(' '),
      exitCode: typeof failed.code === 'number' ? failed.code : 1,
      stdout: failed.stdout ?? '',
      stderr: failed.stderr ?? failed.message,
    };
  }
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
}

function errorPayload(error: unknown): { ok: false; error: string } {
  return {
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  };
}
