import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const repoRoot = process.cwd();
const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const requireExport = args.includes('--require-export');
const requireBrowser = args.includes('--require-browser');
const contractPath = resolvePath(readOption('--contract') ?? join('godot', 'tests', 'web_smoke_contract.json'), repoRoot);

try {
  const contract = loadJson(contractPath, 'Web smoke contract');
  const exportDir = resolvePath(readOption('--export-dir') ?? requireString(contract.export_dir, 'export_dir'), dirname(contractPath));
  const staticChecks = checkStaticContract(contract, exportDir);
  const shouldRunBrowser = requireBrowser;
  const runtimeResult = shouldRunBrowser ? await runBrowserSmoke(contract, exportDir) : { checks: [], report: null };
  const checks = [...staticChecks.checks, ...runtimeResult.checks];
  const failedChecks = checks.filter((check) => check.severity === 'error');
  const warnings = checks.filter((check) => check.severity === 'warning');
  const report = {
    contract_path: contractPath,
    export_dir: exportDir,
    skipped: !requireExport && !staticChecks.export_artifacts.available,
    skip_reason: !requireExport && !staticChecks.export_artifacts.available ? 'Godot Web export artifacts are missing; run npm run build:public first' : null,
    runtime: runtimeResult.report,
    export_artifacts: staticChecks.export_artifacts,
    smoke_steps: staticChecks.smoke_steps,
    categories: {
      export_artifacts: requireArray(contract.required_artifacts, 'required_artifacts').length,
      smoke_steps: staticChecks.smoke_steps.length,
      server_headers: requireArray(contract.required_headers, 'required_headers').length,
      console_guards: requireArray(contract.forbidden_console_patterns, 'forbidden_console_patterns').length,
    },
    warnings,
    failed_checks: failedChecks,
  };

  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
  } else if (failedChecks.length > 0) {
    console.error(`[godot:web-smoke] failed ${failedChecks.length} check(s).`);
    for (const check of failedChecks) {
      console.error(`[godot:web-smoke] ${check.rule} ${check.message}`);
    }
  } else if (report.skipped) {
    console.log(`[godot:web-smoke] skipped: ${report.skip_reason}`);
  } else {
    const runtimeSuffix = runtimeResult.report != null ? `; runtime=${runtimeResult.report.status}` : '';
    console.log(`[godot:web-smoke] passed ${staticChecks.smoke_steps.length} smoke step(s)${runtimeSuffix}.`);
  }

  process.exit(failedChecks.length > 0 ? 1 : 0);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const report = {
    contract_path: contractPath,
    export_dir: null,
    skipped: false,
    runtime: null,
    export_artifacts: { available: false, files: [] },
    smoke_steps: [],
    categories: {
      export_artifacts: 0,
      smoke_steps: 0,
      server_headers: 0,
      console_guards: 0,
    },
    warnings: [],
    failed_checks: [{ rule: 'runtime_error', severity: 'error', message }],
  };
  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.error(`[godot:web-smoke] ${message}`);
  }
  process.exit(1);
}

function checkStaticContract(contract, exportDir) {
  const checks = [];
  const requiredArtifacts = requireArray(contract.required_artifacts, 'required_artifacts').map(String);
  const requiredHeaders = requireArray(contract.required_headers, 'required_headers').map(String);
  const smokeSteps = requireArray(contract.smoke_steps, 'smoke_steps').map((step) => normalizeSmokeStep(step));
  const artifactReport = checkExportArtifacts(contract, exportDir, requiredArtifacts);
  checks.push(...artifactReport.checks);

  const indexPath = join(exportDir, 'index.html');
  if (existsSync(indexPath)) {
    const html = readFileSync(indexPath, 'utf8');
    for (const marker of requireArray(contract.required_html_markers, 'required_html_markers').map(String)) {
      if (!html.includes(marker)) {
        checks.push(buildCheck(contract, 'html_marker', {
          marker,
          message: `index.html is missing required Web smoke marker ${marker}.`,
        }));
      }
    }
  }

  for (const header of requiredHeaders) {
    if (!supportedResponseHeaders().includes(header)) {
      checks.push(buildCheck(contract, 'server_header_contract', {
        header,
        message: `Web smoke static server does not provide required header ${header}.`,
      }));
    }
  }

  for (const category of ['canvas', 'input', 'pause', 'map']) {
    if (!smokeSteps.some((step) => step.category === category)) {
      checks.push(buildCheck(contract, 'smoke_step_coverage', {
        category,
        message: `Web smoke contract must include a ${category} step.`,
      }));
    }
  }

  return { checks, export_artifacts: artifactReport, smoke_steps: smokeSteps };
}

