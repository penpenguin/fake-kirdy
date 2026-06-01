import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const repoRoot = process.cwd();
const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const checkOnly = args.includes('--check');
const contractPath = resolvePath(readOption('--contract') ?? 'godot/tests/playtest_report_contract.json');

try {
  const contract = loadJson(contractPath, 'playtest report contract');
  const tracePath = resolvePath(readOption('--trace') ?? requireString(contract.trace_path, 'trace_path'));
  const bookmarksPath = resolvePath(readOption('--bookmarks') ?? requireString(contract.bookmarks_path, 'bookmarks_path'));
  const outputJsonPath = resolvePath(readOption('--out-json') ?? requireString(contract.output_json_path, 'output_json_path'));
  const outputMarkdownPath = resolvePath(readOption('--out-md') ?? requireString(contract.output_markdown_path, 'output_markdown_path'));
  const events = parseTrace(readFileSync(tracePath, 'utf8'));
  const bookmarks = parseBookmarks(loadJson(bookmarksPath, 'playtest bookmarks'));
  const report = buildPlaytestReport(contract, events, bookmarks, tracePath, bookmarksPath);
  const markdown = renderMarkdown(report);
  const checks = validateReport(contract, report);

  if (checks.length === 0 && checkOnly) {
    const expectedJson = `${JSON.stringify(report, null, 2)}\n`;
    if (!existsSync(outputJsonPath) || readFileSync(outputJsonPath, 'utf8') !== expectedJson) {
      checks.push({
        rule: 'report_freshness',
        severity: 'error',
        message: `${outputJsonPath} is not current. Run npm run godot:playtest-report.`,
      });
    }
    if (!existsSync(outputMarkdownPath) || readFileSync(outputMarkdownPath, 'utf8') !== markdown) {
      checks.push({
        rule: 'report_freshness',
        severity: 'error',
        message: `${outputMarkdownPath} is not current. Run npm run godot:playtest-report.`,
      });
    }
  }

  if (checks.length === 0 && !checkOnly) {
    writeText(outputJsonPath, `${JSON.stringify(report, null, 2)}\n`);
    writeText(outputMarkdownPath, markdown);
  }

  const commandReport = {
    contract_path: contractPath,
    trace_path: tracePath,
    bookmarks_path: bookmarksPath,
    output_json_path: outputJsonPath,
    output_markdown_path: outputMarkdownPath,
    sample_count: report.samples.length,
    bookmark_count: report.bookmarks.length,
    generated_task_count: report.generated_tasks.length,
    unresolved_issue_count: report.unresolved_issue_count,
    failed_checks: checks,
  };

  if (jsonOutput) {
    console.log(JSON.stringify(commandReport, null, 2));
  } else if (checks.length > 0) {
    console.error(`[godot:playtest-report] failed ${checks.length} check(s).`);
    for (const check of checks) {
      console.error(`[godot:playtest-report] ${check.rule} ${check.message}`);
    }
  } else if (checkOnly) {
    console.log(`[godot:playtest-report] report is current; samples=${report.samples.length} bookmarks=${report.bookmarks.length}.`);
  } else {
    console.log(`[godot:playtest-report] wrote ${outputJsonPath} and ${outputMarkdownPath}.`);
  }

  process.exit(checks.length > 0 ? 1 : 0);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const commandReport = {
    contract_path: contractPath,
    sample_count: 0,
    bookmark_count: 0,
    generated_task_count: 0,
    unresolved_issue_count: 0,
    failed_checks: [{ rule: 'runtime_error', severity: 'error', message }],
  };
  if (jsonOutput) {
    console.log(JSON.stringify(commandReport, null, 2));
  } else {
    console.error(`[godot:playtest-report] ${message}`);
  }
  process.exit(1);
}

