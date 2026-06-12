import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';

const repoRoot = process.cwd();
const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const contractPath = resolvePath(readOption('--contract') ?? join('godot', 'tests', 'asset_fallback_audit_contract.json'), repoRoot);

try {
  const contract = loadJson(contractPath, 'asset fallback audit contract');
  const contractDir = dirname(contractPath);
  const playerControllerPath = resolvePath(requireString(contract.source_paths?.player_controller, 'source_paths.player_controller'), contractDir);
  const gameSessionPath = resolvePath(requireString(contract.source_paths?.game_session, 'source_paths.game_session'), contractDir);
  const levelVisualAssetsPath = resolvePath(requireString(contract.source_paths?.level_visual_assets, 'source_paths.level_visual_assets'), contractDir);
  const assetManifestPath = resolvePath(requireString(contract.source_paths?.asset_manifest, 'source_paths.asset_manifest'), contractDir);
  const sourceRoots = requireArray(contract.source_paths?.source_roots, 'source_paths.source_roots').map((sourceRoot) =>
    resolvePath(String(sourceRoot), contractDir),
  );
  const playerController = readFileSync(playerControllerPath, 'utf8');
  const gameSession = readFileSync(gameSessionPath, 'utf8');
  const levelVisualAssets = readFileSync(levelVisualAssetsPath, 'utf8');
  const assetManifest = loadJson(assetManifestPath, 'asset manifest');
  const assetRoot = resolvePath(requireString(assetManifest.canonical_asset_root, 'asset_manifest.canonical_asset_root'), dirname(assetManifestPath));
  const manifestAssets = new Set(requireArray(assetManifest.assets, 'asset_manifest.assets').map(String));
  const sourceFiles = collectSourceFiles(sourceRoots);
  const sourceTexts = sourceFiles.map((path) => ({ path, text: readFileSync(path, 'utf8') }));
  const mainlineAbilities = checkMainlineAbilities(contract, playerController, gameSession);
  const levelVisualChecks = checkLevelVisualAssets(contract, levelVisualAssets, assetRoot, manifestAssets);
  const resourcePathChecks = checkResourcePaths(sourceTexts, assetRoot, manifestAssets);
  const requiredAssetChecks = checkRequiredAssets(contract, assetRoot, manifestAssets);
  const labelChecks = checkUiLabels(sourceTexts, contract);
  const fallbackChecks = checkFallbackEvents(sourceTexts, contract);
  const unusedAssetChecks = checkUnusedAssets(manifestAssets, sourceTexts, contract);
  const checks = [
    ...mainlineAbilities.checks,
    ...levelVisualChecks.checks,
    ...requiredAssetChecks,
    ...resourcePathChecks.checks,
    ...labelChecks.checks,
    ...fallbackChecks.checks,
    ...unusedAssetChecks.checks,
  ];
  const failedChecks = checks.filter((check) => check.severity === 'error');
  const warnings = checks.filter((check) => check.severity === 'warning');
  const report = {
    contract_path: contractPath,
    source_paths: {
      player_controller: playerControllerPath,
      game_session: gameSessionPath,
      level_visual_assets: levelVisualAssetsPath,
      asset_manifest: assetManifestPath,
    },
    source_file_count: sourceFiles.length,
    mainline_abilities: mainlineAbilities.abilities,
    categories: {
      trace_fallbacks: fallbackChecks.count,
      ability_assets: mainlineAbilities.abilities.length,
      level_visual_assets: levelVisualChecks.textureAssets.length,
      audio_assets: countAudioAssets(contract),
      ui_labels: labelChecks.count,
      resource_paths: resourcePathChecks.count,
      unused_assets: unusedAssetChecks.count,
    },
    warnings,
    level_visuals: {
      polygon_terms: levelVisualChecks.polygonTerms,
      texture_assets: levelVisualChecks.textureAssets,
    },
    failed_checks: failedChecks,
  };

  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
  } else if (failedChecks.length > 0) {
    console.error(`[godot:asset-fallback-audit] failed ${failedChecks.length} check(s).`);
    for (const check of failedChecks) {
      console.error(`[godot:asset-fallback-audit] ${check.rule} ${check.message}`);
    }
  } else {
    console.log(
      `[godot:asset-fallback-audit] passed ${mainlineAbilities.abilities.length} ability mapping(s), ${resourcePathChecks.count} resource path(s), and ${labelChecks.count} label(s).`,
    );
  }

  process.exit(failedChecks.length > 0 ? 1 : 0);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const report = {
    contract_path: contractPath,
    categories: {
      trace_fallbacks: 0,
      ability_assets: 0,
      level_visual_assets: 0,
      audio_assets: 0,
      ui_labels: 0,
      resource_paths: 0,
      unused_assets: 0,
    },
    warnings: [],
    failed_checks: [{ rule: 'runtime_error', severity: 'error', message }],
  };
  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.error(`[godot:asset-fallback-audit] ${message}`);
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