function checkExportArtifacts(contract, exportDir, requiredArtifacts) {
  const checks = [];
  const files = existsSync(exportDir) && statSync(exportDir).isDirectory() ? readdirSync(exportDir).sort() : [];
  const missing = [];
  for (const pattern of requiredArtifacts) {
    const found = artifactPatternMatches(files, pattern);
    if (!found) {
      missing.push(pattern);
      if (requireExport) {
        checks.push(buildCheck(contract, 'export_artifact', {
          artifact: pattern,
          message: `Godot Web export artifact is missing: ${pattern}.`,
        }));
      }
    }
  }
  return {
    available: missing.length === 0,
    export_dir: exportDir,
    files,
    missing,
    checks,
  };
}

function artifactPatternMatches(files, pattern) {
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(1);
    return files.some((file) => file.endsWith(suffix));
  }
  return files.includes(pattern);
}

async function runBrowserSmoke(contract, exportDir) {
  const checks = [];
  const runtime = contract.runtime ?? {};
  const artifactReport = checkExportArtifacts(contract, exportDir, requireArray(contract.required_artifacts, 'required_artifacts').map(String));
  if (!artifactReport.available) {
    checks.push(buildCheck(contract, 'export_artifact', {
      artifact: artifactReport.missing.join(', '),
      message: 'Cannot run required browser smoke because Godot Web export artifacts are missing.',
    }));
    return { checks, report: { status: 'failed', reason: 'missing_export_artifacts' } };
  }

  const browserExecutable = findBrowserExecutable();
  if (browserExecutable === null) {
    checks.push(buildCheck(contract, 'browser_missing', {
      message: 'Browser executable was not found. Set CHROME_BIN for Web smoke checks.',
    }));
    return { checks, report: { status: 'failed', reason: 'browser_missing' } };
  }
  if (typeof WebSocket !== 'function') {
    checks.push(buildCheck(contract, 'browser_missing', {
      message: 'Node WebSocket support is unavailable for Chrome DevTools Protocol checks.',
    }));
    return { checks, report: { status: 'failed', reason: 'websocket_unavailable' } };
  }

  const server = await startStaticServer(exportDir);
  const debugPort = await findOpenPort();
  const userDataDir = mkdtempSync(join(tmpdir(), 'fake-kirdy-web-smoke-profile-'));
  const browser = spawn(browserExecutable, [
    '--headless=new',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--disable-dev-shm-usage',
    '--no-sandbox',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    server.url,
  ], {
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let stderr = '';
  browser.stderr.setEncoding('utf8');
  browser.stderr.on('data', (chunk) => {
    stderr += chunk;
  });

  try {
    const target = await waitForPageTarget(debugPort, numberValue(runtime.max_boot_wait_ms, 12000));
    const cdp = await connectCdp(target.webSocketDebuggerUrl);
    const consoleMessages = [];
    cdp.on('Runtime.consoleAPICalled', (event) => {
      consoleMessages.push(formatConsoleApiMessage(event));
    });
    cdp.on('Runtime.exceptionThrown', (event) => {
      consoleMessages.push(String(event.exceptionDetails?.text ?? 'Runtime exception'));
    });
    cdp.on('Log.entryAdded', (event) => {
      consoleMessages.push(String(event.entry?.text ?? event.entry?.level ?? 'Log entry'));
    });
    await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');
    await cdp.send('Page.enable');
    await cdp.send('Runtime.evaluate', {
      expression: 'window.__fakeKirdySmokeConsoleErrors = []',
      returnByValue: true,
    });
    await sleep(numberValue(runtime.warmup_ms, 1500));
    await cdp.send('Runtime.evaluate', {
      expression: `window.__fakeKirdySmokeConsoleErrors = ${JSON.stringify(filterForbiddenConsoleMessages(consoleMessages, contract))}`,
      returnByValue: true,
    });
    const smokeResults = [];
    for (const step of requireArray(contract.smoke_steps, 'smoke_steps').map((entry) => normalizeSmokeStep(entry))) {
      const result = await cdp.send('Runtime.evaluate', {
        expression: step.expression,
        returnByValue: true,
      });
      const actual = result.result?.value;
      const passed = actual === step.expected;
      smokeResults.push({ ...step, actual, passed });
      if (!passed) {
        checks.push(buildCheck(contract, 'runtime_smoke_step', {
          step_id: step.id,
          message: `${step.id} expected ${JSON.stringify(step.expected)}, got ${JSON.stringify(actual)}.`,
        }));
      }
    }
    const metrics = await sampleBrowserFrames(cdp, numberValue(runtime.sample_ms, 900));
    await cdp.close();

    const forbiddenConsoleMessages = filterForbiddenConsoleMessages(consoleMessages, contract);
    for (const message of forbiddenConsoleMessages) {
      checks.push(buildCheck(contract, 'console_error', {
        message: `Forbidden console output matched Web smoke guard: ${snippet(message, 300)}.`,
      }));
    }
    if (metrics.canvas_count < numberValue(runtime.min_canvas_count, 1)) {
      checks.push(buildCheck(contract, 'runtime_canvas', {
        message: `Expected at least ${runtime.min_canvas_count ?? 1} canvas element(s), got ${metrics.canvas_count}.`,
      }));
    }
    if (metrics.fps < numberValue(runtime.min_fps, 20)) {
      checks.push(buildCheck(contract, 'runtime_fps', {
        message: `Expected at least ${runtime.min_fps ?? 20} requestAnimationFrame FPS, got ${metrics.fps}.`,
      }));
    }

    return {
      checks,
      report: {
        status: checks.length === 0 ? 'passed' : 'failed',
        browser_executable: browserExecutable,
        url: server.url,
        smoke_results: smokeResults,
        metrics,
        console_message_count: consoleMessages.length,
        console_messages: consoleMessages.slice(0, 10),
      },
    };
  } catch (error) {
    checks.push(buildCheck(contract, 'runtime_smoke_step', {
      step_id: 'browser_runtime',
      message: `${error instanceof Error ? error.message : String(error)} ${snippet(stderr, 500)}`.trim(),
    }));
    return { checks, report: { status: 'failed', reason: 'runtime_error' } };
  } finally {
    browser.kill('SIGTERM');
    await waitForBrowserExit(browser);
    await closeServer(server.server);
    safeRemoveBrowserProfile(userDataDir);
  }
}

function normalizeSmokeStep(step) {
  const id = requireString(step.id, 'smoke_step.id');
  const category = requireString(step.category, `${id}.category`);
  const expression = requireString(step.expression, `${id}.expression`);
  return {
    id,
    category,
    expression,
    expected: step.expected,
  };
}

function filterForbiddenConsoleMessages(messages, contract) {
  const patterns = requireArray(contract.forbidden_console_patterns, 'forbidden_console_patterns').map((pattern) => new RegExp(String(pattern), 'i'));
  return messages.filter((message) => patterns.some((pattern) => pattern.test(message)));
}

function formatConsoleApiMessage(event) {
  const args = Array.isArray(event.args) ? event.args : [];
  const text = args
    .map((arg) => String(arg.value ?? arg.description ?? arg.unserializableValue ?? ''))
    .filter((value) => value.length > 0)
    .join(' ')
    .trim();
  return text.length > 0 ? text : String(event.type ?? 'console');
}

function supportedResponseHeaders() {
  return ['Cross-Origin-Opener-Policy', 'Cross-Origin-Embedder-Policy', 'Content-Type'];
}

async function startStaticServer(directory) {
  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
    const pathname = decodeURIComponent(requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname);
    const normalizedPath = resolve(directory, `.${pathname}`);
    if (!normalizedPath.startsWith(directory)) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }
    if (!existsSync(normalizedPath) || !statSync(normalizedPath).isFile()) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }
    response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    response.setHeader('Content-Type', getContentType(normalizedPath));
    response.end(readFileSync(normalizedPath));
  });

  await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
  const address = server.address();
  return { server, url: `http://127.0.0.1:${address.port}/index.html` };
}