function buildPlaytestReport(contract, events, bookmarks, tracePath, bookmarksPath) {
  const sampleIntervalMs = requirePositiveNumber(contract.sample_interval_ms, 'sample_interval_ms');
  const recentEventLimit = requirePositiveInteger(contract.recent_event_limit, 'recent_event_limit');
  const issueKinds = new Set(requireArray(contract.issue_bookmark_kinds, 'issue_bookmark_kinds').map(String));
  const issueCategories = requireArray(contract.issue_categories, 'issue_categories').map(String);
  const sortedEvents = [...events].sort((a, b) => eventTime(a) - eventTime(b));
  const samples = [];
  const recentEvents = [];
  const state = {
    level_id: null,
    position: null,
    hp: null,
    ability_type: null,
    enemy_count: null,
    fps: null,
    screenshot_path: null,
  };
  let nextSampleAt = 0;

  for (const event of sortedEvents) {
    updateState(state, event);
    const eventType = String(event.event_type ?? 'unknown');
    recentEvents.push(eventType);
    while (recentEvents.length > recentEventLimit) {
      recentEvents.shift();
    }

    const timeMs = eventTime(event);
    if (samples.length === 0 || eventType === 'playtest.sample' || timeMs >= nextSampleAt) {
      samples.push({
        frame: numberOrNull(event.frame),
        time_ms: timeMs,
        level_id: state.level_id,
        position: state.position,
        hp: state.hp,
        ability_type: state.ability_type,
        enemy_count: state.enemy_count,
        fps: state.fps,
        screenshot_path: state.screenshot_path,
        recent_events: [...recentEvents],
      });
      nextSampleAt = timeMs + sampleIntervalMs;
    }
  }

  const normalizedBookmarks = bookmarks.map((bookmark) => normalizeBookmark(bookmark, samples));
  const issueBookmarks = normalizedBookmarks.filter((bookmark) => issueKinds.has(bookmark.kind) && bookmark.status !== 'resolved');
  const coverage = Object.fromEntries(
    issueCategories.map((category) => [category, issueBookmarks.some((bookmark) => bookmark.category === category)]),
  );
  const generatedTasks = issueBookmarks.map((bookmark) => buildTask(bookmark));

  return {
    version: 1,
    generated_at: '1970-01-01T00:00:00.000Z',
    source: {
      trace_path: relativePath(tracePath),
      bookmarks_path: relativePath(bookmarksPath),
    },
    summary: {
      duration_ms: sortedEvents.length > 0 ? eventTime(sortedEvents.at(-1)) - eventTime(sortedEvents[0]) : 0,
      event_count: sortedEvents.length,
      sample_count: samples.length,
      bookmark_count: normalizedBookmarks.length,
      generated_task_count: generatedTasks.length,
    },
    coverage,
    unresolved_issue_count: issueBookmarks.length,
    samples,
    bookmarks: normalizedBookmarks,
    generated_tasks: generatedTasks,
  };
}

function validateReport(contract, report) {
  const checks = [];
  const requiredSampleFields = requireArray(contract.required_sample_fields, 'required_sample_fields').map(String);
  const requiredBookmarkFields = requireArray(contract.required_bookmark_fields, 'required_bookmark_fields').map(String);

  if (report.samples.length === 0) {
    checks.push({ rule: 'sample_count', severity: 'error', message: 'Playtest report must contain at least one sample.' });
  }

  for (const [index, sample] of report.samples.entries()) {
    for (const field of requiredSampleFields) {
      if (!hasField(sample, field)) {
        checks.push({
          rule: 'sample_field',
          severity: 'error',
          sample_index: index,
          field,
          message: `Playtest sample ${index} is missing required field ${field}.`,
        });
      }
    }
  }

  for (const [index, bookmark] of report.bookmarks.entries()) {
    for (const field of requiredBookmarkFields) {
      if (!hasField(bookmark, field)) {
        checks.push({
          rule: 'bookmark_field',
          severity: 'error',
          bookmark_index: index,
          field,
          message: `Playtest bookmark ${index} is missing required field ${field}.`,
        });
      }
    }
  }

  return checks;
}

