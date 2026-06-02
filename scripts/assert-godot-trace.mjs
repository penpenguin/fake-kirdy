import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const repoRoot = process.cwd();
const defaultAssertionsDir = join(repoRoot, 'godot', 'tests', 'trace_assertions');
const options = parseArgs(process.argv.slice(2));
const assertionFiles = collectAssertionFiles(options.assertionPath ?? defaultAssertionsDir);
const fileResults = assertionFiles.map((path) => runAssertionFile(path));
const failedChecks = fileResults.flatMap((result) => result.failed_checks);
const passedChecks = fileResults.reduce((sum, result) => sum + result.passed_checks.length, 0);
const assertionCount = fileResults.reduce((sum, result) => sum + result.assertion_count, 0);

const report = {
  assertion_file_count: assertionFiles.length,
  assertion_count: assertionCount,
  passed_checks: passedChecks,
  failed_checks: failedChecks,
  files: fileResults,
};

if (options.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  printHumanReport(report);
}

process.exit(failedChecks.length > 0 ? 1 : 0);

function parseArgs(args) {
  const parsed = {
    json: false,
    assertionPath: null,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--json') {
      parsed.json = true;
      continue;
    }
    if (arg === '--assertions') {
      parsed.assertionPath = readArgValue(args, index, arg);
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

function collectAssertionFiles(inputPath) {
  const absolutePath = resolve(repoRoot, inputPath);
  if (!existsSync(absolutePath)) {
    throw new Error(`Trace assertion path not found: ${inputPath}`);
  }
  if (statSync(absolutePath).isFile()) {
    return [absolutePath];
  }
  return listFiles(absolutePath)
    .filter((path) => extname(path) === '.json')
    .sort();
}

function listFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    if (entry.startsWith('.')) {
      continue;
    }
    const path = join(directory, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      files.push(...listFiles(path));
    } else if (stats.isFile()) {
      files.push(path);
    }
  }
  return files;
}

function runAssertionFile(path) {
  const assertionSet = readAssertionSet(path);
  const tracePath = resolveTracePath(assertionSet.trace_path, path);
  const events = readTrace(tracePath);
  const passedChecks = [];
  const failedChecks = [];

  for (const assertion of assertionSet.assertions) {
    const failure = runAssertion(assertion, events);
    if (failure === null) {
      passedChecks.push(assertion.id);
    } else {
      failedChecks.push({
        assertion_file: relativeToRepo(path),
        trace_path: relativeToRepo(tracePath),
        assertion_id: assertion.id,
        type: assertion.type,
        message: failure,
      });
    }
  }

  return {
    assertion_file: relativeToRepo(path),
    trace_path: relativeToRepo(tracePath),
    event_count: events.length,
    assertion_count: assertionSet.assertions.length,
    passed_checks: passedChecks,
    failed_checks: failedChecks,
  };
}

function readAssertionSet(path) {
  const parsed = JSON.parse(readFileSync(path, 'utf8'));
  if (parsed?.version !== 1) {
    throw new Error(`Trace assertion file must use version 1: ${path}`);
  }
  if (typeof parsed.trace_path !== 'string' || parsed.trace_path.length === 0) {
    throw new Error(`Trace assertion file is missing trace_path: ${path}`);
  }
  if (!Array.isArray(parsed.assertions)) {
    throw new Error(`Trace assertion file is missing assertions array: ${path}`);
  }
  return {
    trace_path: parsed.trace_path,
    assertions: parsed.assertions.map((assertion, index) => normalizeAssertion(assertion, index, path)),
  };
}

function normalizeAssertion(assertion, index, filePath) {
  if (typeof assertion?.id !== 'string' || assertion.id.length === 0) {
    throw new Error(`Assertion ${index} in ${filePath} is missing id`);
  }
  if (typeof assertion.type !== 'string' || assertion.type.length === 0) {
    throw new Error(`Assertion ${assertion.id} in ${filePath} is missing type`);
  }
  return assertion;
}

function resolveTracePath(tracePath, assertionFilePath) {
  if (tracePath.startsWith('/')) {
    return tracePath;
  }
  const repoRelative = resolve(repoRoot, tracePath);
  if (existsSync(repoRelative)) {
    return repoRelative;
  }
  return resolve(join(assertionFilePath, '..'), tracePath);
}

function readTrace(path) {
  if (!existsSync(path)) {
    throw new Error(`Trace file not found: ${path}`);
  }
  const raw = readFileSync(path, 'utf8').trim();
  if (raw.length === 0) {
    return [];
  }
  if (raw.startsWith('[')) {
    return JSON.parse(raw).map(normalizeEvent);
  }
  return raw.split(/\r?\n/).filter(Boolean).map((line) => normalizeEvent(JSON.parse(line)));
}

function normalizeEvent(event, index = 0) {
  return {
    ...event,
    frame: Number.isFinite(event.frame) ? event.frame : null,
    time_ms: Number.isFinite(event.time_ms) ? event.time_ms : null,
    event_type: String(event.event_type ?? 'unknown'),
    payload: event.payload ?? {},
  };
}

function runAssertion(assertion, events) {
  if (assertion.type === 'event_sequence') {
    return assertEventSequence(assertion, events);
  }
  if (assertion.type === 'payload_conditions') {
    return assertPayloadConditions(assertion, events);
  }
  if (assertion.type === 'forbidden_event') {
    return assertForbiddenEvent(assertion, events);
  }
  return `Unknown assertion type: ${assertion.type}`;
}