function getContentType(path) {
  switch (extname(path)) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
      return 'application/javascript; charset=utf-8';
    case '.wasm':
      return 'application/wasm';
    case '.pck':
      return 'application/octet-stream';
    default:
      return 'application/octet-stream';
  }
}

function findBrowserExecutable() {
  const candidates = [
    process.env.CHROME_BIN,
    process.env.BROWSER,
    'google-chrome-stable',
    'google-chrome',
    'chromium-browser',
    'chromium',
    'chrome',
  ].filter(Boolean);
  for (const candidate of candidates) {
    const result = spawnSync(candidate, ['--version'], { encoding: 'utf8' });
    if ((result.status ?? 1) === 0) {
      return candidate;
    }
  }
  return null;
}

async function findOpenPort() {
  const server = createServer();
  await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
  const port = server.address().port;
  await closeServer(server);
  return port;
}

async function waitForPageTarget(debugPort, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
      if (response.ok) {
        const targets = await response.json();
        const page = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);
        if (page) {
          return page;
        }
      }
    } catch {
      // Browser is still starting.
    }
    await sleep(100);
  }
  throw new Error(`Timed out waiting for browser remote-debugging-port ${debugPort}`);
}

async function connectCdp(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  const pending = new Map();
  const handlers = new Map();
  let nextId = 1;

  await new Promise((resolveOpen, rejectOpen) => {
    socket.addEventListener('open', resolveOpen, { once: true });
    socket.addEventListener('error', rejectOpen, { once: true });
  });

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data));
    if (message.id && pending.has(message.id)) {
      const { resolve: resolvePending, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) {
        reject(new Error(message.error.message ?? 'CDP command failed'));
      } else {
        resolvePending(message.result ?? {});
      }
      return;
    }
    const eventHandlers = handlers.get(message.method) ?? [];
    for (const handler of eventHandlers) {
      handler(message.params ?? {});
    }
  });

  return {
    send(method, params = {}) {
      const id = nextId;
      nextId += 1;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolvePending, reject) => {
        pending.set(id, { resolve: resolvePending, reject });
      });
    },
    on(method, handler) {
      const eventHandlers = handlers.get(method) ?? [];
      eventHandlers.push(handler);
      handlers.set(method, eventHandlers);
    },
    close() {
      socket.close();
    },
  };
}

