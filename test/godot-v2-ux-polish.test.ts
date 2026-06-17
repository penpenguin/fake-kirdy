import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, '..');
const godotRoot = join(repoRoot, 'godot');

const readGodotFile = (relativePath: string): string =>
  readFileSync(join(godotRoot, relativePath), 'utf8');

const readRepoFile = (relativePath: string): string =>
  readFileSync(join(repoRoot, relativePath), 'utf8');

const readLevelScenes = (): Array<{ fileName: string; source: string }> =>
  readdirSync(join(godotRoot, 'levels'))
    .filter((fileName) => fileName.endsWith('.tscn'))
    .sort()
    .map((fileName) => ({
      fileName,
      source: readGodotFile(`levels/${fileName}`),
    }));

const extractDoorBlocks = (source: string): Array<{ nodeName: string; block: string }> => {
  const doorResourceIds = [...source.matchAll(/path="res:\/\/scripts\/level\/markers\/DoorMarker\.gd" id="([^"]+)"/g)]
    .map((match) => match[1]);
  const nodeBlocks = [...source.matchAll(/\[node name="([^"]+)"[^\]]*\][\s\S]*?(?=\n\[node |$)/g)];

  return nodeBlocks
    .map((match) => ({ nodeName: match[1], block: match[0] }))
    .filter(({ block }) => doorResourceIds.some((resourceId) => block.includes(`script = ExtResource("${resourceId}")`)));
};

const readSceneStringProp = (block: string, propName: string): string => {
  const match = block.match(new RegExp(`^${propName} = "([^"]*)"`, 'm'));
  return match?.[1] ?? '';
};

const readNodePosition = (scene: string, nodeName: string): { x: number; y: number } => {
  const nodeStart = scene.indexOf(`[node name="${nodeName}"`);
  expect(nodeStart).toBeGreaterThanOrEqual(0);
  const nextNode = scene.indexOf('\n[node ', nodeStart + 1);
  const nodeBlock = scene.slice(nodeStart, nextNode === -1 ? undefined : nextNode);
  const match = nodeBlock.match(/position = Vector2\(([-0-9.]+), ([-0-9.]+)\)/);
  expect(match).not.toBeNull();
  return {
    x: Number(match?.[1]),
    y: Number(match?.[2]),
  };
};

describe('Godot v2 UX polish vertical slice', () => {
  it('shows operation help as a dismissible initial popup and exposes controls from pause', () => {
    const guideScript = readGodotFile('scripts/ui/ControlGuideOverlay.gd');
    const guideScene = readGodotFile('scenes/ui/ControlGuideOverlay.tscn');
    const pauseScript = readGodotFile('scripts/ui/PauseOverlay.gd');
    const pauseScene = readGodotFile('scenes/ui/PauseScene.tscn');
    const session = readGodotFile('scripts/session/GameSession.gd');

    expect(guideScript).toContain('presentation_mode: String = "initial_popup"');
    expect(guideScript).toContain('func set_guide_state');
    expect(guideScript).toContain('func dismiss');
    expect(guideScript).toContain('guide.dismissed');
    expect(guideScene).toContain('PopupPanel');
    expect(guideScene).toContain('DismissLabel');
    expect(guideScene).not.toMatch(/offset_left\s*=\s*16\.0[\s\S]*offset_top\s*=\s*16\.0/);
    expect(session).toContain('@export var control_guide_dismiss_action');
    expect(session).toContain('check_control_guide_actions()');
    expect(session).toContain('sync_control_guide_overlay("session.started"');
    expect(session).toContain('control.guide.dismissed');

    expect(pauseScript).toContain('controls_help_label');
    expect(pauseScript).toContain('get_controls_help_text');
    expect(pauseScene).toContain('ControlsHelpLabel');
    expect(pauseScene).toContain('Move  A/D');
  });

  it('presents results as a modal popup with a backdrop and continue/restart affordance', () => {
    const resultScript = readGodotFile('scripts/ui/ResultOverlay.gd');
    const resultScene = readGodotFile('scenes/ui/ResultOverlay.tscn');
    const docs = readRepoFile('docs/godot-v2/result-overlay.md');

    expect(resultScript).toContain('popup_backdrop');
    expect(resultScript).toContain('modal_panel');
    expect(resultScript).toContain('continue_label');
    expect(resultScript).toContain('get_continue_text');
    expect(resultScene).toContain('PopupBackdrop');
    expect(resultScene).toContain('ModalPanel');
    expect(resultScene).toContain('ContinueLabel');
    expect(resultScene).toContain('mouse_filter = 1');
    expect(docs).toContain('popup');
    expect(docs).toContain('restart');
  });

  it('removes debug-like tutorial and Hub copy from representative player-facing scenes', () => {
    const tutorial = readGodotFile('levels/tutorial_room.tscn');
    const hub = readGodotFile('levels/central_hub.tscn');

    expect(tutorial).not.toContain('Blue wall: get Spark, press Z');
    expect(tutorial).not.toContain('Hub -> first real stage');
    expect(tutorial).toContain('Storm Wall');
    expect(tutorial).toContain('Copy Spark');
    expect(hub).not.toContain('First stage: Fire Area');
    expect(hub).toContain('Ember Gate');
    expect(hub).toContain('Trial Door');
  });

  it('keeps Spark visually and mechanically distinct from sword/iai presentation', () => {
    const player = readGodotFile('scripts/player/PlayerController.gd');
    const session = readGodotFile('scripts/session/GameSession.gd');
    const assetContract = readGodotFile('tests/asset_fallback_audit_contract.json');
    const combatContract = readGodotFile('tests/combat_matrix_contract.json');

    expect(player).toContain('kirdy_spark_texture');
    expect(player).toContain('"spark":');
    expect(player).not.toContain('"spark", "stone":\n            return kirdy_sword_texture');
    expect(session).toContain('"visual_effect": "electric_burst"');
    expect(session).toContain('"effect_texture": "res://resources/assets/images/effects/spark-attack.webp"');
    expect(session).toContain('ability.attack.visualized');
    expect(assetContract).toContain('"id": "spark"');
    expect(assetContract).toContain('"texture_var": "kirdy_spark_texture"');
    expect(combatContract).toContain('"attack_type": "burst"');
  });

  it('documents at least three distinct early enemy archetypes with visual and behavior differences', () => {
    const combatTest = readGodotFile('tests/combat_matrix_contract.json');
    const arenaContract = readGodotFile('tests/enemy_ai_arena_contract.json');
    const tutorial = readGodotFile('levels/tutorial_room.tscn');
    const docs = readRepoFile('docs/godot-v2/combat-slice.md');

    expect(combatTest).toContain('"ground"');
    expect(combatTest).toContain('"flying"');
    expect(combatTest).toContain('"sentry"');
    expect(arenaContract).toContain('"stone_sentry_return_profile"');
    expect(tutorial).toContain('enemy_type = "spark_wisp"');
    expect(tutorial).toContain('enemy_type = "flying"');
    expect(tutorial).toContain('enemy_type = "sentry"');
    expect(docs).toContain('spark_wisp');
    expect(docs).toContain('sentry');
  });

  it('grants about two seconds of traceable blinking player invulnerability after damage', () => {
    const session = readGodotFile('scripts/session/GameSession.gd');
    const player = readGodotFile('scripts/player/PlayerController.gd');
    const docs = readRepoFile('docs/godot-v2/session-outcomes.md');

    expect(session).toContain('@export var player_invulnerability_ms: int = 2000');
    expect(session).toContain('player.invulnerability.started');
    expect(session).toContain('player.invulnerability.ended');
    expect(session).toContain('sync_player_damage_feedback');
    expect(session).toContain('invulnerability_remaining_ms');
    expect(player).toContain('func set_damage_feedback_state');
    expect(player).toContain('damage_blink_alpha');
    expect(docs).toContain('2000ms');
    expect(docs).toContain('blinking');
  });

  it('classifies and separates Hub doors so nearby visible doors are not ambiguous', () => {
    const hub = readGodotFile('levels/central_hub.tscn');
    const lintScript = readRepoFile('scripts/check-godot-scene-lint.mjs');
    const lintContract = readGodotFile('tests/scene_lint_contract.json');
    const docs = readRepoFile('docs/godot-v2/door-transition-flow.md');

    expect(hub).toContain('door_visual_style = "hub_trial"');
    expect(hub).toContain('door_visual_style = "hub_region"');
    expect(hub).toContain('door_visual_style = "hub_locked"');
    expect(hub).toContain('door_visual_style = "hub_support"');
    expect(hub).toContain('door_label = "Ember Gate"');
    expect(hub).toContain('door_label = "Trial Door"');
    expect(lintScript).toContain('lintNearbyDoorAmbiguity');
    expect(lintContract).toContain('"nearby_door_ambiguity"');
    expect(lintContract).toContain('"central_hub"');
    expect(docs).toContain('door_visual_style');
    expect(docs).toContain('hub_');
    expect(docs).toContain('nearby_door_ambiguity');
  });

  it('marks every Central Hub connected door with a distinct hub visual style', () => {
    const scenes = readLevelScenes();
    const hubConnectedDoors = scenes.flatMap(({ fileName, source }) =>
      extractDoorBlocks(source)
        .filter(({ block }) => fileName === 'central_hub.tscn' || readSceneStringProp(block, 'target_level_id') === 'central_hub')
        .map(({ nodeName, block }) => ({
          fileName,
          nodeName,
          doorId: readSceneStringProp(block, 'door_id'),
          targetLevelId: readSceneStringProp(block, 'target_level_id'),
          visualStyle: readSceneStringProp(block, 'door_visual_style'),
        })),
    );
    const nonHubDoors = scenes.flatMap(({ fileName, source }) =>
      extractDoorBlocks(source)
        .filter(({ block }) => fileName !== 'central_hub.tscn' && readSceneStringProp(block, 'target_level_id') !== 'central_hub')
        .map(({ nodeName, block }) => ({
          fileName,
          nodeName,
          visualStyle: readSceneStringProp(block, 'door_visual_style'),
        })),
    );

    expect(hubConnectedDoors.length).toBeGreaterThanOrEqual(16);
    for (const door of hubConnectedDoors) {
      expect(door.visualStyle, `${door.fileName}:${door.nodeName}:${door.doorId}`).toMatch(/^hub_/);
    }
    expect(nonHubDoors.some((door) => door.visualStyle !== '' && !door.visualStyle.startsWith('hub_'))).toBe(true);
    expect(nonHubDoors.every((door) => !door.visualStyle.startsWith('hub_'))).toBe(true);
  });

  it('renders Central Hub return doors with a dedicated runtime texture instead of the ordinary room door', () => {
    const scenes = readLevelScenes();
    const doorMarker = readGodotFile('scripts/level/markers/DoorMarker.gd');
    const docs = readRepoFile('docs/godot-v2/door-transition-flow.md');
    const centralReturnDoors = scenes.flatMap(({ fileName, source }) =>
      extractDoorBlocks(source)
        .filter(({ block }) => readSceneStringProp(block, 'target_level_id') === 'central_hub')
        .map(({ nodeName, block }) => ({
          fileName,
          nodeName,
          doorId: readSceneStringProp(block, 'door_id'),
          role: readSceneStringProp(block, 'door_role'),
          visualStyle: readSceneStringProp(block, 'door_visual_style'),
          requiredItemId: readSceneStringProp(block, 'required_item_id'),
          requiredBossId: readSceneStringProp(block, 'required_boss_id'),
        })),
    );
    const unlockedHubReturns = centralReturnDoors.filter((door) => door.visualStyle === 'hub_return');

    expect(centralReturnDoors.map((door) => `${door.fileName}:${door.doorId}`)).toEqual(expect.arrayContaining([
      'fire_area.tscn:fire_area_to_central_hub',
      'forest_area.tscn:forest_area_to_central_hub',
    ]));
    expect(unlockedHubReturns.length).toBeGreaterThanOrEqual(4);
    for (const door of unlockedHubReturns) {
      const expectedRole = door.fileName === 'tutorial_room.tscn' ? 'progress' : 'return';
      expect(door.role, `${door.fileName}:${door.nodeName}`).toBe(expectedRole);
      expect(door.requiredItemId, `${door.fileName}:${door.nodeName}`).toBe('');
      expect(door.requiredBossId, `${door.fileName}:${door.nodeName}`).toBe('');
    }

    const hubReturnTextureBranch = doorMarker.match(/if door_visual_style == "hub_return":\n\s+return ([A-Za-z0-9_]+)/)?.[1];
    expect(doorMarker).toContain('const HubReturnDoorTexture = preload("res://resources/assets/images/ui/hub-return-door.webp")');
    expect(hubReturnTextureBranch).toBe('HubReturnDoorTexture');
    expect(docs).toContain('hub-return-door.webp');
  });

  it('shows the Hub to Mirror Corridor gate as a locked hub connection instead of a plain region door', () => {
    const hub = readGodotFile('levels/central_hub.tscn');
    const doorMarker = readGodotFile('scripts/level/markers/DoorMarker.gd');
    const docs = readRepoFile('docs/godot-v2/door-transition-flow.md');
    const mirrorDoor = extractDoorBlocks(hub).find(({ block }) =>
      block.includes('door_id = "hub_to_mirror_corridor"'),
    );

    expect(mirrorDoor?.block).toContain('door_role = "locked_gate"');
    expect(mirrorDoor?.block).toContain('door_visual_style = "hub_locked"');
    expect(mirrorDoor?.block).not.toContain('door_visual_style = "region"');
    expect(doorMarker).toContain('func is_hub_visual() -> bool:');
    expect(doorMarker).toContain('func is_locked_visual() -> bool:');
    expect(doorMarker).toContain('door_visual_style == "hub_locked"');
    expect(docs).toContain('hub_locked');
  });

  it('keeps enemy contact damage inside the visible enemy contact radius and records contact evidence', () => {
    const session = readGodotFile('scripts/session/GameSession.gd');
    const simpleEnemyScript = readGodotFile('scripts/enemies/SimpleEnemy.gd');
    const simpleEnemyScene = readGodotFile('scenes/enemies/SimpleEnemy.tscn');
    const flyingEnemyScene = readGodotFile('scenes/enemies/FlyingEnemy.tscn');
    const docs = readRepoFile('docs/godot-v2/combat-slice.md');
    const fallbackRadius = Number(session.match(/@export var contact_damage_radius: float = ([0-9.]+)/)?.[1]);
    const simpleBoxSize = Number(simpleEnemyScene.match(/size = Vector2\(([0-9.]+), ([0-9.]+)\)/)?.[1]);
    const flyingRadius = Number(flyingEnemyScene.match(/radius = ([0-9.]+)/)?.[1]);

    expect(fallbackRadius).toBeLessThanOrEqual(28);
    expect(simpleBoxSize).toBe(24);
    expect(flyingRadius).toBe(14);
    expect(simpleEnemyScript).toContain('@export var contact_damage_radius: float = 18.0');
    expect(session).toContain('func get_enemy_contact_damage_radius(enemy: Node) -> float:');
    expect(session).toContain('var contact_distance: float = player.global_position.distance_to(enemy.global_position)');
    expect(session).toContain('"contact_distance": contact_distance');
    expect(session).toContain('"contact_radius": contact_radius');
    expect(session).not.toContain('player.global_position.distance_to(enemy.global_position) > contact_damage_radius');
    expect(docs).toContain('contact_radius');
  });

  it('lays out CentralHub as a wide cathedral hub with supported door landings', () => {
    const hub = readGodotFile('levels/central_hub.tscn');
    const visualAssets = readGodotFile('scripts/level/LevelVisualAssets.gd');
    const docs = readRepoFile('docs/map-structure.md');
    const centerX = 464;

    expect(hub).not.toContain('[node name="CathedralNave" type="Polygon2D"');
    expect(hub).toContain('[node name="AltarPlatform"');
    expect(hub).toContain('[node name="LeftAislePlatform"');
    expect(hub).toContain('[node name="RightAislePlatform"');
    expect(hub).toContain('[node name="BuilderPlatform1"');
    expect(hub).toContain('[node name="BuilderPlatform4"');
    expect(hub).toContain('RectangleShape2D_side_aisle');
    expect(hub).toContain('RectangleShape2D_altar');
    expect(visualAssets).toContain('if normalized_level_id == "central_hub":');
    expect(visualAssets).toContain('return RoyalBackgroundTexture');

    const camera = readNodePosition(hub, 'CameraBoundsMarker');
    const floor = readNodePosition(hub, 'Floor');
    const mirror = readNodePosition(hub, 'DoorToMirrorCorridor');
    const forest = readNodePosition(hub, 'DoorToForestArea');
    const ice = readNodePosition(hub, 'DoorToIceArea');
    const tutorialFire = readNodePosition(hub, 'DoorToTutorialFireArea');
    const cave = readNodePosition(hub, 'DoorToCaveArea');
    const leftAisle = readNodePosition(hub, 'LeftAislePlatform');
    const rightAisle = readNodePosition(hub, 'RightAislePlatform');
    const mirrorSupport = readNodePosition(hub, 'BuilderPlatform1');
    const caveSupport = readNodePosition(hub, 'BuilderPlatform2');
    const fireSupport = readNodePosition(hub, 'BuilderPlatform3');
    const routeSupport = readNodePosition(hub, 'BuilderPlatform4');

    expect(camera.x).toBe(centerX);
    expect(floor.x).toBe(centerX);
    expect(forest.x).toBeLessThan(centerX);
    expect(tutorialFire.x).toBeGreaterThan(centerX);
    expect(leftAisle.x + rightAisle.x).toBe(centerX * 2);
    expect(leftAisle.y).toBe(rightAisle.y);
    expect(Math.abs(mirror.x - mirrorSupport.x)).toBeLessThanOrEqual(24);
    expect(cave.x).toBe(caveSupport.x);
    expect(Math.abs(readNodePosition(hub, 'DoorToFireArea').x - fireSupport.x)).toBeLessThanOrEqual(16);
    expect(Math.abs(readNodePosition(hub, 'PlayerSpawn').x - routeSupport.x)).toBeLessThanOrEqual(8);
    expect(Math.abs(readNodePosition(hub, 'PlayerSpawnIceGateCheck').x - ice.x)).toBeLessThanOrEqual(8);
    expect(Math.abs(readNodePosition(hub, 'PlayerSpawnTutorialFireRoute').x - tutorialFire.x)).toBeLessThanOrEqual(40);
    expect(docs).toContain('nave/altar/side aisle');
    expect(docs).toContain('wide cathedral hub');
    expect(docs).toContain('royal cathedral background');
  });
});
