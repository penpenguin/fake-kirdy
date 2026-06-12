import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, '..');
const godotRoot = join(repoRoot, 'godot');

const readRepoFile = (relativePath: string): string =>
  readFileSync(join(repoRoot, relativePath), 'utf8');

describe('Godot v2 usability and accessibility checks', () => {
  it('defines an explicit usability/accessibility contract and command', () => {
    const packageJson = JSON.parse(readRepoFile('package.json')) as {
      scripts?: Record<string, string>;
    };
    const scriptPath = join(repoRoot, 'scripts', 'check-godot-usability.mjs');
    const contractPath = join(godotRoot, 'tests', 'usability_accessibility_contract.json');
    const docsPath = join(repoRoot, 'docs', 'godot-v2', 'usability-accessibility-testing.md');

    expect(packageJson.scripts?.['godot:usability']).toBe('node scripts/check-godot-usability.mjs');
    expect(existsSync(scriptPath)).toBe(true);
    expect(existsSync(contractPath)).toBe(true);
    expect(existsSync(docsPath)).toBe(true);

    const script = readRepoFile('scripts/check-godot-usability.mjs');
    expect(script).toContain('usability_accessibility_contract.json');
    expect(script).toContain('required_keyboard_actions');
    expect(script).toContain('required_replay_ids');
    expect(script).toContain('required_ui_scenes');
    expect(script).toContain('required_visual_feedback_tokens');
    expect(script).toContain('required_color_roles');
    expect(script).toContain('tutorial_size_ratio_checks');
    expect(script).toContain('parseInputActions');
    expect(script).toContain('assertMinimumColorDistance');
    expect(script).toContain('assertTutorialSizeRatios');

    const contract = JSON.parse(readFileSync(contractPath, 'utf8')) as {
      version: number;
      required_keyboard_actions: string[];
      required_replay_ids: string[];
      required_ui_scenes: string[];
      required_visual_feedback_tokens: Array<{ file: string; token: string }>;
      required_color_roles: string[];
      object_visibility_checks?: Array<{
        id: string;
        subject_file?: string;
        token?: string;
        min_marker_size?: number;
        min_label_size?: number;
        required_feature_types?: string[];
      }>;
      tutorial_size_ratio_checks: Array<{
        id: string;
        subject_scene: string;
        reference_scene: string;
        min_ratio: number;
        max_ratio: number;
      }>;
      min_color_distance: number;
    };
    expect(contract.version).toBe(1);
    expect(contract.required_keyboard_actions).toEqual(
      expect.arrayContaining(['move_left', 'move_right', 'jump', 'inhale', 'swallow', 'use_ability', 'pause_toggle']),
    );
    expect(contract.required_replay_ids).toEqual(
      expect.arrayContaining(['hard_enemy_attack_trace', 'virtual_controls_touch_mode', 'pause_toggle_menu']),
    );
    expect(contract.required_ui_scenes).toEqual(
      expect.arrayContaining(['HudOverlay.tscn', 'SettingsOverlay.tscn', 'VirtualControlsOverlay.tscn']),
    );
    expect(contract.required_visual_feedback_tokens).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ file: 'godot/scripts/ui/VirtualControlsOverlay.gd', token: 'BUTTON_PRESSED_MODULATE' }),
        expect.objectContaining({ file: 'godot/scripts/enemies/SimpleEnemy.gd', token: 'hit_flash_color' }),
      ]),
    );
    expect(contract.required_color_roles).toEqual(
      expect.arrayContaining(['discovered_feature_color', 'undiscovered_feature_color', 'dead_end_completed_color']),
    );
    expect(contract.object_visibility_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'world_hazard_marker_visual',
          subject_file: 'godot/scripts/level/markers/HazardMarker.gd',
          token: 'HazardVisual',
          min_marker_size: 24,
        }),
        expect.objectContaining({
          id: 'map_feature_marker_types_are_distinct',
          required_feature_types: expect.arrayContaining(['door', 'goal', 'collectible', 'heal', 'hazard', 'ability_gate', 'dead_end']),
          min_marker_size: 6,
        }),
        expect.objectContaining({
          id: 'map_overlay_legend_labels',
          subject_file: 'godot/scripts/ui/MapOverlay.gd',
          token: 'draw_feature_legend',
          min_label_size: 11,
        }),
      ]),
    );
    expect(contract.tutorial_size_ratio_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'tutorial_enemy_to_player_collision',
          subject_scene: 'godot/scenes/enemies/SimpleEnemy.tscn',
          reference_scene: 'godot/scenes/player/Player.tscn',
          min_ratio: 0.6,
          max_ratio: 1,
        }),
        expect.objectContaining({
          id: 'tutorial_collectible_marker_scale',
          min_scale: 0.26,
          max_scale: 0.4,
        }),
        expect.objectContaining({
          id: 'tutorial_heal_marker_scale',
          min_scale: 0.26,
          max_scale: 0.4,
        }),
        expect.objectContaining({
          id: 'tutorial_door_marker_scale',
          min_scale: 0.3,
          max_scale: 0.45,
        }),
      ]),
    );
    expect(contract.min_color_distance).toBeGreaterThan(0);

    const docs = readFileSync(docsPath, 'utf8');
    expect(docs).toContain('Usability and Accessibility Testing');
    expect(docs).toContain('npm run godot:usability');
    expect(docs).toContain('keyboard');
    expect(docs).toContain('visual feedback');
    expect(docs).toContain('difficulty');
    expect(docs).toContain('color roles');
    expect(docs).toContain('tutorial size ratios');
  });
});
