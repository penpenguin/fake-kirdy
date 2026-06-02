import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const repoRoot = process.cwd();
const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const updateBaselines = args.includes('--update');
const contractPath = resolvePath(readOption('--contract') ?? join('godot', 'tests', 'visual_snapshot_contract.json'));

try {
  const contract = loadJson(contractPath, 'visual snapshot contract');
  const snapshots = requireArray(contract.snapshots, 'snapshots').map((snapshot) => buildSnapshotReport(contract, snapshot));

  if (updateBaselines) {
    for (const snapshot of snapshots) {
      mkdirSync(dirname(snapshot.baseline_path), { recursive: true });
      writeFileSync(snapshot.baseline_path, `${JSON.stringify(buildBaseline(snapshot), null, 2)}\n`);
      snapshot.baseline_updated = true;
    }
  }

  const failedChecks = updateBaselines ? [] : [
    ...checkRequiredCoverage(contract, snapshots),
    ...checkSnapshotInputs(snapshots),
    ...checkBaselines(snapshots),
  ];

  const report = {
    contract_path: contractPath,
    snapshot_count: snapshots.length,
    coverage: buildCoverage(snapshots),
    baseline_updated_count: snapshots.filter((snapshot) => snapshot.baseline_updated).length,
    snapshots,
    failed_checks: failedChecks,
  };

  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
  } else if (failedChecks.length > 0) {
    console.error(`[godot:visual-snapshot] failed ${failedChecks.length} check(s).`);
    for (const check of failedChecks) {
      console.error(`[godot:visual-snapshot] ${check.rule} ${check.message}`);
    }
  } else if (updateBaselines) {
    console.log(`[godot:visual-snapshot] updated ${snapshots.length} visual snapshot baseline(s).`);
  } else {
    console.log(`[godot:visual-snapshot] passed ${snapshots.length} visual snapshot baseline(s).`);
  }

  process.exit(failedChecks.length > 0 ? 1 : 0);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (jsonOutput) {
    console.log(
      JSON.stringify(
        {
          contract_path: contractPath,
          snapshot_count: 0,
          coverage: {},
          snapshots: [],
          failed_checks: [{ rule: 'runtime_error', message }],
        },
        null,
        2,
      ),
    );
  } else {
    console.error(`[godot:visual-snapshot] ${message}`);
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

function repoRelative(path) {
  return path.startsWith(repoRoot) ? path.slice(repoRoot.length + 1) : path;
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

function buildSnapshotReport(contract, snapshot) {
  const id = requireString(snapshot.id, 'snapshot.id');
  const replayPath = resolvePath(requireString(snapshot.replay_path, `${id}.replay_path`));
  const baselinePath = resolvePath(requireString(snapshot.baseline_path, `${id}.baseline_path`));
  const visualTags = requireArray(snapshot.visual_tags, `${id}.visual_tags`).map(String).sort();
  const requiredScenePaths = requireOptionalArray(snapshot.required_scene_paths, `${id}.required_scene_paths`).map(resolvePath);
  const requiredResourcePaths = requireOptionalArray(snapshot.required_resource_paths, `${id}.required_resource_paths`).map(resolvePath);
  const frame = requireNumber(snapshot.frame, `${id}.frame`);
  const replay = existsSync(replayPath) ? JSON.parse(readFileSync(replayPath, 'utf8')) : null;
  const maxFrames = replay === null ? null : Number(replay.max_frames ?? 0);
  const viewport = {
    width: Number(snapshot.viewport?.width ?? contract.viewport?.width ?? 1280),
    height: Number(snapshot.viewport?.height ?? contract.viewport?.height ?? 720),
  };

  const source = {
    snapshot_id: id,
    replay_path: repoRelative(replayPath),
    replay_hash: fileHash(replayPath),
    frame,
    viewport,
    visual_tags: visualTags,
    required_scene_paths: requiredScenePaths.map(repoRelative).sort(),
    required_scene_hashes: Object.fromEntries(requiredScenePaths.map((path) => [repoRelative(path), fileHash(path)])),
    required_resource_paths: requiredResourcePaths.map(repoRelative).sort(),
    required_resource_hashes: Object.fromEntries(requiredResourcePaths.map((path) => [repoRelative(path), fileHash(path)])),
  };

  return {
    id,
    replay_path: replayPath,
    baseline_path: baselinePath,
    frame,
    max_frames: maxFrames,
    viewport,
    visual_tags: visualTags,
    required_scene_paths: requiredScenePaths,
    required_resource_paths: requiredResourcePaths,
    source,
    content_hash: hashObject(source),
    baseline: existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, 'utf8')) : null,
    baseline_updated: false,
  };
}