function assertEventSequence(assertion, events) {
  if (!Array.isArray(assertion.events) || assertion.events.length === 0) {
    return 'event_sequence assertions require a non-empty events array';
  }

  const matchedEvents = [];
  let searchStart = 0;
  for (const expected of assertion.events) {
    const expectedEventType = typeof expected === 'string' ? expected : expected.event_type;
    const foundIndex = events.findIndex((event, index) => index >= searchStart && event.event_type === expectedEventType);
    if (foundIndex < 0) {
      return `Missing event '${expectedEventType}' after sequence index ${matchedEvents.length}`;
    }
    const found = events[foundIndex];
    if (typeof expected === 'object' && expected.payload !== undefined) {
      const mismatches = getObjectSubsetMismatches(expected.payload, found.payload);
      if (mismatches.length > 0) {
        return `Event '${expectedEventType}' payload mismatches: ${mismatches.join(', ')}`;
      }
    }
    matchedEvents.push(found);
    searchStart = foundIndex + 1;
  }

  const first = matchedEvents[0];
  const last = matchedEvents[matchedEvents.length - 1];
  if (Number.isFinite(assertion.max_frame_span) && first.frame !== null && last.frame !== null) {
    const frameSpan = last.frame - first.frame;
    if (frameSpan > assertion.max_frame_span) {
      return `Event sequence frame span ${frameSpan} exceeded ${assertion.max_frame_span}`;
    }
  }
  if (Number.isFinite(assertion.max_time_ms) && first.time_ms !== null && last.time_ms !== null) {
    const timeSpan = last.time_ms - first.time_ms;
    if (timeSpan > assertion.max_time_ms) {
      return `Event sequence time span ${timeSpan}ms exceeded ${assertion.max_time_ms}ms`;
    }
  }

  return null;
}

function assertPayloadConditions(assertion, events) {
  const targetEvents = events.filter((event) => event.event_type === assertion.event_type);
  if (targetEvents.length === 0) {
    return `No events found for '${assertion.event_type}'`;
  }
  if (!Array.isArray(assertion.conditions) || assertion.conditions.length === 0) {
    return 'payload_conditions assertions require a non-empty conditions array';
  }

  const matchingEvent = targetEvents.find((event) =>
    assertion.conditions.every((condition) => evaluateCondition(condition, event)),
  );
  if (matchingEvent !== undefined) {
    return null;
  }

  const firstFailure = assertion.conditions.find((condition) => !evaluateCondition(condition, targetEvents[0]));
  return `No '${assertion.event_type}' event satisfied condition ${describeCondition(firstFailure)}`;
}

function assertForbiddenEvent(assertion, events) {
  const startIndex = assertion.after_event
    ? events.findIndex((event) => event.event_type === assertion.after_event) + 1
    : 0;
  if (startIndex === 0 && assertion.after_event) {
    return `after_event '${assertion.after_event}' was not found`;
  }
  const endIndex = assertion.until_event
    ? events.findIndex((event, index) => index >= startIndex && event.event_type === assertion.until_event)
    : events.length;
  const searchEnd = endIndex < 0 ? events.length : endIndex;
  const forbidden = events.slice(startIndex, searchEnd).find((event) => event.event_type === assertion.event_type);
  if (forbidden === undefined) {
    return null;
  }
  return `Forbidden event '${assertion.event_type}' found at frame ${forbidden.frame}`;
}

function evaluateCondition(condition, event) {
  const actual = readPath(event, condition.path);
  const expected = condition.other_path !== undefined ? readPath(event, condition.other_path) : condition.value;
  switch (condition.op) {
    case '==':
      return actual === expected;
    case '!=':
      return actual !== expected;
    case '>':
      return Number(actual) > Number(expected);
    case '>=':
      return Number(actual) >= Number(expected);
    case '<':
      return Number(actual) < Number(expected);
    case '<=':
      return Number(actual) <= Number(expected);
    case 'includes':
      return Array.isArray(actual) && actual.includes(expected);
    default:
      return false;
  }
}

function describeCondition(condition) {
  if (condition === undefined) {
    return '<unknown>';
  }
  const expected = condition.other_path ?? JSON.stringify(condition.value);
  return `${condition.path} ${condition.op} ${expected}`;
}

function readPath(object, path) {
  return String(path ?? '')
    .split('.')
    .filter(Boolean)
    .reduce((current, key) => current?.[key], object);
}

function getObjectSubsetMismatches(expected, actual) {
  return Object.entries(expected).flatMap(([key, expectedValue]) => {
    const actualValue = actual?.[key];
    if (actualValue === expectedValue) {
      return [];
    }
    return [`${key} expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualValue)}`];
  });
}

function printHumanReport(report) {
  console.log(`[godot:trace-assert] files=${report.assertion_file_count} assertions=${report.assertion_count}`);
  for (const failure of report.failed_checks) {
    console.log(`[godot:trace-assert] failed ${failure.assertion_id}: ${failure.message}`);
  }
  if (report.failed_checks.length === 0) {
    console.log('[godot:trace-assert] passed');
  }
}

function relativeToRepo(path) {
  return path.startsWith(repoRoot) ? relative(repoRoot, path) : path;
}
