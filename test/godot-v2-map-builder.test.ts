import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { updateRuntimeContent, updateRuntimeLayoutSection } from '../tools/map-builder/src/domain/applyRoomEdits';
import { applyNodePosition, applyStagePatch, applyViewport, upsertNeighbor } from '../tools/map-builder/src/domain/applyWorldGraphEdits';
import { buildWorldGraph } from '../tools/map-builder/src/domain/buildWorldGraph';
import { parseAuthoredSceneRoom, patchAuthoredSceneRoom } from '../tools/map-builder/src/domain/godotTscnRoom';
import { layoutWorldGraph, worldGraphLayoutNodeSize } from '../tools/map-builder/src/domain/layoutWorldGraph';
import { normalizeBuilderProject } from '../tools/map-builder/src/domain/loadGodotProject';
import { dragRoomObjectPosition, resizeRoomObject } from '../tools/map-builder/src/domain/roomCanvasInteraction';
import { buildRoomOptions } from '../tools/map-builder/src/domain/roomIndex';
import type { BuilderProject, CatalogLevel, StageDefinition } from '../tools/map-builder/src/domain/project';
import { validateBuilderProject } from '../tools/map-builder/src/domain/validateBuilderProject';

const repoRoot = join(__dirname, '..');

describe('Godot map builder local tool boundary', () => {
  it('declares local map builder commands and React Flow dependencies without Phaser runtime dependencies', () => {
    const packageJson = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(packageJson.scripts?.['map:builder']).toBe('vite --config tools/map-builder/vite.config.ts');
    expect(packageJson.scripts?.['map:builder:check']).toBe('node tools/map-builder/scripts/check-map-builder-source.mjs');
    expect(packageJson.scripts?.['map:builder:build']).toBe('vite build --config tools/map-builder/vite.config.ts');

    expect(packageJson.dependencies?.['@xyflow/react']).toBeDefined();
    expect(packageJson.dependencies?.elkjs).toBeDefined();
    expect(packageJson.dependencies?.react).toBeDefined();
    expect(packageJson.dependencies?.['react-dom']).toBeDefined();
    expect(packageJson.dependencies?.zod).toBeDefined();
    expect(packageJson.devDependencies?.vite).toBeDefined();
    expect(packageJson.devDependencies?.['@vitejs/plugin-react']).toBeDefined();
    expect(packageJson.devDependencies?.['@types/react']).toBeDefined();
    expect(packageJson.devDependencies?.['@types/react-dom']).toBeDefined();

    expect(packageJson.dependencies?.phaser).toBeUndefined();
    expect(packageJson.dependencies?.['matter-js']).toBeUndefined();
  });

  it('contains a Vite React scaffold isolated under tools/map-builder', () => {
    const expectedFiles = [
      'tools/map-builder/index.html',
      'tools/map-builder/vite.config.ts',
      'tools/map-builder/tsconfig.json',
      'tools/map-builder/scripts/check-map-builder-source.mjs',
      'tools/map-builder/src/App.tsx',
      'tools/map-builder/src/main.tsx',
      'tools/map-builder/src/domain/project.ts',
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
    ];

    for (const relativePath of expectedFiles) {
      expect(existsSync(join(repoRoot, relativePath)), `${relativePath} should exist`).toBe(true);
    }
  });

  it('loads Godot level data into a React Flow world graph with authored, generated, and dynamic topology markers', () => {
    const project = loadCurrentBuilderProject();
    const graph = buildWorldGraph(project, validateBuilderProject(project));
    const centralHub = graph.nodes.find((node) => node.id === 'central-hub');
    const generatedRoom = graph.nodes.find((node) => node.id === 'labyrinth-010');
    const dynamicNode = graph.nodes.find((node) => node.id.startsWith('dynamic:cave-area:'));
    const staticEdge = graph.edges.find((edge) => edge.id === 'central-hub:north:mirror-corridor');
    const dynamicEdge = graph.edges.find((edge) => edge.id === 'cave-area:dynamic:north');

    expect(centralHub?.type).toBe('stage');
    expect(centralHub?.data).toMatchObject({
      stageId: 'central-hub',
      godotId: 'central_hub',
      origin: 'authored',
      cluster: 'hub',
      difficulty: 1,
      doorCount: 5,
    });
    expect(generatedRoom?.data).toMatchObject({
      stageId: 'labyrinth-010',
      godotId: 'labyrinth_010',
      origin: 'generated_schema',
      cluster: 'ice',
    });
    expect(dynamicNode?.data.origin).toBe('dynamic');
    expect(staticEdge?.label).toBe('north');
    expect(dynamicEdge?.animated).toBe(true);
    expect(String(dynamicEdge?.style?.strokeDasharray)).toContain('6');
  });

  it('applies world graph edits to stage_manifest drafts and stores React Flow viewport data outside runtime stage data', () => {
    const project = loadCurrentBuilderProject();
    const patchedManifest = applyStagePatch(project.stageManifest, 'forest-area', {
      name: 'Forest Area Draft',
      cluster: 'forest',
      difficulty: 2,
      index: 101,
      layout: {
        rows: 9,
        columns: 28,
        tile_size: 32,
      },
    });
    const withNeighbor = upsertNeighbor(patchedManifest, 'forest-area', 'east', 'labyrinth-001');
    const nextUi = applyViewport(
      applyNodePosition(project.uiState, 'forest-area', { x: 120, y: 240 }),
      { x: -20, y: 44, zoom: 0.7 },
    );
    const forestArea = withNeighbor.stages.find((stage) => stage.id === 'forest-area');

    expect(forestArea).toMatchObject({
      name: 'Forest Area Draft',
      layout: {
        rows: 9,
        columns: 28,
        tile_size: 32,
      },
      metadata: {
        cluster: 'forest',
        difficulty: 2,
        index: 101,
      },
      neighbors: {
        east: 'labyrinth-001',
      },
    });
    expect(forestArea).not.toHaveProperty('position');
    expect(nextUi.nodes['forest-area']).toEqual({ x: 120, y: 240 });
    expect(nextUi.viewport).toEqual({ x: -20, y: 44, zoom: 0.7 });
  });

  it('auto-layouts the world graph into deterministic non-overlapping UI positions without editing runtime topology', async () => {
    const project = loadCurrentBuilderProject();
    const centralHubNeighbors = project.stageManifest.stages.find((stage) => stage.id === 'central-hub')?.neighbors;
    const graph = buildWorldGraph({
      ...project,
      uiState: {
        ...project.uiState,
        nodes: {},
      },
    }, validateBuilderProject(project));
    const nextUi = await layoutWorldGraph(graph, project.uiState);
    const repeatedUi = await layoutWorldGraph(graph, project.uiState);
    const nodeIds = graph.nodes.map((node) => node.id);

    expect(Object.keys(nextUi.nodes).sort()).toEqual([...nodeIds].sort());
    expect(nextUi.nodes).toEqual(repeatedUi.nodes);
    expect(nextUi.viewport).toEqual(project.uiState.viewport);

    for (let index = 0; index < nodeIds.length; index += 1) {
      for (let otherIndex = index + 1; otherIndex < nodeIds.length; otherIndex += 1) {
        const left = nextUi.nodes[nodeIds[index]];
        const right = nextUi.nodes[nodeIds[otherIndex]];
        const overlapsHorizontally = Math.abs(left.x - right.x) < worldGraphLayoutNodeSize.width;
        const overlapsVertically = Math.abs(left.y - right.y) < worldGraphLayoutNodeSize.height;

        expect(overlapsHorizontally && overlapsVertically, `${nodeIds[index]} should not overlap ${nodeIds[otherIndex]}`).toBe(false);
      }
    }

    expect(project.stageManifest.stages.find((stage) => stage.id === 'central-hub')?.neighbors).toEqual(centralHubNeighbors);
  }, 15000);

  it('validates generated room override drafts for safe door rings, missing spawns, and duplicate content ids', () => {
    const project = loadCurrentBuilderProject();
    const level = project.proceduralLevels.levels.find((candidate) => candidate.stage_id === 'labyrinth-010');
    expect(level).toBeDefined();

    const baseContent = level?.runtime_layout.content ?? {};
    const unsafeOverrides = updateRuntimeContent(project.proceduralLevelOverrides, level!, {
      ...baseContent,
      enemies: [
        {
          id: 'BuilderDuplicateMarker',
          spawn_id: 'builder_duplicate_enemy',
          enemy_type: 'generated_ground',
          ability_type: 'leaf',
          position: level?.runtime_layout.doors?.east,
        },
        {
          id: 'BuilderDuplicateMarker',
          spawn_id: 'builder_duplicate_enemy_2',
          enemy_type: 'generated_ground',
          ability_type: 'leaf',
          position: level?.runtime_layout.doors?.east,
        },
      ],
    });
    const missingSpawnOverrides = updateRuntimeLayoutSection(unsafeOverrides, 'labyrinth-010', 'spawns', {
      default: { x: 96, y: 368 },
      east: { x: 624, y: 368 },
    });
    const issues = validateBuilderProject({
      ...project,
      proceduralLevelOverrides: missingSpawnOverrides,
    }).map((issue) => issue.message);

    expect(issues).toEqual(expect.arrayContaining([
      'Duplicate content id BuilderDuplicateMarker.',
      'Missing west spawn for east neighbor.',
      'Content marker BuilderDuplicateMarker is inside a 96px door safe radius.',
    ]));
  });

  it('builds a Room Editor list that includes generated, authored stage, and catalog-only scenes', () => {
    const project = loadCurrentBuilderProject();
    const rooms = buildRoomOptions(project);
    const roomKeys = rooms.map((room) => room.key);

    expect(roomKeys).toContain('generated:labyrinth-010');
    expect(roomKeys).toContain('authored:central_hub');
    expect(roomKeys).toContain('authored:ice_area');
    expect(roomKeys).toContain('authored:tutorial_room');
    expect(roomKeys).toContain('authored:labyrinth_001');
    expect(rooms.find((room) => room.key === 'authored:central_hub')).toMatchObject({
      source: 'authored_scene',
      id: 'central_hub',
      stageId: 'central-hub',
      scenePath: 'res://levels/central_hub.tscn',
    });
  });

  it('parses authored .tscn rooms into editable runtime layouts', () => {
    const catalogLevel = loadCurrentBuilderProject().catalogSource.levels.find((level) => level.id === 'central_hub');
    expect(catalogLevel).toBeDefined();

    const room = parseAuthoredSceneRoom({
      catalogLevel: catalogLevel!,
      stage: loadCurrentBuilderProject().stageManifest.stages.find((stage) => stage.id === 'central-hub'),
      sceneText: readFileSync(join(repoRoot, 'godot', 'levels', 'central_hub.tscn'), 'utf8'),
    });

    expect(room).toMatchObject({
      id: 'central_hub',
      stage_id: 'central-hub',
      scene_path: 'res://levels/central_hub.tscn',
      source: 'authored_scene',
      runtime_layout: {
        camera_bounds: {
          position: { x: expect.any(Number), y: expect.any(Number) },
          size: { x: expect.any(Number), y: expect.any(Number) },
        },
      },
    });
    expect(room.runtime_layout.spawns?.default).toEqual({ x: expect.any(Number), y: expect.any(Number) });
    expect(room.runtime_layout.doors?.hub_to_ice_area).toEqual({ x: expect.any(Number), y: expect.any(Number) });
    expect(room.runtime_layout.floor_segments).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'Floor', position: expect.any(Object), size: expect.any(Object) }),
      expect.objectContaining({ id: 'AltarPlatform', position: expect.any(Object), size: expect.any(Object) }),
    ]));
    expect(room.runtime_layout.content?.heals).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'DeadEndHealthMarker', heal_id: 'central_hub_dead_end_health', position: expect.any(Object) }),
    ]));
  });

  it('patches authored .tscn marker and rectangle edits without rewriting generated override data', () => {
    const project = loadCurrentBuilderProject();
    const catalogLevel = project.catalogSource.levels.find((level) => level.id === 'ice_area');
    expect(catalogLevel).toBeDefined();

    const sceneText = readFileSync(join(repoRoot, 'godot', 'levels', 'ice_area.tscn'), 'utf8');
    const room = parseAuthoredSceneRoom({
      catalogLevel: catalogLevel!,
      stage: project.stageManifest.stages.find((stage) => stage.id === 'ice-area'),
      sceneText,
    });
    const nextRoom = {
      ...room,
      runtime_layout: {
        ...room.runtime_layout,
        spawns: {
          ...(room.runtime_layout.spawns ?? {}),
          default: { x: 128, y: 360 },
        },
        doors: {
          ...(room.runtime_layout.doors ?? {}),
          ice_area_to_central_hub: { x: 640, y: 360 },
        },
        camera_bounds: {
          position: { x: 390, y: 180 },
          size: { x: 860, y: 520 },
        },
        floor_segments: [
          {
            id: 'Floor',
            position: { x: 390, y: 430 },
            size: { x: 780, y: 40 },
          },
          {
            id: 'BuilderPlatform1',
            position: { x: 240, y: 320 },
            size: { x: 160, y: 24 },
          },
        ],
        content: {
          ...(room.runtime_layout.content ?? {}),
          enemies: [
            ...((room.runtime_layout.content?.enemies ?? []) as Array<Record<string, unknown>>),
            {
              id: 'BuilderEnemySpawn1',
              spawn_id: 'builder_enemy_spawn_1',
              enemy_type: 'frost_flyer',
              ability_type: 'frost',
              position: { x: 260, y: 360 },
            },
          ],
        },
      },
    };
    const patched = patchAuthoredSceneRoom(sceneText, nextRoom);

    expect(patched).toContain('position = Vector2(128, 360)');
    expect(patched).toContain('door_id = "ice_area_to_central_hub"');
    expect(patched).toContain('position = Vector2(640, 360)');
    expect(patched).toContain('size = Vector2(860, 520)');
    expect(patched).toContain('[node name="BuilderPlatform1" type="StaticBody2D" parent="."]');
    expect(patched).toContain('[node name="BuilderEnemySpawn1" type="Node2D" parent="."]');
    expect(patched.indexOf('[sub_resource type="RectangleShape2D" id="RectangleShape2D_BuilderPlatform1"]')).toBeLessThan(patched.indexOf('[node name='));
    expect(project.proceduralLevelOverrides.levels).toEqual({});
  });

  it('keeps later authored .tscn node edits inside their own node after inserting missing marker properties', () => {
    const sceneText = [
      '[gd_scene load_steps=3 format=3]',
      '',
      '[ext_resource type="Script" path="res://scripts/level/markers/AbilityGateMarker.gd" id="1_gate"]',
      '[ext_resource type="Script" path="res://scripts/level/markers/HazardMarker.gd" id="2_hazard"]',
      '',
      '[node name="FirstGate" type="Node2D" parent="."]',
      'position = Vector2(100, 200)',
      'script = ExtResource("1_gate")',
      'gate_id = "gate_a"',
      '',
      '[node name="SecondHazard" type="Node2D" parent="."]',
      'position = Vector2(300, 200)',
      'script = ExtResource("2_hazard")',
      'hazard_id = "hazard_b"',
      'hazard_type = "spike"',
      '',
    ].join('\n');
    const room = parseAuthoredSceneRoom({
      catalogLevel: {
        id: 'fixture_room',
        scene_path: 'res://levels/fixture_room.tscn',
        stage_id: 'fixture-room',
      },
      sceneText,
    });
    const patched = patchAuthoredSceneRoom(sceneText, {
      ...room,
      runtime_layout: {
        ...room.runtime_layout,
        content: {
          ability_gates: [
            {
              id: 'FirstGate',
              gate_id: 'gate_a',
              required_ability_type: 'fire',
              gate_effect: 'melt_ice',
              gate_texture_path: 'res://resources/assets/images/ui/ability-gate-fire.webp',
              position: { x: 100, y: 200 },
            },
          ],
          hazards: [
            {
              id: 'SecondHazard',
              hazard_id: 'hazard_b',
              hazard_type: 'lava',
              position: { x: 320, y: 210 },
            },
          ],
        },
      },
    });

    const firstGateBlock = patched.slice(
      patched.indexOf('[node name="FirstGate"'),
      patched.indexOf('[node name="SecondHazard"'),
    );
    const secondHazardBlock = patched.slice(patched.indexOf('[node name="SecondHazard"'));

    expect(firstGateBlock).toContain('required_ability_type = "fire"');
    expect(firstGateBlock).toContain('gate_effect = "melt_ice"');
    expect(firstGateBlock).not.toContain('hazard_type = "lava"');
    expect(secondHazardBlock).toContain('position = Vector2(320, 210)');
    expect(secondHazardBlock).toContain('hazard_type = "lava"');
    expect(secondHazardBlock).not.toContain('hazard_type = "spike"');
  });

  it('reuses authored .tscn content markers by semantic id when the room editor id changes', () => {
    const sceneText = [
      '[gd_scene load_steps=2 format=3]',
      '',
      '[ext_resource type="Script" path="res://scripts/level/markers/HazardMarker.gd" id="1_hazard"]',
      '',
      '[node name="OldHazardNode" type="Node2D" parent="."]',
      'position = Vector2(300, 200)',
      'script = ExtResource("1_hazard")',
      'hazard_id = "hazard_b"',
      'hazard_type = "spike"',
      '',
    ].join('\n');
    const room = parseAuthoredSceneRoom({
      catalogLevel: {
        id: 'fixture_room',
        scene_path: 'res://levels/fixture_room.tscn',
      },
      sceneText,
    });
    const patched = patchAuthoredSceneRoom(sceneText, {
      ...room,
      runtime_layout: {
        ...room.runtime_layout,
        content: {
          hazards: [
            {
              id: 'RenamedHazardNode',
              hazard_id: 'hazard_b',
              hazard_type: 'lava',
              position: { x: 320, y: 210 },
            },
          ],
        },
      },
    });

    expect(patched).toContain('[node name="OldHazardNode" type="Node2D" parent="."]');
    expect(patched).not.toContain('[node name="RenamedHazardNode" type="Node2D" parent="."]');
    expect(patched.match(/hazard_id = "hazard_b"/g)).toHaveLength(1);
    expect(patched).toContain('position = Vector2(320, 210)');
    expect(patched).toContain('hazard_type = "lava"');
    expect(patched).not.toContain('hazard_type = "spike"');
  });

  it('removes authored .tscn supported markers when they are removed from the room layout', () => {
    const project = loadCurrentBuilderProject();
    const catalogLevel = project.catalogSource.levels.find((level) => level.id === 'ice_area');
    expect(catalogLevel).toBeDefined();

    const sceneText = readFileSync(join(repoRoot, 'godot', 'levels', 'ice_area.tscn'), 'utf8');
    const room = parseAuthoredSceneRoom({
      catalogLevel: catalogLevel!,
      stage: project.stageManifest.stages.find((stage) => stage.id === 'ice-area'),
      sceneText,
    });
    const patched = patchAuthoredSceneRoom(sceneText, {
      ...room,
      runtime_layout: {
        ...room.runtime_layout,
        content: {
          ...(room.runtime_layout.content ?? {}),
          enemies: [],
        },
      },
    });

    expect(patched).not.toContain('[node name="EnemySpawnMarker" type="Node2D" parent="."]');
  });

  it('converts room canvas pointer drags into snapped and unsnapped Godot room coordinates', () => {
    const canvasRect = { left: 100, top: 50, width: 760, height: 432 };
    const roomSize = { width: 760, height: 432 };
    const startPointer = { x: 196, y: 418 };
    const currentPointer = { x: 221, y: 441 };

    expect(dragRoomObjectPosition({
      startPosition: { x: 96, y: 368 },
      startPointer,
      currentPointer,
      canvasRect,
      roomSize,
      snapSize: 8,
      snap: true,
    })).toEqual({ x: 120, y: 392 });

    expect(dragRoomObjectPosition({
      startPosition: { x: 96, y: 368 },
      startPointer,
      currentPointer,
      canvasRect,
      roomSize,
      snapSize: 8,
      snap: false,
    })).toEqual({ x: 121, y: 391 });
  });

  it('keeps dragged room rectangles and resized surfaces inside room bounds', () => {
    const canvasRect = { left: 100, top: 50, width: 760, height: 432 };
    const roomSize = { width: 760, height: 432 };

    expect(dragRoomObjectPosition({
      startPosition: { x: 240, y: 320 },
      objectSize: { x: 160, y: 40 },
      startPointer: { x: 340, y: 370 },
      currentPointer: { x: -200, y: -200 },
      canvasRect,
      roomSize,
      snapSize: 8,
      snap: true,
    })).toEqual({ x: 80, y: 20 });

    expect(resizeRoomObject({
      position: { x: 240, y: 320 },
      startSize: { x: 160, y: 24 },
      startPointer: { x: 340, y: 370 },
      currentPointer: { x: 377, y: 388 },
      canvasRect,
      roomSize,
      snapSize: 8,
      snap: true,
    })).toEqual({ x: 200, y: 40 });

    expect(resizeRoomObject({
      position: { x: 720, y: 400 },
      startSize: { x: 80, y: 80 },
      startPointer: { x: 720, y: 400 },
      currentPointer: { x: 980, y: 640 },
      canvasRect,
      roomSize,
      snapSize: 8,
      snap: true,
    })).toEqual({ x: 80, y: 64 });
  });
});

