import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const repoRoot = process.cwd();
const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const contractPath = resolvePath(readOption('--contract') ?? join('godot', 'tests', 'audio_audit_contract.json'));

try {
  const contract = loadJson(contractPath, 'audio audit contract');
  const gameSessionPath = resolvePath(requireString(contract.source_paths?.game_session, 'source_paths.game_session'));
  const assetManifestPath = resolvePath(requireString(contract.source_paths?.asset_manifest, 'source_paths.asset_manifest'));
  const gameSession = readFileSync(gameSessionPath, 'utf8');
  const assetManifest = loadJson(assetManifestPath, 'asset manifest');
  const sfxEvents = requireArray(contract.required_sfx_events, 'required_sfx_events');
  const mixEvents = requireArray(contract.required_mix_events, 'required_mix_events');
  const failedChecks = [
    ...checkSfxTraceContract(contract, gameSession),
    ...checkMixTraceContract(contract, gameSession),
    ...checkSfxEvents(contract, gameSession, assetManifest, sfxEvents),
    ...checkMixEvents(contract, gameSession, mixEvents),
  ];
  const report = {
    contract_path: contractPath,
    source_paths: {
      game_session: gameSessionPath,
      asset_manifest: assetManifestPath,
    },
    sfx_event_count: sfxEvents.length,
    mix_event_count: mixEvents.length,
    coverage: buildCoverage(sfxEvents),
    sfx_events: sfxEvents,
    mix_events: mixEvents,
    failed_checks: failedChecks,
  };

  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
  } else if (failedChecks.length > 0) {
    console.error(`[godot:audio-audit] failed ${failedChecks.length} check(s).`);
    for (const check of failedChecks) {
      console.error(`[godot:audio-audit] ${check.rule} ${check.message}`);
    }
  } else {
    console.log(`[godot:audio-audit] passed ${sfxEvents.length} SFX event(s) and ${mixEvents.length} mix event(s).`);
  }

  process.exit(failedChecks.length > 0 ? 1 : 0);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (jsonOutput) {
    console.log(
      JSON.stringify(
        {
          contract_path: contractPath,
          sfx_event_count: 0,
          mix_event_count: 0,
          coverage: {},
          failed_checks: [{ rule: 'runtime_error', message }],
        },
        null,
        2,
      ),
    );
  } else {
    console.error(`[godot:audio-audit] ${message}`);
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
  if (path.startsWith('res://')) {
    return resolve(repoRoot, 'godot', path.slice('res://'.length));
  }
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

function checkSfxTraceContract(contract, gameSession) {
  const failedChecks = [];
  const playSfxBody = extractFunctionBody(gameSession, 'play_sfx');
  if (!playSfxBody.includes('"audio.sfx.played"')) {
    failedChecks.push({
      rule: 'missing_sfx_trace',
      message: 'play_sfx must emit audio.sfx.played trace events.',
    });
  }

  for (const key of requireOptionalArray(contract.required_sfx_payload_keys, 'required_sfx_payload_keys')) {
    if (!playSfxBody.includes(`"${key}"`)) {
      failedChecks.push({
        rule: 'missing_sfx_payload_key',
        payload_key: key,
        message: `audio.sfx.played payload is missing ${key}.`,
      });
    }
  }
  return failedChecks;
}

function checkMixTraceContract(contract, gameSession) {
  const failedChecks = [];
  const updateMixBody = extractFunctionBody(gameSession, 'update_audio_mix');
  const mixPayloadBody = extractFunctionBody(gameSession, 'get_audio_mix_payload');
  if (!updateMixBody.includes('"audio.mix.updated"')) {
    failedChecks.push({
      rule: 'missing_mix_trace',
      message: 'update_audio_mix must emit audio.mix.updated trace events when requested.',
    });
  }

  for (const key of requireOptionalArray(contract.required_mix_payload_keys, 'required_mix_payload_keys')) {
    if (!mixPayloadBody.includes(`"${key}"`)) {
      failedChecks.push({
        rule: 'missing_mix_payload_key',
        payload_key: key,
        message: `audio.mix.updated payload is missing ${key}.`,
      });
    }
  }
  return failedChecks;
}

function checkSfxEvents(contract, gameSession, assetManifest, sfxEvents) {
  const failedChecks = [];
  const manifestAssets = new Set(requireArray(assetManifest.assets, 'asset_manifest.assets').map(String));
  const requireAssetFiles = Boolean(contract.require_asset_files);

  for (const event of sfxEvents) {
    const id = requireString(event.id, 'sfx_event.id');
    const streamConst = requireString(event.stream_const, `${id}.stream_const`);
    const assetPath = requireString(event.asset_path, `${id}.asset_path`);
    const expectedPreload = `const ${streamConst} = preload("res://resources/assets/${assetPath}")`;

    if (!gameSession.includes(expectedPreload)) {
      failedChecks.push({
        rule: 'missing_preload',
        event_id: id,
        message: `${id} is missing ${expectedPreload}.`,
      });
    }

    if (!manifestAssets.has(assetPath)) {
      failedChecks.push({
        rule: 'asset_not_in_manifest',
        event_id: id,
        asset_path: assetPath,
        message: `${id} asset is not listed in asset_manifest.json: ${assetPath}.`,
      });
    }

    if (requireAssetFiles && !existsSync(resolvePath(join('godot', 'resources', 'assets', assetPath)))) {
      failedChecks.push({
        rule: 'missing_asset_file',
        event_id: id,
        asset_path: assetPath,
        message: `${id} asset file is missing: ${assetPath}.`,
      });
    }

    for (const marker of requireOptionalArray(event.required_source_markers, `${id}.required_source_markers`)) {
      if (!gameSession.includes(String(marker))) {
        failedChecks.push({
          rule: 'missing_source_marker',
          event_id: id,
          marker,
          message: `${id} is missing source marker ${marker}.`,
        });
      }
    }
  }

  const coverage = buildCoverage(sfxEvents);
  for (const category of requireOptionalArray(contract.required_sfx_categories, 'required_sfx_categories')) {
    if (Number(coverage[category] ?? 0) <= 0) {
      failedChecks.push({
        rule: 'missing_sfx_category',
        category,
        message: `audio audit coverage is missing category ${category}.`,
      });
    }
  }
  return failedChecks;
}

function checkMixEvents(contract, gameSession, mixEvents) {
  const failedChecks = [];
  const mixPayloadBody = extractFunctionBody(gameSession, 'get_audio_mix_payload');
  for (const event of mixEvents) {
    const id = requireString(event.id, 'mix_event.id');
    const reason = requireString(event.reason, `${id}.reason`);
    const requiredSourceMarkers = requireOptionalArray(event.required_source_markers, `${id}.required_source_markers`);
    if (requiredSourceMarkers.length === 0 && !gameSession.includes('update_audio_mix(')) {
      failedChecks.push({
        rule: 'missing_mix_event',
        event_id: id,
        reason,
        message: `${id} must be backed by update_audio_mix.`,
      });
    }
    for (const marker of requiredSourceMarkers) {
      if (!gameSession.includes(String(marker))) {
        failedChecks.push({
          rule: 'missing_mix_event',
          event_id: id,
          reason,
          marker,
          message: `${id} is missing source marker ${marker}.`,
        });
      }
    }
    if (Boolean(event.requires_ducking) && !mixPayloadBody.includes('session_paused or settings_menu_open or pause_settings_open')) {
      failedChecks.push({
        rule: 'missing_ducking_predicate',
        event_id: id,
        reason,
        message: `${id} requires BGM ducking while pause or settings menus are active.`,
      });
    }
  }
  return failedChecks;
}

function extractFunctionBody(sourceText, functionName) {
  const match = sourceText.match(new RegExp(`func ${escapeRegExp(functionName)}\\([^\\n]*\\) -> [^:]+:([\\s\\S]*?)(?=\\n\\nfunc |\\n\\n@|\\n\\n$|$)`));
  return match?.[1] ?? '';
}

function buildCoverage(sfxEvents) {
  const coverage = {};
  for (const event of sfxEvents) {
    const category = String(event.category ?? '');
    if (category === '') {
      continue;
    }
    coverage[category] = (coverage[category] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(coverage).sort(([left], [right]) => left.localeCompare(right)));
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
