import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const repoRoot = process.cwd();
const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const jsonOutput = args.includes('--json');
const scenarioDir = resolvePath(readOption('--scenario-dir') ?? join('godot', 'tests', 'replay_scripts'));

try {
  const scenarios = loadScenarios(scenarioDir);
  const outputs = scenarios.map((scenario) => {
    const outputPath = resolvePath(requireString(scenario.output_path, `${scenario.id}.output_path`));
    const replay = buildReplay(scenario);
    const nextText = `${JSON.stringify(replay, null, 2)}\n`;
    const currentText = existsSync(outputPath) ? readFileSync(outputPath, 'utf8') : '';
    const stale = currentText !== nextText;

    if (!checkOnly && stale) {
      mkdirSync(dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, nextText);
    }

    return {
      id: requireString(scenario.id, 'scenario.id'),
      output_path: outputPath,
      stale,
    };
  });

  const staleOutputs = outputs.filter((output) => output.stale).map((output) => output.output_path);
  const report = {
    scenario_dir: scenarioDir,
    scenario_count: scenarios.length,
    generated_count: checkOnly ? 0 : outputs.filter((output) => output.stale).length,
    stale_outputs: staleOutputs,
    outputs,
  };

  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
  } else if (checkOnly && staleOutputs.length > 0) {
    console.error(
      `[godot:replay-gen] ${staleOutputs.length} replay output(s) are stale; run npm run godot:replay-gen.`,
    );
  } else if (checkOnly) {
    console.log(`[godot:replay-gen] ${scenarios.length} replay scenario(s) are up to date.`);
  } else {
    console.log(`[godot:replay-gen] processed ${scenarios.length} replay scenario(s).`);
  }

  process.exit(checkOnly && staleOutputs.length > 0 ? 1 : 0);
} catch (error) {
  if (jsonOutput) {
    console.log(
      JSON.stringify(
        {
          scenario_dir: scenarioDir,
          scenario_count: 0,
          generated_count: 0,
          stale_outputs: [],
          failed_checks: [{ message: error instanceof Error ? error.message : String(error) }],
        },
        null,
        2,
      ),
    );
  } else {
    console.error(`[godot:replay-gen] ${error instanceof Error ? error.message : String(error)}`);
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

function loadScenarios(directory) {
  if (!existsSync(directory)) {
    throw new Error(`Missing replay scenario directory: ${directory}`);
  }

  return readdirSync(directory)
    .filter((entry) => entry.endsWith('.scenario.json'))
    .sort((left, right) => left.localeCompare(right))
    .map((entry) => {
      const path = join(directory, entry);
      const scenario = JSON.parse(readFileSync(path, 'utf8'));
      if (scenario?.version !== 1) {
        throw new Error(`${path} must declare version 1`);
      }
      return scenario;
    });
}

function buildReplay(scenario) {
  const replay = {
    start_level_id: requireString(scenario.start_level_id, `${scenario.id}.start_level_id`),
    start_spawn_id: requireString(scenario.start_spawn_id, `${scenario.id}.start_spawn_id`),
    ...(scenario.level_id === undefined ? {} : { level_id: requireString(scenario.level_id, `${scenario.id}.level_id`) }),
    fps: requireNumber(scenario.fps, `${scenario.id}.fps`),
    max_frames: requireNumber(scenario.max_frames, `${scenario.id}.max_frames`),
    frames: buildFrames(scenario),
  };

  return replay;
}

function buildFrames(scenario) {
  const frames = new Map();
  const deferredActions = [];
  if (scenario.initial_actions !== undefined) {
    assignActions(frames, 0, scenario.initial_actions);
  }

  for (const step of requireArray(scenario.steps, `${scenario.id}.steps`)) {
    applyStep(frames, step, scenario.id, deferredActions);
  }

  for (const deferredAction of deferredActions) {
    assignActions(frames, deferredAction.frame, { [deferredAction.action]: deferredAction.active });
  }

  return Array.from(frames.entries())
    .sort(([leftFrame], [rightFrame]) => leftFrame - rightFrame)
    .map(([frame, actions]) => ({ frame, actions }));
}

function applyStep(frames, step, scenarioId, deferredActions) {
  const frame = requireNumber(step.at, `${scenarioId}.step.at`);
  const actionType = requireString(step.do, `${scenarioId}.step.do`);

  if (actionType === 'move') {
    const direction = requireString(step.direction, `${scenarioId}.step.direction`);
    if (direction !== 'left' && direction !== 'right') {
      throw new Error(`${scenarioId}.step.direction must be left or right`);
    }
    assignActions(frames, frame, { [`move_${direction}`]: Boolean(step.active) });
    return;
  }

  if (actionType === 'hold') {
    assignActions(frames, frame, { [requireString(step.action, `${scenarioId}.step.action`)]: true });
    return;
  }

  if (actionType === 'release') {
    assignActions(frames, frame, { [requireString(step.action, `${scenarioId}.step.action`)]: false });
    return;
  }

  if (actionType === 'tap') {
    const action = requireString(step.action, `${scenarioId}.step.action`);
    assignActions(frames, frame, { [action]: true });
    deferredActions.push({ frame: frame + 1, action, active: false });
    return;
  }

  throw new Error(`${scenarioId}.step.do must be move, hold, release, or tap`);
}

function assignActions(frames, frame, actions) {
  if (!Number.isInteger(frame) || frame < 0) {
    throw new Error(`Replay frame must be a non-negative integer: ${frame}`);
  }

  const existing = frames.get(frame) ?? {};
  for (const [action, value] of Object.entries(actions)) {
    existing[action] = Boolean(value);
  }
  frames.set(frame, existing);
}

function requireArray(value, label) {
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
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be an integer`);
  }
  return value;
}