function loadCurrentBuilderProject(): BuilderProject {
  const stageManifest = JSON.parse(readFileSync(join(repoRoot, 'godot', 'levels', 'stage_manifest.json'), 'utf8')) as BuilderProject['stageManifest'];
  const catalogSource = JSON.parse(readFileSync(join(repoRoot, 'godot', 'levels', 'level_catalog.source.json'), 'utf8')) as BuilderProject['catalogSource'];
  const stagesById = new Map<string, StageDefinition>(stageManifest.stages.map((stage) => [stage.id, stage]));
  return normalizeBuilderProject({
    stageManifest,
    catalogSource,
    proceduralLevels: JSON.parse(readFileSync(join(repoRoot, 'godot', 'levels', 'generated', 'procedural_levels.json'), 'utf8')),
    proceduralLevelOverrides: JSON.parse(readFileSync(join(repoRoot, 'godot', 'levels', 'generated', 'procedural_level_overrides.source.json'), 'utf8')),
    uiState: JSON.parse(readFileSync(join(repoRoot, 'godot', 'levels', 'map_builder.ui.json'), 'utf8')),
    authoredScenes: {
      version: 1,
      scenes: catalogSource.levels
        .filter((level) => level.scene_path.startsWith('res://levels/') && level.scene_path.endsWith('.tscn'))
        .map((level: CatalogLevel) => parseAuthoredSceneRoom({
          catalogLevel: level,
          stage: level.stage_id === undefined ? undefined : stagesById.get(level.stage_id),
          sceneText: readFileSync(join(repoRoot, level.scene_path.replace('res://', 'godot/')), 'utf8'),
        })),
    },
  });
}
