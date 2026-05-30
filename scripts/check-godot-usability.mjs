import { existsSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const repoRoot = process.cwd();
const godotRoot = join(repoRoot, 'godot');
const defaultContractPath = join(godotRoot, 'tests', 'usability_accessibility_contract.json');
const defaultSuitePath = join(godotRoot, 'tests', 'replay_suite.json');
const options = parseArgs(process.argv.slice(2));
const contractPath = resolve(repoRoot, options.contractPath ?? defaultContractPath);
const suitePath = resolve(repoRoot, options.suitePath ?? defaultSuitePath);

const contract = readContract(contractPath);
const failures = [];
const projectText = readText(join(godotRoot, 'project.godot'));
const actions = parseInputActions(projectText);

for (const action of contract.required_keyboard_actions) {
  const eventsText = actions.get(action);
  if (eventsText === undefined) {
    failures.push(`missing input action: ${action}`);
    continue;
  }
  if (!eventsText.includes('InputEventKey')) {
    failures.push(`input action has no keyboard event: ${action}`);
  }
}

const suite = JSON.parse(readText(suitePath));
const replayIds = new Set((suite.replays ?? []).map((replay) => replay.id));
for (const replayId of contract.required_replay_ids) {
  if (!replayIds.has(replayId)) {
    failures.push(`missing representative replay: ${replayId}`);
  }
}

for (const sceneName of contract.required_ui_scenes) {
  const scenePath = join(godotRoot, 'scenes', 'ui', sceneName);
  if (!existsSync(scenePath)) {
    failures.push(`missing UI scene: ${sceneName}`);
    continue;
  }
  const sceneText = readText(scenePath);
  const labelCount = countMatches(sceneText, /type="Label"/g);
  const buttonCount = countMatches(sceneText, /type="Button"/g);
  const textCount = countMatches(sceneText, /^\s*text\s*=\s*".+"/gm);
  if (labelCount + buttonCount <= 0) {
    failures.push(`UI scene has no visible controls: ${sceneName}`);
  }
  if (textCount <= 0) {
    failures.push(`UI scene has no visible text: ${sceneName}`);
  }
}

for (const requirement of contract.required_visual_feedback_tokens) {
  const filePath = resolve(repoRoot, requirement.file);
  if (!existsSync(filePath)) {
    failures.push(`missing visual feedback file: ${requirement.file}`);
    continue;
  }
  if (!readText(filePath).includes(requirement.token)) {
    failures.push(`missing visual feedback token ${requirement.token} in ${requirement.file}`);
  }
}

const mapOverlayText = readText(join(godotRoot, 'scripts', 'ui', 'MapOverlay.gd'));
const colorRoles = new Map();
for (const role of contract.required_color_roles) {
  const color = parseExportedColor(mapOverlayText, role);
  if (color === null) {
    failures.push(`missing color role: ${role}`);
    continue;
  }
  colorRoles.set(role, color);
}
failures.push(...assertMinimumColorDistance(colorRoles, contract.min_color_distance));

const result = {
  contract_path: relativeToRepo(contractPath),
  suite_path: relativeToRepo(suitePath),
  checked_keyboard_actions: contract.required_keyboard_actions.length,
  checked_replay_ids: contract.required_replay_ids.length,
  checked_ui_scenes: contract.required_ui_scenes.length,
  checked_color_roles: colorRoles.size,
  failed_checks: failures,
  status: failures.length === 0 ? 'passed' : 'failed',
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
process.exit(failures.length > 0 ? 1 : 0);

function parseInputActions(projectText) {
  const inputSection = projectText.split('[input]')[1]?.split(/\n\[[^\]]+\]/)[0] ?? '';
  const actionMap = new Map();
  const actionRegex = /^([a-zA-Z0-9_]+)=\{\n([\s\S]*?)\n\}/gm;
  let match = actionRegex.exec(inputSection);
  while (match !== null) {
    actionMap.set(match[1], match[2]);
    match = actionRegex.exec(inputSection);
  }
  return actionMap;
}

function parseExportedColor(source, role) {
  const regex = new RegExp(`@export var ${escapeRegExp(role)}: Color = Color\\(([^)]+)\\)`);
  const match = source.match(regex);
  if (match === null) {
    return null;
  }

  const channels = match[1].split(',').map((value) => Number(value.trim()));
  if (channels.length < 3 || channels.some((value) => !Number.isFinite(value))) {
    return null;
  }
  return channels.slice(0, 3);
}

function assertMinimumColorDistance(colorRoles, minimumDistance) {
  const colorFailures = [];
  const entries = [...colorRoles.entries()];
  for (let leftIndex = 0; leftIndex < entries.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < entries.length; rightIndex += 1) {
      const [leftRole, leftColor] = entries[leftIndex];
      const [rightRole, rightColor] = entries[rightIndex];
      const distance = calculateColorDistance(leftColor, rightColor);
      if (distance < minimumDistance) {
        colorFailures.push(
          `color roles too similar: ${leftRole} and ${rightRole} distance ${distance.toFixed(3)} < ${minimumDistance}`,
        );
      }
    }
  }
  return colorFailures;
}

function calculateColorDistance(leftColor, rightColor) {
  return Math.sqrt(
    (leftColor[0] - rightColor[0]) ** 2 +
    (leftColor[1] - rightColor[1]) ** 2 +
    (leftColor[2] - rightColor[2]) ** 2,
  );
}

function readContract(path) {
  if (!existsSync(path)) {
    throw new Error(`Usability/accessibility contract not found: ${path}`);
  }
  const parsed = JSON.parse(readText(path));
  if (parsed?.version !== 1) {
    throw new Error('Usability/accessibility contract must be version 1');
  }
  for (const key of [
    'required_keyboard_actions',
    'required_replay_ids',
    'required_ui_scenes',
    'required_visual_feedback_tokens',
    'required_color_roles',
  ]) {
    if (!Array.isArray(parsed[key]) || parsed[key].length === 0) {
      throw new Error(`Usability/accessibility contract has invalid ${key}`);
    }
  }
  if (!Number.isFinite(parsed.min_color_distance) || parsed.min_color_distance <= 0) {
    throw new Error('Usability/accessibility contract has invalid min_color_distance');
  }
  return parsed;
}

function parseArgs(args) {
  const parsed = {
    contractPath: null,
    suitePath: null,
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--contract') {
      parsed.contractPath = readArgValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === '--suite') {
      parsed.suitePath = readArgValue(args, index, arg);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function readArgValue(args, index, flag) {
  const value = args[index + 1];
  if (typeof value !== 'string' || value.length === 0 || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function readText(path) {
  return readFileSync(path, 'utf8');
}

function countMatches(source, regex) {
  return [...source.matchAll(regex)].length;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function relativeToRepo(path) {
  return path.startsWith(repoRoot) ? path.slice(repoRoot.length + 1) : basename(path);
}
