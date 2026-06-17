import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const godotRoot = join(repoRoot, 'godot');

const readGodotFile = (relativePath: string): string =>
  readFileSync(join(godotRoot, relativePath), 'utf8');

type EnemyIdentity = {
  ability: string;
  asset: string;
};

const canonicalEnemyIdentities: Record<string, EnemyIdentity> = {
  spark_wisp: { ability: 'spark', asset: 'wabble-bee.webp' },
  simple_ground: { ability: 'spark', asset: 'wabble-bee.webp' },
  fire_imp: { ability: 'fire', asset: 'blaze-imp.webp' },
  frost_flyer: { ability: 'frost', asset: 'frost-flutter.webp' },
  leaf_sprite: { ability: 'leaf', asset: 'leaf-sprout.webp' },
  stone_sentry: { ability: 'stone', asset: 'dronto-durt.webp' },
  sentry: { ability: 'stone', asset: 'dronto-durt.webp' },
};

const abilityAliases: Record<string, string> = {
  flame: 'fire',
  ice: 'frost',
};

const normalizeAbility = (ability: string): string => abilityAliases[ability] ?? ability;

const extractEnemyBlocks = (source: string): string[] =>
  source
    .split(/\n(?=\[node )/)
    .filter((block) => block.includes('enemy_type = "') && block.includes('ability_type = "'));

const extractProperty = (block: string, propertyName: string): string => {
  const match = block.match(new RegExp(`${propertyName} = "([^"]*)"`));
  return match?.[1] ?? '';
};

describe('Godot v2 copy ability identity', () => {
  it('declares enemy identity profiles that bind enemy appearance to copy ability and texture asset', () => {
    const session = readGodotFile('scripts/session/GameSession.gd');
    const assetContract = readGodotFile('tests/asset_fallback_audit_contract.json');

    expect(session).toContain('func get_enemy_identity_profile(enemy_type: String) -> Dictionary:');
    expect(session).toContain('func resolve_enemy_ability_type(enemy_type: String, marker_payload: Dictionary) -> String:');
    expect(session).toContain('func apply_enemy_identity_profile(enemy: Node, enemy_type: String) -> void:');

    for (const [enemyType, identity] of Object.entries(canonicalEnemyIdentities)) {
      expect(session, `${enemyType} missing from identity profiles`).toContain(`"${enemyType}"`);
      expect(session, `${enemyType} missing ${identity.ability}`).toContain(`"ability_type": "${identity.ability}"`);
      expect(session, `${enemyType} missing ${identity.asset}`).toContain(identity.asset);
    }

    expect(assetContract).toContain('images/enemies/blaze-imp.webp');
    expect(assetContract).toContain('images/enemies/frost-flutter.webp');
    expect(assetContract).toContain('images/enemies/leaf-sprout.webp');
  });

  it('keeps hand-authored enemy markers aligned with their visible enemy identity', () => {
    const levelsDir = join(godotRoot, 'levels');
    const levelFiles = readdirSync(levelsDir)
      .filter((fileName) => fileName.endsWith('.tscn'))
      .sort();
    const mismatches: string[] = [];

    for (const fileName of levelFiles) {
      const source = readFileSync(join(levelsDir, fileName), 'utf8');
      for (const block of extractEnemyBlocks(source)) {
        const enemyType = extractProperty(block, 'enemy_type');
        const abilityType = normalizeAbility(extractProperty(block, 'ability_type'));
        const identity = canonicalEnemyIdentities[enemyType];
        if (identity === undefined) {
          continue;
        }
        if (abilityType !== identity.ability) {
          mismatches.push(`${fileName}:${enemyType} expected ${identity.ability}, got ${abilityType}`);
        }
      }
    }

    expect(mismatches).toEqual([]);
  });

  it('generates cluster-specific enemy types instead of one generic look for every copied ability', () => {
    const generator = readFileSync(join(repoRoot, 'scripts', 'generate-godot-procedural-levels.mjs'), 'utf8');
    const generated = JSON.parse(readGodotFile('levels/generated/procedural_levels.json')) as {
      levels?: Array<{
        metadata?: { cluster?: string };
        runtime_layout?: { content?: { enemies?: Array<{ enemy_type?: string; ability_type?: string }> } };
      }>;
    };
    const expectedTypeByCluster: Record<string, string> = {
      forest: 'leaf_sprite',
      ice: 'frost_flyer',
      fire: 'fire_imp',
      ruins: 'stone_sentry',
      sky: 'spark_wisp',
    };
    const mismatches: string[] = [];

    expect(generator).toContain('function getGeneratedEnemyType(cluster)');

    for (const level of generated.levels ?? []) {
      const cluster = level.metadata?.cluster ?? '';
      const expectedType = expectedTypeByCluster[cluster];
      if (expectedType === undefined) {
        continue;
      }
      for (const enemy of level.runtime_layout?.content?.enemies ?? []) {
        if (enemy.enemy_type !== expectedType) {
          mismatches.push(`${cluster}:${enemy.ability_type ?? ''} expected ${expectedType}, got ${enemy.enemy_type ?? ''}`);
        }
      }
    }

    expect(mismatches).toEqual([]);
  });
});
