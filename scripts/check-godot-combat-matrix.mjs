import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const repoRoot = process.cwd();
const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const contractPath = resolvePath(readOption('--contract') ?? join('godot', 'tests', 'combat_matrix_contract.json'));

try {
  const contract = loadJson(contractPath, 'combat matrix contract');
  const sourcePath = resolvePath(requireString(contract.source_path, 'source_path'));
  const sourceText = readFileSync(sourcePath, 'utf8');
  const extractedProfiles = extractAbilityProfiles(sourceText);
  const resolvedProfiles = resolveContractProfiles(contract, extractedProfiles);
  const matrix = buildMatrix(contract, resolvedProfiles);
  const failedChecks = [
    ...checkRoleExpectations(contract, resolvedProfiles),
    ...checkMatrixCoverage(contract, matrix, resolvedProfiles),
    ...checkTtkRanges(contract, matrix),
    ...checkDifficultyMonotonicity(contract, matrix),
  ];

  const report = {
    contract_path: contractPath,
    source_path: sourcePath,
    ability_count: contract.abilities.length,
    enemy_archetype_count: contract.enemy_archetypes.length,
    difficulty_count: Object.keys(contract.difficulties).length,
    matrix_count: matrix.length,
    ability_profiles: Object.fromEntries(
      resolvedProfiles.map((profile) => [
        profile.id,
        {
          role: profile.role,
          source: profile.source,
          attack_type: profile.attack_type,
          damage: profile.damage,
          range: profile.range,
          cooldown_ms: profile.cooldown_ms,
          movement_effect: profile.movement_effect,
          status: profile.status,
          can_attack: profile.can_attack,
        },
      ]),
    ),
    matrix,
    failed_checks: failedChecks,
  };

  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
  } else if (failedChecks.length > 0) {
    console.error(`[godot:combat-matrix] failed ${failedChecks.length} check(s).`);
    for (const check of failedChecks) {
      console.error(`[godot:combat-matrix] ${check.rule} ${check.message}`);
    }
  } else {
    console.log(
      `[godot:combat-matrix] passed ${matrix.length} ability/enemy/difficulty combination(s) across ${contract.abilities.length} abilities.`,
    );
  }

  process.exit(failedChecks.length > 0 ? 1 : 0);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (jsonOutput) {
    console.log(
      JSON.stringify(
        {
          contract_path: contractPath,
          ability_count: 0,
          enemy_archetype_count: 0,
          difficulty_count: 0,
          matrix_count: 0,
          failed_checks: [{ rule: 'runtime_error', message }],
        },
        null,
        2,
      ),
    );
  } else {
    console.error(`[godot:combat-matrix] ${message}`);
  }
  process.exit(1);
}

function readOption(name) {
  const index = args.indexOf(name);
  if (index === -1) {
    return undefined;
  }

  const value = args[index + 1];
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`Missing value for ${name}`);
  }
  return value;
}

function resolvePath(path) {
  return resolve(repoRoot, path);
}

function loadJson(path, label) {
  if (!existsSync(path)) {
    throw new Error(`Missing ${label}: ${path}`);
  }

  const data = JSON.parse(readFileSync(path, 'utf8'));
  if (data?.version !== 1) {
    throw new Error(`${label} must declare version 1`);
  }
  return data;
}

function extractAbilityProfiles(sourceText) {
  const profiles = new Map();
  const abilityProfileMatch = sourceText.match(/func get_ability_profile\(ability_type: String\) -> Dictionary:([\s\S]*?)\n\nfunc /);
  if (!abilityProfileMatch) {
    throw new Error('Unable to locate get_ability_profile in GameSession.gd');
  }

  const casePattern = /\n {8}((?:"[^"]+"(?:,\s*"[^"]+")*)):\n {12}return \{([\s\S]*?)\n {12}\}/g;
  for (const match of abilityProfileMatch[1].matchAll(casePattern)) {
    const aliases = Array.from(match[1].matchAll(/"([^"]+)"/g)).map((aliasMatch) => aliasMatch[1]);
    const profile = parseGdDictionary(match[2]);
    for (const alias of aliases) {
      profiles.set(alias, { ...profile, source: 'get_ability_profile', source_key: aliases[0] });
    }
  }

  const defaultMatch = abilityProfileMatch[1].match(/\n {8}_:\n {12}return \{([\s\S]*?)\n {12}\}/);
  if (defaultMatch) {
    profiles.set('*default*', { ...parseGdDictionary(defaultMatch[1]), source: 'get_ability_profile.default' });
  }

  const spitMatch = sourceText.match(/var spit_profile := \{([\s\S]*?)\n {4}\}/);
  if (spitMatch) {
    profiles.set('spit', {
      ...parseGdDictionary(spitMatch[1]),
      source: 'release_captured_enemy.spit_profile',
      source_key: 'spit',
    });
  }

  return profiles;
}