async function sampleBrowserFrames(cdp, sampleMs) {
  const result = await cdp.send('Runtime.evaluate', {
    expression: `
      new Promise((resolve) => {
        const started = performance.now();
        let frames = 0;
        let last = started;
        let maxFrameMs = 0;
        function step(now) {
          frames += 1;
          maxFrameMs = Math.max(maxFrameMs, now - last);
          last = now;
          if (now - started >= ${JSON.stringify(sampleMs)}) {
            resolve({
              frames,
              duration_ms: now - started,
              fps: frames * 1000 / (now - started),
              max_frame_ms: maxFrameMs,
              canvas_count: document.querySelectorAll('canvas').length,
              ready_state: document.readyState
            });
            return;
          }
          requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      })
    `,
    awaitPromise: true,
    returnByValue: true,
  });
  return result.result.value;
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
  if (isAbsolute(path)) {
    return path;
  }
  const repoRelative = resolve(repoRoot, path);
  if (existsSync(repoRelative) || path.startsWith('godot/') || path.startsWith('dist') || path.startsWith('scripts/')) {
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

function requireString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function numberValue(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function closeServer(server) {
  return new Promise((resolveClose) => server.close(resolveClose));
}

function waitForBrowserExit(browserProcess, timeoutMs = 3000) {
  if (browserProcess.exitCode !== null || browserProcess.signalCode !== null) {
    return Promise.resolve();
  }
  return new Promise((resolveExit) => {
    const timeout = setTimeout(() => {
      if (browserProcess.exitCode === null && browserProcess.signalCode === null) {
        browserProcess.kill('SIGKILL');
      }
      resolveExit();
    }, timeoutMs);
    browserProcess.once('exit', () => {
      clearTimeout(timeout);
      resolveExit();
    });
  });
}

function safeRemoveBrowserProfile(profilePath) {
  try {
    rmSync(profilePath, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  } catch (error) {
    console.warn(`[godot:web-smoke] unable to remove browser profile ${profilePath}: ${error.message}`);
  }
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function snippet(text, maxLength = 1000) {
  const value = String(text ?? '').trim();
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}