function renderMarkdown(report) {
  const lines = [
    '# Godot Playtest Report',
    '',
    `- Samples: ${report.summary.sample_count}`,
    `- Bookmarks: ${report.summary.bookmark_count}`,
    `- Unresolved issues: ${report.unresolved_issue_count}`,
    `- Duration: ${report.summary.duration_ms}ms`,
    '',
    '## Coverage',
    '',
  ];
  for (const [category, active] of Object.entries(report.coverage)) {
    lines.push(`- ${category}: ${active ? 'issue observed' : 'not reproduced'}`);
  }
  lines.push('', '## Recent Samples', '');
  for (const sample of report.samples.slice(-5)) {
    lines.push(`- ${sample.time_ms}ms ${sample.level_id} hp=${sample.hp} ability=${sample.ability_type} fps=${sample.fps}`);
  }
  lines.push('', '## Generated Tasks', '');
  if (report.generated_tasks.length === 0) {
    lines.push('- None');
  } else {
    for (const task of report.generated_tasks) {
      lines.push(`- ${task.title}`);
    }
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function updateState(state, event) {
  const payload = event.payload && typeof event.payload === 'object' ? event.payload : {};
  state.level_id = stringOrNull(event.level_id ?? payload.level_id) ?? state.level_id;
  state.position = parsePosition(event.player?.position ?? event.player ?? payload.player_position ?? payload.position) ?? state.position;
  state.hp = numberOrNull(payload.hp ?? event.player?.hp) ?? state.hp;
  state.ability_type = stringOrNull(payload.ability_type ?? payload.ability) ?? state.ability_type;
  state.enemy_count = numberOrNull(payload.enemy_count ?? payload.enemies_alive) ?? state.enemy_count;
  state.fps = numberOrNull(payload.fps ?? payload.average_fps) ?? state.fps;
  state.screenshot_path = stringOrNull(payload.screenshot_path ?? payload.screenshot) ?? state.screenshot_path;
}

function normalizeBookmark(bookmark, samples) {
  const nearestSample = findNearestSample(bookmark, samples);
  return {
    id: stringOrNull(bookmark.id),
    kind: stringOrNull(bookmark.kind) ?? 'note',
    category: stringOrNull(bookmark.category),
    severity: stringOrNull(bookmark.severity) ?? 'info',
    status: stringOrNull(bookmark.status) ?? 'open',
    note: stringOrNull(bookmark.note),
    level_id: stringOrNull(bookmark.level_id) ?? nearestSample?.level_id ?? null,
    frame: numberOrNull(bookmark.frame),
    time_ms: numberOrNull(bookmark.time_ms),
    position: parsePosition(bookmark.position) ?? nearestSample?.position ?? null,
    screenshot_path: stringOrNull(bookmark.screenshot_path) ?? nearestSample?.screenshot_path ?? null,
    recent_events: nearestSample?.recent_events ?? [],
  };
}

function buildTask(bookmark) {
  const title = `[playtest] ${bookmark.category}: ${bookmark.note}`;
  const body = [
    `Bookmark: ${bookmark.id}`,
    `Severity: ${bookmark.severity}`,
    `Level: ${bookmark.level_id}`,
    `Time: ${bookmark.time_ms ?? 'unknown'}ms`,
    `Position: ${bookmark.position ? `${bookmark.position.x}, ${bookmark.position.y}` : 'unknown'}`,
    `Screenshot: ${bookmark.screenshot_path ?? 'not captured'}`,
    '',
    bookmark.note,
  ].join('\n');
  return { title, body, category: bookmark.category, severity: bookmark.severity, bookmark_id: bookmark.id };
}

function findNearestSample(bookmark, samples) {
  const bookmarkTime = numberOrNull(bookmark.time_ms);
  if (bookmarkTime === null || samples.length === 0) {
    return samples.at(-1) ?? null;
  }
  return samples.reduce((best, sample) => {
    if (best === null) {
      return sample;
    }
    return Math.abs(sample.time_ms - bookmarkTime) < Math.abs(best.time_ms - bookmarkTime) ? sample : best;
  }, null);
}

function parseTrace(raw) {
  const text = raw.trim();
  if (text.length === 0) {
    return [];
  }
  if (text.startsWith('[')) {
    return JSON.parse(text);
  }
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function parseBookmarks(value) {
  if (Array.isArray(value)) {
    return value;
  }
  return requireArray(value.bookmarks, 'bookmarks');
}

function loadJson(path, label) {
  if (!existsSync(path)) {
    throw new Error(`${label} not found: ${path}`);
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readOption(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function resolvePath(path) {
  return resolve(repoRoot, path);
}

function relativePath(path) {
  return path.startsWith(`${repoRoot}/`) ? path.slice(repoRoot.length + 1) : path;
}

function writeText(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

function requireString(value, label) {
  const parsed = stringOrNull(value);
  if (parsed === null) {
    throw new Error(`${label} must be a string.`);
  }
  return parsed;
}

function requireArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }
  return value;
}

function requirePositiveNumber(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive number.`);
  }
  return parsed;
}

function requirePositiveInteger(value, label) {
  const parsed = requirePositiveNumber(value, label);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${label} must be an integer.`);
  }
  return parsed;
}

function eventTime(event) {
  return numberOrNull(event.time_ms) ?? numberOrNull(event.frame) ?? 0;
}

function parsePosition(value) {
  if (value === null || typeof value !== 'object') {
    return null;
  }
  const x = numberOrNull(value.x);
  const y = numberOrNull(value.y);
  return x === null || y === null ? null : { x, y };
}

function hasField(value, field) {
  const fieldValue = value?.[field];
  if (fieldValue === null || fieldValue === undefined) {
    return false;
  }
  if (Array.isArray(fieldValue)) {
    return fieldValue.length > 0;
  }
  if (typeof fieldValue === 'string') {
    return fieldValue.length > 0;
  }
  return true;
}

function stringOrNull(value) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