function parseGdDictionary(dictionaryText) {
  const profile = {};
  const entryPattern = /"([^"]+)":\s*([^,\n}]+)/g;
  for (const match of dictionaryText.matchAll(entryPattern)) {
    profile[match[1]] = parseGdValue(match[2].trim());
  }
  return profile;
}

function parseGdValue(rawValue) {
  if (rawValue === 'true') {
    return true;
  }
  if (rawValue === 'false') {
    return false;
  }
  if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
    return rawValue.slice(1, -1);
  }

  const numericValue = Number(rawValue);
  if (!Number.isNaN(numericValue)) {
    return numericValue;
  }
  return rawValue;
}

function resolveContractProfiles(contract, extractedProfiles) {
  const defaults = contract.profile_defaults ?? {};
  return requireArray(contract.abilities, 'abilities').map((ability) => {
    const abilityId = requireString(ability.id, 'ability.id');
    const aliases = [abilityId, ...requireOptionalArray(ability.aliases, `${abilityId}.aliases`)];
    const extractedProfile = aliases.map((alias) => extractedProfiles.get(alias)).find(Boolean);
    const defaultProfile = defaults[abilityId] ?? {};
    const profile = {
      ...defaultProfile,
      ...(extractedProfile ?? {}),
      ...(ability.profile_overrides ?? {}),
      id: abilityId,
      role: requireString(ability.role, `${abilityId}.role`),
      aliases,
      expectations: ability.expectations ?? {},
    };

    if (profile.can_attack === undefined) {
      profile.can_attack = Number(profile.damage ?? 0) > 0;
    }

    return profile;
  });
}

function buildMatrix(contract, profiles) {
  const matrix = [];
  const difficulties = Object.entries(contract.difficulties ?? {});
  const enemyArchetypes = requireArray(contract.enemy_archetypes, 'enemy_archetypes');

  for (const profile of profiles) {
    for (const enemy of enemyArchetypes) {
      for (const [difficultyId, difficulty] of difficulties) {
        const scaledHp = Math.max(Math.round(requireNumber(enemy.base_hp, `${enemy.id}.base_hp`) * Number(difficulty.enemy_hp_multiplier ?? 1)), 1);
        const entry = {
          ability_id: profile.id,
          role: profile.role,
          enemy_archetype_id: requireString(enemy.id, 'enemy.id'),
          enemy_type: String(enemy.type ?? enemy.id),
          difficulty: difficultyId,
          enemy_hp: scaledHp,
          damage: Number(profile.damage ?? 0),
          cooldown_ms: Number(profile.cooldown_ms ?? 0),
          attack_type: String(profile.attack_type ?? ''),
          range: Number(profile.range ?? 0),
          can_attack: Boolean(profile.can_attack),
        };

        if (!entry.can_attack) {
          matrix.push({
            ...entry,
            hits_to_defeat: null,
            ttk_seconds: null,
            skipped_reason: 'no_direct_attack',
          });
          continue;
        }

        const hitsToDefeat = Math.max(Math.ceil(scaledHp / Math.max(entry.damage, 1)), 1);
        matrix.push({
          ...entry,
          hits_to_defeat: hitsToDefeat,
          ttk_seconds: Number((((hitsToDefeat - 1) * entry.cooldown_ms) / 1000).toFixed(3)),
        });
      }
    }
  }

  return matrix;
}

function checkRoleExpectations(contract, profiles) {
  if (!isErrorRuleEnabled(contract, 'role_expectations')) {
    return [];
  }

  const failedChecks = [];
  for (const profile of profiles) {
    const expectations = profile.expectations ?? {};
    if (expectations.can_attack !== undefined && Boolean(expectations.can_attack) !== Boolean(profile.can_attack)) {
      failedChecks.push(buildProfileFailure('role_expectations', profile, `expected can_attack=${expectations.can_attack}`));
    }
    if (expectations.attack_type !== undefined && String(profile.attack_type ?? '') !== String(expectations.attack_type)) {
      failedChecks.push(
        buildProfileFailure('role_expectations', profile, `expected attack_type=${expectations.attack_type}, got ${profile.attack_type ?? '<missing>'}`),
      );
    }
    for (const [key, label] of [
      ['movement_effect', 'movement_effect'],
      ['status', 'status'],
    ]) {
      if (expectations[key] !== undefined && String(profile[key] ?? '') !== String(expectations[key])) {
        failedChecks.push(buildProfileFailure('role_expectations', profile, `expected ${label}=${expectations[key]}`));
      }
    }
    for (const [key, profileKey, comparator] of [
      ['min_damage', 'damage', (actual, expected) => actual >= expected],
      ['min_range', 'range', (actual, expected) => actual >= expected],
      ['max_range', 'range', (actual, expected) => actual <= expected],
      ['max_cooldown_ms', 'cooldown_ms', (actual, expected) => actual <= expected],
    ]) {
      if (expectations[key] === undefined) {
        continue;
      }
      const actual = Number(profile[profileKey] ?? 0);
      const expected = Number(expectations[key]);
      if (!comparator(actual, expected)) {
        failedChecks.push(buildProfileFailure('role_expectations', profile, `expected ${profileKey} to satisfy ${key}=${expected}, got ${actual}`));
      }
    }
  }

  return failedChecks;
}

