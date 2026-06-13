import { readFileSync } from 'node:fs';
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
    expect(docs).toContain('continue');
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

    expect(hub).toContain('door_visual_style = "trial"');
    expect(hub).toContain('door_visual_style = "region"');
    expect(hub).toContain('door_visual_style = "locked"');
    expect(hub).toContain('door_label = "Ember Gate"');
    expect(hub).toContain('door_label = "Trial Door"');
    expect(lintScript).toContain('lintNearbyDoorAmbiguity');
    expect(lintContract).toContain('"nearby_door_ambiguity"');
    expect(lintContract).toContain('"central_hub"');
    expect(docs).toContain('door_visual_style');
    expect(docs).toContain('nearby_door_ambiguity');
  });
});