function buildBaseline(snapshot) {
  return {
    version: 1,
    snapshot_id: snapshot.id,
    content_hash: snapshot.content_hash,
    replay_path: repoRelative(snapshot.replay_path),
    frame: snapshot.frame,
    viewport: snapshot.viewport,
    visual_tags: snapshot.visual_tags,
    required_scene_paths: snapshot.required_scene_paths.map(repoRelative).sort(),
    required_resource_paths: snapshot.required_resource_paths.map(repoRelative).sort(),
  };
}

function checkSnapshotInputs(snapshots) {
  const failedChecks = [];
  for (const snapshot of snapshots) {
    if (!existsSync(snapshot.replay_path)) {
      failedChecks.push({
        rule: 'missing_replay',
        snapshot_id: snapshot.id,
        message: `${snapshot.id} replay is missing: ${snapshot.replay_path}`,
      });
    }
    if (snapshot.max_frames !== null && snapshot.frame > snapshot.max_frames) {
      failedChecks.push({
        rule: 'frame_out_of_range',
        snapshot_id: snapshot.id,
        message: `${snapshot.id} frame ${snapshot.frame} exceeds replay max_frames ${snapshot.max_frames}`,
      });
    }
    for (const scenePath of snapshot.required_scene_paths) {
      if (!existsSync(scenePath)) {
        failedChecks.push({
          rule: 'missing_scene',
          snapshot_id: snapshot.id,
          message: `${snapshot.id} required scene is missing: ${scenePath}`,
        });
      }
    }
    for (const resourcePath of snapshot.required_resource_paths) {
      if (!existsSync(resourcePath)) {
        failedChecks.push({
          rule: 'missing_resource',
          snapshot_id: snapshot.id,
          message: `${snapshot.id} required resource is missing: ${resourcePath}`,
        });
      }
    }
  }
  return failedChecks;
}

function checkBaselines(snapshots) {
  const failedChecks = [];
  for (const snapshot of snapshots) {
    if (snapshot.baseline === null) {
      failedChecks.push({
        rule: 'missing_baseline',
        snapshot_id: snapshot.id,
        message: `${snapshot.id} baseline is missing; run npm run godot:visual-snapshot -- --update`,
      });
      continue;
    }
    if (snapshot.baseline.content_hash !== snapshot.content_hash) {
      failedChecks.push({
        rule: 'baseline_stale',
        snapshot_id: snapshot.id,
        expected_hash: snapshot.content_hash,
        actual_hash: snapshot.baseline.content_hash,
        message: `${snapshot.id} baseline is stale; run npm run godot:visual-snapshot -- --update`,
      });
    }
  }
  return failedChecks;
}

function checkRequiredCoverage(contract, snapshots) {
  const requiredTags = requireOptionalArray(contract.required_visual_tags, 'required_visual_tags');
  const coverage = buildCoverage(snapshots);
  return requiredTags
    .filter((tag) => Number(coverage[tag] ?? 0) <= 0)
    .map((tag) => ({
      rule: 'coverage',
      snapshot_id: '',
      message: `visual snapshot coverage is missing required tag ${tag}`,
    }));
}

function buildCoverage(snapshots) {
  const coverage = {};
  for (const snapshot of snapshots) {
    for (const tag of snapshot.visual_tags) {
      coverage[tag] = (coverage[tag] ?? 0) + 1;
    }
  }
  return Object.fromEntries(Object.entries(coverage).sort(([left], [right]) => left.localeCompare(right)));
}

function fileHash(path) {
  if (!existsSync(path)) {
    return null;
  }
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function hashObject(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
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
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return value;
}
