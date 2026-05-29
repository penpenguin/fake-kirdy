import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const godotRoot = join(currentDir, '..', 'godot');

const readGodotFile = (relativePath: string): string =>
  readFileSync(join(godotRoot, relativePath), 'utf8');

describe('Godot v2 player controller slice', () => {
  it('defines exported tuning values in a PlayerTuning resource', () => {
    const source = readGodotFile('scripts/player/PlayerTuning.gd');

    expect(source).toContain('extends Resource');
    expect(source).toContain('class_name PlayerTuning');

    [
      'max_speed',
      'ground_accel',
      'ground_decel',
      'air_accel',
      'air_decel',
      'jump_velocity',
      'gravity_up',
      'gravity_down',
      'jump_cut_multiplier',
      'coyote_time_ms',
      'jump_buffer_ms',
      'hover_gravity_scale',
      'hover_max_fall_speed',
    ].forEach((fieldName) => {
      expect(source).toMatch(new RegExp(`@export\\s+var\\s+${fieldName}\\b`));
    });
  });

  it('implements CharacterBody2D movement without RigidBody2D', () => {
    const source = readGodotFile('scripts/player/PlayerController.gd');

    expect(source).toContain('extends CharacterBody2D');
    expect(source).not.toContain('RigidBody2D');
    expect(source).toMatch(/@export\s+var\s+tuning:\s*Resource/);
    expect(source).toContain('PlayerTuning.gd');
    expect(source).toContain('move_toward');
    expect(source).toContain('ground_accel');
    expect(source).toContain('ground_decel');
    expect(source).toContain('air_accel');
    expect(source).toContain('air_decel');
    expect(source).toContain('gravity_up');
    expect(source).toContain('gravity_down');
    expect(source).toContain('coyote_time');
    expect(source).toContain('jump_buffer');
    expect(source).toContain('jump_cut_multiplier');
    expect(source).toContain('hover_gravity_scale');
    expect(source).toContain('hover_max_fall_speed');
    expect(source).toContain('trace_event');
  });

  it('adds player and controller lab scenes without RigidBody2D', () => {
    const playerScene = readGodotFile('scenes/player/Player.tscn');
    const labScene = readGodotFile('levels/controller_lab.tscn');

    expect(playerScene).toContain('PlayerController.gd');
    expect(playerScene).toContain('CharacterBody2D');
    expect(playerScene).not.toContain('RigidBody2D');
    expect(labScene).toContain('Player.tscn');
    expect(labScene).toContain('StaticBody2D');
    expect(labScene).not.toContain('RigidBody2D');
  });

  it('documents controller lab tuning workflow', () => {
    const docsPath = join(currentDir, '..', 'docs', 'godot-v2', 'controller-lab.md');

    expect(existsSync(docsPath)).toBe(true);

    const docs = readFileSync(docsPath, 'utf8');
    expect(docs).toContain('Controller Lab');
    expect(docs).toContain('coyote');
    expect(docs).toContain('jump buffer');
    expect(docs).toContain('hover');
    expect(docs).toContain('trace');
  });
});
