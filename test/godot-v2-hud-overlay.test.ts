import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, '..');
const godotRoot = join(repoRoot, 'godot');

const readGodotFile = (relativePath: string): string =>
  readFileSync(join(godotRoot, relativePath), 'utf8');

describe('Godot v2 HUD overlay', () => {
  it('adds a polished in-run HUD for HP, ability, items, score, level, and outcome', () => {
    const scriptPath = join(godotRoot, 'scripts', 'ui', 'HudOverlay.gd');
    const scenePath = join(godotRoot, 'scenes', 'ui', 'HudOverlay.tscn');

    expect(existsSync(scriptPath)).toBe(true);
    expect(existsSync(scenePath)).toBe(true);

    const script = readGodotFile('scripts/ui/HudOverlay.gd');
    const scene = readGodotFile('scenes/ui/HudOverlay.tscn');

    expect(script).toContain('class_name HudOverlay');
    expect(script).toContain('extends Control');
    expect(script).toContain('set_hud_state');
    expect(script).toContain('get_summary_text');
    expect(script).toContain('hp');
    expect(script).toContain('ability_type');
    expect(script).toContain('items_collected');
    expect(script).toContain('score');
    expect(script).toContain('outcome');
    expect(script).toContain('ObjectiveLabel');
    expect(script).toContain('CooldownLabel');
    expect(script).toContain('StatusLabel');
    expect(script).toContain('layout_top_bar');
    expect(script).toContain('HpIcon');
    expect(script).toContain('AbilityIcon');
    expect(script).toContain('ItemsIcon');
    expect(script).toContain('ScoreIcon');
    expect(script).toContain('StatusIcon');
    expect(script).toContain('HpBar');
    expect(script).toContain('AbilityChip');
    expect(script).toContain('ItemsChip');
    expect(script).toContain('ScoreChip');
    expect(script).toContain('OutcomeBadge');
    expect(script).toContain('format_item_progress');
    expect(script).toContain('get_hp_ratio');
    expect(script).toContain('apply_hud_theme');
    expect(script).toContain('get_readable_outcome_label');
    expect(scene).toContain('anchor_right = 1.0');
    expect(scene).toContain('offset_bottom = 64.0');
    expect(scene).toContain('custom_minimum_size = Vector2(960, 64)');
    expect(scene).toContain('theme_override_styles/panel');
    expect(scene).toContain('TopBarRow');
    expect(scene).toContain('HpIcon');
    expect(scene).toContain('AbilityIcon');
    expect(scene).toContain('ItemsIcon');
    expect(scene).toContain('ScoreIcon');
    expect(scene).toContain('StatusIcon');
    expect(scene).toContain('HpBar');
    expect(scene).toContain('AbilityChip');
    expect(scene).toContain('ItemsChip');
    expect(scene).toContain('ScoreChip');
    expect(scene).toContain('OutcomeBadge');
    expect(scene).toContain('ObjectiveLabel');
    expect(scene).toContain('CooldownLabel');
    expect(scene).toContain('StatusLabel');
    expect(scene).toContain('HudOverlay.gd');
    expect(scene).toContain('HpLabel');
    expect(scene).toContain('AbilityLabel');
    expect(scene).toContain('ItemsLabel');
    expect(scene).toContain('ScoreLabel');
    expect(scene).toContain('OutcomeLabel');
  });

  it('exposes semantic HUD captions so every runtime value has an obvious meaning', () => {
    const script = readGodotFile('scripts/ui/HudOverlay.gd');
    const scene = readGodotFile('scenes/ui/HudOverlay.tscn');
    const combined = `${scene}\n${script}`;

    expect(script).toContain('get_hud_semantic_labels');
    for (const caption of ['HEALTH', 'ABILITY', 'ITEMS', 'SCORE', 'OBJECTIVE', 'ATTACK', 'STATUS']) {
      expect(combined).toContain(caption);
    }
  });

  it('separates HUD captions from values so compact chips do not clip meaning and state on one line', () => {
    const script = readGodotFile('scripts/ui/HudOverlay.gd');
    const scene = readGodotFile('scenes/ui/HudOverlay.tscn');

    for (const captionNode of [
      'AreaCaption',
      'HealthCaption',
      'AbilityCaption',
      'ItemsCaption',
      'ScoreCaption',
      'ObjectiveCaption',
      'AttackCaption',
      'StatusCaption',
    ]) {
      expect(scene).toContain(captionNode);
    }

    expect(script).toContain('set_caption_value(area_caption, level_label, "AREA"');
    expect(script).toContain('set_caption_value(ability_caption, ability_label, "ABILITY"');
    expect(script).toContain('set_caption_value(items_caption, items_label, "ITEMS"');
    expect(script).toContain('format_level_value');
    expect(script).toContain('format_item_progress');
    expect(script).not.toContain('level_label.text = "AREA  %s"');
    expect(script).not.toContain('ability_label.text = "ABILITY  %s"');
    expect(script).not.toContain('items_label.text = "ITEMS  %s"');
  });

  it('documents the upgraded HUD visual contract', () => {
    const docsPath = join(repoRoot, 'docs', 'godot-v2', 'hud-overlay.md');
    const docs = readFileSync(docsPath, 'utf8');

    expect(docs).toContain('thin full-width top bar');
    expect(docs).toContain('icon-like cues');
    expect(docs).toContain('HP bar');
    expect(docs).toContain('ability chip');
    expect(docs).toContain('item progress');
    expect(docs).toContain('visual snapshot');
  });

  it('syncs GameSession state into the HUD and trace stream', () => {
    const session = readGodotFile('scripts/session/GameSession.gd');
    const mainScene = readGodotFile('scenes/Main.tscn');
    const traceSummary = readFileSync(join(repoRoot, 'scripts', 'trace-summary.mjs'), 'utf8');

    expect(session).toContain('HudOverlayScene');
    expect(session).toContain('@export var hud_overlay_enabled');
    expect(session).toContain('setup_hud_overlay');
    expect(session).toContain('sync_hud_overlay');
    expect(session).toContain('build_hud_payload');
    expect(session).toContain('calculate_total_score');
    expect(session).toContain('calculate_remaining_life_bonus');
    expect(session).toContain('"score"');
    expect(session).toContain('hud.updated');
    expect(mainScene).toContain('hud_overlay_enabled = true');
    expect(traceSummary).toContain('last_hud');
    expect(traceSummary).toContain("eventType === 'hud.updated'");
  });
});
