import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('trace summary metrics', () => {
  it('extracts event counts, levels, duration, and outcome from NDJSON traces', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'fake-kirdy-trace-'));
    const tracePath = join(workspace, 'trace.ndjson');

    writeFileSync(
      tracePath,
      [
        JSON.stringify({ frame: 0, time_ms: 0, event_type: 'level.loaded', level_id: 'combat_room' }),
        JSON.stringify({
          frame: 0,
          time_ms: 0,
          event_type: 'save.loaded',
          level_id: 'combat_room',
          payload: {
            items_collected: ['ice-keystone'],
            completed_level_ids: ['goal_sanctum'],
            visited_level_ids: ['combat_room', 'central_hub'],
            unlocked_door_ids: ['central_hub:door_to_heal_room'],
            explored_tiles: {
              central_hub: ['3,11', '4,11'],
              combat_room: ['5,12'],
            },
            player_position: { x: 96, y: 368 },
            ability_type: 'spark',
            settings: {
              volume: 0.25,
              controls: 'controller',
              difficulty: 'hard',
            },
            player_revive_count: 1,
          },
        }),
        JSON.stringify({
          frame: 4,
          time_ms: 67,
          event_type: 'map.updated',
          level_id: 'heal_room',
          payload: {
            explored_tiles: {
              heal_room: ['6,12'],
            },
          },
        }),
        JSON.stringify({
          frame: 5,
          time_ms: 83,
          event_type: 'enemy.captured',
          level_id: 'combat_room',
          player: {
            position: { x: 96, y: 368 },
            velocity: { x: 120, y: 0 },
          },
        }),
        JSON.stringify({
          frame: 8,
          time_ms: 133,
          event_type: 'ability.acquired',
          level_id: 'combat_room',
          player: {
            position: { x: 140, y: 320 },
            velocity: { x: 180, y: -260 },
          },
          payload: { ability_type: 'spark' },
        }),
        JSON.stringify({
          frame: 12,
          time_ms: 200,
          event_type: 'collectible.collected',
          level_id: 'forest_reliquary',
          player: {
            position: { x: 200, y: 420 },
            velocity: { x: 90, y: 340 },
          },
          payload: { collectible_id: 'forest-keystone', item_id: 'forest-keystone' },
        }),
        JSON.stringify({
          frame: 13,
          time_ms: 217,
          event_type: 'item.acquired',
          level_id: 'forest_reliquary',
          payload: { collectible_id: 'forest-keystone', item_id: 'forest-keystone' },
        }),
        JSON.stringify({
          frame: 13,
          time_ms: 220,
          event_type: 'door.locked',
          level_id: 'forest_reliquary',
          payload: { door_id: 'forest_exit', reason: 'missing_item:forest-keystone' },
        }),
        JSON.stringify({
          frame: 14,
          time_ms: 233,
          event_type: 'hud.updated',
          level_id: 'forest_reliquary',
          payload: {
            level_id: 'forest_reliquary',
            hp: 2,
            max_hp: 4,
            revive_count: 1,
            ability_type: 'spark',
            items_collected: ['forest-keystone', 'ice-keystone'],
            score: 2600,
            remaining_life_bonus: 700,
            outcome: 'running',
          },
        }),
        JSON.stringify({
          frame: 15,
          time_ms: 250,
          event_type: 'settings.updated',
          level_id: 'forest_reliquary',
          payload: {
            volume: 0.5,
            controls: 'touch',
            difficulty: 'easy',
          },
        }),
        JSON.stringify({
          frame: 16,
          time_ms: 267,
          event_type: 'inventory.updated',
          level_id: 'forest_reliquary',
          payload: {
            ability_type: 'spark',
            items_collected: ['ice-keystone', 'forest-keystone'],
            completed_level_ids: ['flat_room'],
            visited_level_ids: ['combat_room', 'central_hub', 'forest_reliquary'],
            unlocked_door_ids: ['central_hub:door_to_heal_room', 'door_room:door_to_jump_room'],
            defeated_enemy_group_ids: ['sky_guard'],
            defeated_boss_ids: ['sky_guard_boss'],
          },
        }),
        JSON.stringify({
          frame: 18,
          time_ms: 300,
          event_type: 'enemy.defeated',
          level_id: 'sky_sanctum',
          payload: {
            enemy_id: 'sky_sanctum_enemy',
            enemy_group_id: 'sky_guard',
            boss_id: 'sky_guard_boss',
          },
        }),
        JSON.stringify({
          frame: 20,
          time_ms: 333,
          event_type: 'hazard.entered',
          level_id: 'danger_room',
          payload: { hazard_id: 'danger_spikes', hazard_type: 'spike', damage: 3 },
        }),
        JSON.stringify({
          frame: 22,
          time_ms: 367,
          event_type: 'ability_gate.opened',
          level_id: 'fire_area',
          payload: {
            gate_id: 'fire_area_ice_block',
            required_ability_type: 'fire',
            ability_type: 'fire',
            gate_effect: 'melt_ice',
            opened_ability_gate_ids: ['fire_area_ice_block'],
          },
        }),
        JSON.stringify({
          frame: 42,
          time_ms: 700,
          event_type: 'result.overlay.shown',
          level_id: 'flat_room',
          payload: {
            level_id: 'flat_room',
            outcome: 'completed',
            time_ms: 700,
            frames: 42,
            items_collected: ['forest-keystone'],
            completed_level_ids: ['flat_room'],
            score: 1700,
            remaining_life_bonus: 700,
          },
        }),
        JSON.stringify({
          frame: 43,
          time_ms: 717,
          event_type: 'results.scene.shown',
          level_id: 'flat_room',
          payload: {
            level_id: 'flat_room',
            outcome: 'completed',
            time_ms: 700,
            frames: 42,
            items_collected: ['forest-keystone'],
            completed_level_ids: ['flat_room'],
            score: 1700,
            remaining_life_bonus: 700,
          },
        }),
        JSON.stringify({
          frame: 42,
          time_ms: 700,
          event_type: 'run.finished',
          level_id: 'flat_room',
          payload: { result_label: 'complete' },
        }),
      ].join('\n'),
    );

    const output = execFileSync('node', ['scripts/trace-summary.mjs', tracePath], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    const summary = JSON.parse(output) as {
      event_count: number;
      levels: string[];
      duration_ms: number;
      outcome: string;
      counts_by_type: Record<string, number>;
      collectibles_collected: string[];
      items_collected: string[];
      abilities_acquired: string[];
      enemies_defeated: string[];
      completed_levels: string[];
      visited_level_ids: string[];
      unlocked_door_ids: string[];
      defeated_enemy_group_ids: string[];
      defeated_boss_ids: string[];
      door_lock_reasons: string[];
      hazards_entered: string[];
      ability_gates_opened: string[];
      explored_tiles_by_level: Record<string, string[]>;
      explored_tile_count: number;
      last_player_position?: { x: number; y: number };
      last_ability_type?: string | null;
      last_settings?: {
        volume: number;
        controls: string;
        difficulty: string;
      } | null;
      last_inventory?: {
        ability_type: string;
        items_collected: string[];
        completed_level_ids: string[];
        visited_level_ids: string[];
        unlocked_door_ids: string[];
      } | null;
      last_player_revive_count?: number | null;
      last_hud?: {
        level_id: string;
        hp: number;
        max_hp: number;
        revive_count: number;
        ability_type: string;
        items_collected: string[];
        score: number;
        remaining_life_bonus: number;
        outcome: string;
      } | null;
      last_result_overlay?: {
        level_id: string;
        outcome: string;
        time_ms: number;
        frames: number;
        items_collected: string[];
        completed_level_ids: string[];
        score: number;
        remaining_life_bonus: number;
      } | null;
      last_results_scene?: {
        level_id: string;
        outcome: string;
        time_ms: number;
        frames: number;
        score: number;
        remaining_life_bonus: number;
      } | null;
      player_motion: {
        sample_count: number;
        min_position: { x: number; y: number };
        max_position: { x: number; y: number };
        max_abs_velocity: { x: number; y: number };
        max_fall_speed: number;
        max_rise_speed: number;
      };
    };

    expect(summary.event_count).toBe(17);
    expect(summary.levels).toEqual(['combat_room', 'danger_room', 'fire_area', 'flat_room', 'forest_reliquary', 'heal_room', 'sky_sanctum']);
    expect(summary.duration_ms).toBe(717);
    expect(summary.outcome).toBe('complete');
    expect(summary.counts_by_type['ability.acquired']).toBe(1);
    expect(summary.counts_by_type['collectible.collected']).toBe(1);
    expect(summary.counts_by_type['item.acquired']).toBe(1);
    expect(summary.counts_by_type['hud.updated']).toBe(1);
    expect(summary.counts_by_type['door.locked']).toBe(1);
    expect(summary.counts_by_type['enemy.defeated']).toBe(1);
    expect(summary.counts_by_type['hazard.entered']).toBe(1);
    expect(summary.counts_by_type['ability_gate.opened']).toBe(1);
    expect(summary.counts_by_type['map.updated']).toBe(1);
    expect(summary.counts_by_type['result.overlay.shown']).toBe(1);
    expect(summary.counts_by_type['results.scene.shown']).toBe(1);
    expect(summary.counts_by_type['run.finished']).toBe(1);
    expect(summary.counts_by_type['settings.updated']).toBe(1);
    expect(summary.counts_by_type['inventory.updated']).toBe(1);
    expect(summary.collectibles_collected).toEqual(['forest-keystone']);
    expect(summary.items_collected).toEqual(['forest-keystone', 'ice-keystone']);
    expect(summary.abilities_acquired).toEqual(['spark']);
    expect(summary.enemies_defeated).toEqual(['sky_sanctum_enemy']);
    expect(summary.completed_levels).toEqual(['flat_room', 'goal_sanctum']);
    expect(summary.visited_level_ids).toEqual(['central_hub', 'combat_room', 'forest_reliquary']);
    expect(summary.unlocked_door_ids).toEqual(['central_hub:door_to_heal_room', 'door_room:door_to_jump_room']);
    expect(summary.defeated_enemy_group_ids).toEqual(['sky_guard']);
    expect(summary.defeated_boss_ids).toEqual(['sky_guard_boss']);
    expect(summary.door_lock_reasons).toEqual(['missing_item:forest-keystone']);
    expect(summary.hazards_entered).toEqual(['danger_spikes']);
    expect(summary.ability_gates_opened).toEqual(['fire_area_ice_block']);
    expect(summary.explored_tiles_by_level).toEqual({
      central_hub: ['3,11', '4,11'],
      combat_room: ['5,12'],
      heal_room: ['6,12'],
    });
    expect(summary.explored_tile_count).toBe(4);
    expect(summary.last_player_position).toEqual({ x: 96, y: 368 });
    expect(summary.last_ability_type).toBe('spark');
    expect(summary.last_settings).toEqual({
      volume: 0.5,
      controls: 'touch',
      difficulty: 'easy',
    });
    expect(summary.last_inventory).toEqual({
      ability_type: 'spark',
      items_collected: ['forest-keystone', 'ice-keystone'],
      completed_level_ids: ['flat_room'],
      visited_level_ids: ['central_hub', 'combat_room', 'forest_reliquary'],
      unlocked_door_ids: ['central_hub:door_to_heal_room', 'door_room:door_to_jump_room'],
    });
    expect(summary.last_player_revive_count).toBe(1);
    expect(summary.last_hud).toEqual({
      level_id: 'forest_reliquary',
      hp: 2,
      max_hp: 4,
      revive_count: 1,
      ability_type: 'spark',
      items_collected: ['forest-keystone', 'ice-keystone'],
      score: 2600,
      remaining_life_bonus: 700,
      outcome: 'running',
    });
    expect(summary.last_result_overlay).toEqual({
      level_id: 'flat_room',
      outcome: 'completed',
      time_ms: 700,
      frames: 42,
      items_collected: ['forest-keystone'],
      completed_level_ids: ['flat_room'],
      score: 1700,
      remaining_life_bonus: 700,
    });
    expect(summary.last_results_scene).toEqual({
      level_id: 'flat_room',
      outcome: 'completed',
      time_ms: 700,
      frames: 42,
      items_collected: ['forest-keystone'],
      completed_level_ids: ['flat_room'],
      score: 1700,
      remaining_life_bonus: 700,
    });
    expect(summary.player_motion).toEqual({
      sample_count: 3,
      min_position: { x: 96, y: 320 },
      max_position: { x: 200, y: 420 },
      max_abs_velocity: { x: 180, y: 340 },
      max_fall_speed: 340,
      max_rise_speed: 260,
    });
  });
});