function resolvePath(path, baseDir) {
  if (path.startsWith('res://')) {
    return resolve(repoRoot, 'godot', path.slice('res://'.length));
  }
  if (isAbsolute(path)) {
    return path;
  }
  const repoRelative = resolve(repoRoot, path);
  if (existsSync(repoRelative) || path.startsWith('godot/') || path.startsWith('scripts/') || path.startsWith('test/')) {
    return repoRelative;
  }
  return resolve(baseDir, path);
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

function collectSourceFiles(roots) {
  const files = [];
  for (const root of roots) {
    if (!existsSync(root)) {
      continue;
    }
    const stat = statSync(root);
    if (stat.isFile() && isReadableSource(root)) {
      files.push(root);
      continue;
    }
    if (!stat.isDirectory()) {
      continue;
    }
    for (const entry of readdirSync(root)) {
      files.push(...collectSourceFiles([join(root, entry)]));
    }
  }
  return files.sort((left, right) => relative(repoRoot, left).localeCompare(relative(repoRoot, right)));
}

function isReadableSource(path) {
  return ['.gd', '.tscn', '.tres', '.json', '.import'].includes(extname(path));
}

function checkMainlineAbilities(contract, playerController, gameSession) {
  const checks = [];
  const abilities = [];
  const textureReturns = parseMatchReturns(extractFunctionBody(playerController, 'get_ability_texture'));
  const sfxReturns = parseMatchReturns(extractFunctionBody(gameSession, 'get_ability_sfx'));
  const defaultSfx = sfxReturns.get('_') ?? '';

  if (defaultSfx === 'SfxAbilityFireAttack') {
    checks.push(buildCheck(contract, 'ability_sfx_default_fire_fallback', {
      message: 'get_ability_sfx must not use SfxAbilityFireAttack as the catch-all fallback.',
    }));
  }

  for (const ability of requireArray(contract.mainline_abilities, 'mainline_abilities')) {
    const id = requireString(ability.id, 'mainline_ability.id');
    const labels = [id, ...requireOptionalArray(ability.aliases, `${id}.aliases`).map(String)];
    const textureVar = requireString(ability.texture_var, `${id}.texture_var`);
    const allowedSfxStreams = requireArray(ability.allowed_sfx_streams, `${id}.allowed_sfx_streams`).map(String);
    const textureReturn = firstMappedReturn(textureReturns, labels);
    const sfxReturn = firstMappedReturn(sfxReturns, labels);
    const textureStatus = textureReturn === textureVar ? 'explicit' : 'missing';
    const sfxStatus = allowedSfxStreams.includes(sfxReturn) ? 'explicit' : 'missing';

    abilities.push({
      id,
      labels,
      texture_var: textureVar,
      texture_return: textureReturn,
      texture_status: textureStatus,
      allowed_sfx_streams: allowedSfxStreams,
      sfx_return: sfxReturn,
      sfx_status: sfxStatus,
    });

    if (textureStatus !== 'explicit') {
      checks.push(buildCheck(contract, 'mainline_ability_texture', {
        ability_id: id,
        expected_texture_var: textureVar,
        actual_texture_return: textureReturn,
        message: `${id} must map to ${textureVar} in get_ability_texture instead of falling through to fallback visuals.`,
      }));
    }

    if (sfxStatus !== 'explicit') {
      checks.push(buildCheck(contract, 'mainline_ability_sfx', {
        ability_id: id,
        allowed_sfx_streams: allowedSfxStreams,
        actual_sfx_return: sfxReturn,
        message: `${id} must map to an explicit ability SFX stream instead of relying on a catch-all fallback.`,
      }));
    }
  }

  return { abilities, checks };
}

function firstMappedReturn(returnMap, labels) {
  for (const label of labels) {
    const value = returnMap.get(label);
    if (value !== undefined) {
      return value;
    }
  }
  return '';
}

function parseMatchReturns(body) {
  const result = new Map();
  let pendingLabels = [];
  for (const line of body.split(/\r?\n/)) {
    const labelMatches = [...line.matchAll(/"([^"]+)"|(_):/g)];
    if (labelMatches.length > 0 && line.includes(':')) {
      pendingLabels = labelMatches.map((match) => match[1] ?? match[2]).filter(Boolean);
      continue;
    }
    const returnMatch = line.match(/^\s*return\s+([A-Za-z_][A-Za-z0-9_]*)/);
    if (returnMatch && pendingLabels.length > 0) {
      for (const label of pendingLabels) {
        result.set(label, returnMatch[1]);
      }
      pendingLabels = [];
    }
  }
  return result;
}

function extractFunctionBody(sourceText, functionName) {
  const match = sourceText.match(new RegExp(`func ${escapeRegExp(functionName)}\\([^\\n]*\\)(?:\\s*->\\s*[^:]+)?:([\\s\\S]*?)(?=\\n\\nfunc |\\n\\n@|\\n\\n$|$)`));
  return match?.[1] ?? '';
}

function checkRequiredAssets(contract, assetRoot, manifestAssets) {
  const checks = [];
  for (const assetPath of requireOptionalArray(contract.required_asset_paths, 'required_asset_paths').map(String)) {
    if (!manifestAssets.has(assetPath)) {
      checks.push(buildCheck(contract, 'missing_manifest_asset', {
        asset_path: assetPath,
        message: `required asset is not listed in asset_manifest.json: ${assetPath}.`,
      }));
    }
    if (!existsSync(join(assetRoot, assetPath))) {
      checks.push(buildCheck(contract, 'missing_asset_file', {
        asset_path: assetPath,
        message: `required asset file is missing: ${assetPath}.`,
      }));
    }
  }
  for (const assetPath of requireOptionalArray(contract.primary_enemy_assets, 'primary_enemy_assets').map(String)) {
    if (!manifestAssets.has(assetPath) || !existsSync(join(assetRoot, assetPath))) {
      checks.push(buildCheck(contract, 'missing_primary_enemy_asset', {
        asset_path: assetPath,
        message: `primary enemy asset must be present and listed in manifest: ${assetPath}.`,
      }));
    }
  }
  return checks;
}

function checkLevelVisualAssets(contract, levelVisualAssets, assetRoot, manifestAssets) {
  const checks = [];
  const texturePreloads = parseTexturePreloads(levelVisualAssets);
  const textureFunctionBody = extractFunctionBody(levelVisualAssets, 'get_texture_for_level');
  const polygonFunctionBody = extractFunctionBody(levelVisualAssets, 'should_texture_polygon');
  const polygonTerms = [];
  const textureAssets = [];

  for (const term of requireOptionalArray(contract.level_visuals?.required_polygon_name_terms, 'level_visuals.required_polygon_name_terms').map(String)) {
    const termPattern = new RegExp(`\\.contains\\("${escapeRegExp(term)}"\\)`);
    if (termPattern.test(polygonFunctionBody)) {
      polygonTerms.push(term);
    } else {
      checks.push(buildCheck(contract, 'missing_level_visual_polygon_term', {
        polygon_term: term,
        message: `LevelVisualAssets.should_texture_polygon must include ${term} polygons so terrain textures cover visible level geometry.`,
      }));
    }
  }

  for (const textureAsset of requireOptionalArray(contract.level_visuals?.required_texture_assets, 'level_visuals.required_texture_assets')) {
    const textureConst = requireString(textureAsset.texture_const, 'level_visuals.required_texture_assets.texture_const');
    const assetPath = requireString(textureAsset.asset_path, `${textureConst}.asset_path`);
    const actualAssetPath = texturePreloads.get(textureConst) ?? '';
    const assetStatus = actualAssetPath === assetPath && manifestAssets.has(assetPath) && existsSync(join(assetRoot, assetPath)) ? 'present' : 'missing';
    const mappingStatus = textureFunctionBody.includes(`return ${textureConst}`) ? 'used' : 'missing';

    textureAssets.push({
      texture_const: textureConst,
      expected_asset_path: assetPath,
      actual_asset_path: actualAssetPath,
      asset_status: assetStatus,
      mapping_status: mappingStatus,
    });

    if (assetStatus !== 'present') {
      checks.push(buildCheck(contract, 'missing_level_texture_asset', {
        texture_const: textureConst,
        expected_asset_path: assetPath,
        actual_asset_path: actualAssetPath,
        message: `${textureConst} must preload an existing manifest world texture asset: ${assetPath}.`,
      }));
    }

    if (mappingStatus !== 'used') {
      checks.push(buildCheck(contract, 'missing_level_texture_mapping', {
        texture_const: textureConst,
        expected_asset_path: assetPath,
        message: `LevelVisualAssets.get_texture_for_level must return ${textureConst} for at least one level family.`,
      }));
    }
  }

  return { polygonTerms, textureAssets, checks };
}

function parseTexturePreloads(sourceText) {
  const result = new Map();
  for (const match of sourceText.matchAll(/const\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*preload\("res:\/\/resources\/assets\/([^"]+)"\)/g)) {
    result.set(match[1], match[2]);
  }
  return result;
}

function checkResourcePaths(sourceTexts, assetRoot, manifestAssets) {
  const checks = [];
  const resourcePaths = new Set();
  for (const source of sourceTexts) {
    for (const match of source.text.matchAll(/res:\/\/resources\/assets\/([^"'\]\s)]+)/g)) {
      const assetPath = match[1];
      resourcePaths.add(assetPath);
      if (!manifestAssets.has(assetPath)) {
        checks.push({
          rule: 'resource_path_in_manifest',
          severity: 'error',
          path: reportPath(source.path),
          asset_path: assetPath,
          message: `resource path is not listed in asset_manifest.json: ${assetPath}.`,
        });
      }
      if (!existsSync(join(assetRoot, assetPath))) {
        checks.push({
          rule: 'resource_path_exists',
          severity: 'error',
          path: reportPath(source.path),
          asset_path: assetPath,
          message: `resource path points to a missing file: ${assetPath}.`,
        });
      }
    }
  }
  return { count: resourcePaths.size, checks };
}

function checkUiLabels(sourceTexts, contract) {
  const checks = [];
  let count = 0;
  const allowlist = new Set(requireOptionalArray(contract.allowed_empty_label_nodes, 'allowed_empty_label_nodes').map(String));
  for (const source of sourceTexts) {
    if (extname(source.path) !== '.tscn') {
      continue;
    }
    for (const block of source.text.split(/\n(?=\[node )/)) {
      const header = block.match(/\[node name="([^"]+)" type="Label"/);
      if (!header) {
        continue;
      }
      count += 1;
      const nodeName = header[1];
      const textMatch = block.match(/\ntext = "([^"]*)"/);
      if ((!textMatch || textMatch[1].trim() === '') && !allowlist.has(nodeName) && !allowlist.has(relative(repoRoot, source.path) + ':' + nodeName)) {
        checks.push(buildCheck(contract, 'empty_label_text', {
          path: reportPath(source.path),
          node_name: nodeName,
          message: `${relative(repoRoot, source.path)}:${nodeName} has empty Label text.`,
        }));
      }
    }
  }
  return { count, checks };
}

function checkFallbackEvents(sourceTexts, contract) {
  const checks = [];
  const fallbackEvents = new Set();
  const allowed = new Set(requireOptionalArray(contract.allowed_fallback_event_types, 'allowed_fallback_event_types').map(String));
  for (const source of sourceTexts) {
    for (const match of source.text.matchAll(/"([^"]*\.fallback(?:\.[^"]*)?)"/g)) {
      const eventType = match[1];
      fallbackEvents.add(eventType);
      if (!allowed.has(eventType)) {
        checks.push(buildCheck(contract, 'protected_fallback_event', {
          path: reportPath(source.path),
          event_type: eventType,
          message: `${eventType} is still observable; keep it out of protected mainline assets.`,
        }));
      }
    }
  }
  return { count: fallbackEvents.size, checks };
}

function checkUnusedAssets(manifestAssets, sourceTexts, contract) {
  const checks = [];
  const sourceBlob = sourceTexts.map((source) => source.text).join('\n');
  const allowedUnused = new Set(requireOptionalArray(contract.allowed_unused_assets, 'allowed_unused_assets').map(String));
  let count = 0;
  for (const assetPath of [...manifestAssets].sort()) {
    if (sourceBlob.includes(assetPath) || allowedUnused.has(assetPath)) {
      continue;
    }
    count += 1;
    checks.push(buildCheck(contract, 'unused_manifest_asset', {
      asset_path: assetPath,
      message: `asset_manifest.json lists an asset with no source reference: ${assetPath}.`,
    }));
  }
  return { count, checks };
}

function reportPath(path) {
  return relative(repoRoot, path);
}

function countAudioAssets(contract) {
  return requireOptionalArray(contract.required_asset_paths, 'required_asset_paths').filter((assetPath) => String(assetPath).startsWith('audio/')).length;
}

function buildCheck(contract, rule, details) {
  const severity = String(contract.rules?.[rule]?.severity ?? 'error');
  return { rule, severity, ...details };
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