function checkMatrixCoverage(contract, matrix, profiles) {
  if (!isErrorRuleEnabled(contract, 'matrix_coverage')) {
    return [];
  }

  const failedChecks = [];
  const expectedCount = contract.abilities.length * contract.enemy_archetypes.length * Object.keys(contract.difficulties).length;
  if (matrix.length !== expectedCount) {
    failedChecks.push({
      rule: 'matrix_coverage',
      message: `expected ${expectedCount} matrix entries, got ${matrix.length}`,
    });
  }

  for (const profile of profiles) {
    if (profile.source === undefined && profile.expectations?.can_attack !== false) {
      failedChecks.push({
        rule: 'matrix_coverage',
        ability_id: profile.id,
        message: `${profile.id} does not map to a real or default profile`,
      });
    }
    if (profile.can_attack && Number(profile.cooldown_ms ?? 0) <= 0) {
      failedChecks.push({
        rule: 'matrix_coverage',
        ability_id: profile.id,
        message: `${profile.id} is attack-capable but has no cooldown_ms`,
      });
    }
  }

  return failedChecks;
}

function checkTtkRanges(contract, matrix) {
  if (!isErrorRuleEnabled(contract, 'ttk_range')) {
    return [];
  }

  const failedChecks = [];
  const archetypesById = new Map(contract.enemy_archetypes.map((enemy) => [enemy.id, enemy]));
  for (const entry of matrix) {
    if (!entry.can_attack) {
      continue;
    }

    const enemy = archetypesById.get(entry.enemy_archetype_id);
    const range = enemy.ttk_seconds_by_difficulty?.[entry.difficulty] ?? enemy.ttk_seconds;
    if (range === undefined) {
      continue;
    }

    if (entry.ttk_seconds < Number(range.min) || entry.ttk_seconds > Number(range.max)) {
      failedChecks.push({
        rule: 'ttk_range',
        ability_id: entry.ability_id,
        enemy_archetype_id: entry.enemy_archetype_id,
        difficulty: entry.difficulty,
        ttk_seconds: entry.ttk_seconds,
        expected_min: Number(range.min),
        expected_max: Number(range.max),
        message: `${entry.ability_id} vs ${entry.enemy_archetype_id} (${entry.difficulty}) TTK ${entry.ttk_seconds}s is outside ${range.min}-${range.max}s`,
      });
    }
  }

  return failedChecks;
}

function checkDifficultyMonotonicity(contract, matrix) {
  if (!isErrorRuleEnabled(contract, 'difficulty_monotonicity')) {
    return [];
  }

  const failedChecks = [];
  const order = contract.difficulty_order ?? Object.keys(contract.difficulties);
  for (const ability of contract.abilities) {
    for (const enemy of contract.enemy_archetypes) {
      const entries = order
        .map((difficulty) =>
          matrix.find((entry) => entry.ability_id === ability.id && entry.enemy_archetype_id === enemy.id && entry.difficulty === difficulty),
        )
        .filter((entry) => entry?.can_attack);
      for (let index = 1; index < entries.length; index += 1) {
        if (entries[index].ttk_seconds < entries[index - 1].ttk_seconds) {
          failedChecks.push({
            rule: 'difficulty_monotonicity',
            ability_id: ability.id,
            enemy_archetype_id: enemy.id,
            difficulty: entries[index].difficulty,
            message: `${ability.id} vs ${enemy.id} TTK decreases from ${entries[index - 1].difficulty} to ${entries[index].difficulty}`,
          });
        }
      }
    }
  }

  return failedChecks;
}

function buildProfileFailure(rule, profile, message) {
  return {
    rule,
    ability_id: profile.id,
    role: profile.role,
    message: `${profile.id}: ${message}`,
  };
}

function isErrorRuleEnabled(contract, ruleName) {
  return String(contract.rules?.[ruleName]?.severity ?? 'error') === 'error';
}

function requireArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  return value;
}

function requireOptionalArray(value, label) {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  return value;
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function requireNumber(value, label) {
  if (!Number.isFinite(Number(value))) {
    throw new Error(`${label} must be a number`);
  }
  return Number(value);
}
