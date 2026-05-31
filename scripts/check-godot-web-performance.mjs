import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const repoRoot = process.cwd();
const godotRoot = join(repoRoot, 'godot');
const defaultBudgetPath = join(godotRoot, 'tests', 'web_performance_budget.json');

const options = parseArgs(process.argv.slice(2));
const budgetPath = resolve(repoRoot, options.budgetPath ?? defaultBudgetPath);
const budget = readBudget(budgetPath);
const exportDir = resolve(repoRoot, options.exportDir ?? budget.export_dir);
const outPath = options.outPath === null ? null : resolve(repoRoot, options.outPath);
const failedChecks = [];

if (!hasGodotWebExportArtifacts(exportDir)) {
  writeResult({
    skipped: true,
    reason: 'Godot Web export artifacts are missing; run npm run build:public first',
    budget_path: relativeToRepo(budgetPath),
    export_dir: relativeToRepo(exportDir),
  });
  process.exit(0);
}

const browserExecutable = findBrowserExecutable();
if (browserExecutable === null) {
  writeResult({
    skipped: true,
    reason: 'Browser executable was not found',
    budget_path: relativeToRepo(budgetPath),
    export_dir: relativeToRepo(exportDir),
  });
  process.exit(0);
}

if (typeof WebSocket !== 'function') {
  writeResult({
    skipped: true,
    reason: 'Node WebSocket support is unavailable',
    budget_path: relativeToRepo(budgetPath),
    export_dir: relativeToRepo(exportDir),
  });
  process.exit(0);
}

const server = await startStaticServer(exportDir);
const debugPort = await findOpenPort();
const userDataDir = mkdtempSync(join(tmpdir(), 'fake-kirdy-browser-profile-'));
const browser = spawn(browserExecutable, [
  '--headless=new',
  '--disable-gpu',
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
  const pageTarget = await waitForPageTarget(debugPort, budget.max_boot_wait_ms);
  const cdp = await connectCdp(pageTarget.webSocketDebuggerUrl);
  await cdp.send('Runtime.enable');
  await sleep(budget.warmup_ms);
  const browserMetrics = await sampleBrowserFrames(cdp, budget.sample_ms);
  await cdp.close();

  if (browserMetrics.canvas_count < 1) {
    failedChecks.push({
      scope: 'browser',
      metric: 'canvas_count',
      actual: browserMetrics.canvas_count,
      budget: 1,
    });
  }
  if (browserMetrics.fps < budget.min_browser_raf_fps) {
    failedChecks.push({
      scope: 'browser',
      metric: 'min_browser_raf_fps',
      actual: browserMetrics.fps,
      budget: budget.min_browser_raf_fps,
    });
  }
  if (browserMetrics.max_frame_ms > budget.max_browser_frame_ms) {
    failedChecks.push({
      scope: 'browser',
      metric: 'max_browser_frame_ms',
      actual: browserMetrics.max_frame_ms,
      budget: budget.max_browser_frame_ms,
    });
  }

  writeResult({
    skipped: false,
    budget_path: relativeToRepo(budgetPath),
    export_dir: relativeToRepo(exportDir),
    browser_executable: browserExecutable,
    target_fps: budget.target_fps,
    warmup_ms: budget.warmup_ms,
    failed_checks: failedChecks,
    metrics: browserMetrics,
  });
} catch (error) {
  failedChecks.push({
    scope: 'browser',
    metric: 'runtime_error',
    actual: error instanceof Error ? error.message : String(error),
    budget: 'none',
    message: snippet(stderr),
  });
  writeResult({
    skipped: false,
    budget_path: relativeToRepo(budgetPath),
    export_dir: relativeToRepo(exportDir),
    browser_executable: browserExecutable,
    target_fps: budget.target_fps,
    warmup_ms: budget.warmup_ms,
    failed_checks: failedChecks,
  });
} finally {
  browser.kill('SIGTERM');
  await waitForBrowserExit(browser);
  await closeServer(server.server);
  safeRemoveBrowserProfile(userDataDir);
}

process.exit(failedChecks.length > 0 ? 1 : 0);

function parseArgs(args) {
  const parsed = {
    budgetPath: null,
    exportDir: null,
    outPath: null,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--budget') {
      parsed.budgetPath = readArgValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === '--export-dir') {
      parsed.exportDir = readArgValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === '--out') {
      parsed.outPath = readArgValue(args, index, arg);
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

function readBudget(path) {
  if (!existsSync(path)) {
    throw new Error(`Web performance budget not found: ${path}`);
  }

  const parsed = JSON.parse(readFileSync(path, 'utf8'));
  const requiredNumbers = [
    'target_fps',
    'min_browser_raf_fps',
    'max_browser_frame_ms',
    'warmup_ms',
    'sample_ms',
    'max_boot_wait_ms',
  ];
  if (parsed?.version !== 1) {
    throw new Error('Web performance budget must use version 1');
  }
  for (const field of requiredNumbers) {
    if (!Number.isFinite(parsed[field]) || parsed[field] <= 0) {
      throw new Error(`Web performance budget field ${field} must be a positive number`);
    }
  }
  if (typeof parsed.export_dir !== 'string' || parsed.export_dir.length === 0) {
    throw new Error('Web performance budget field export_dir must be a non-empty string');
  }
  return parsed;
}

function hasGodotWebExportArtifacts(directory) {
  if (!existsSync(directory) || !statSync(directory).isDirectory()) {
    return false;
  }

  const files = readdirSync(directory);
  return (
    files.includes('index.html') &&
    files.some((file) => file.endsWith('.js')) &&
    files.some((file) => file.endsWith('.wasm')) &&
    files.some((file) => file.endsWith('.pck'))
  );
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
  return {
    server,
    url: `http://127.0.0.1:${address.port}/index.html`,
  };
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
    case '.png':
      return 'image/png';
    case '.svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
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
  let nextId = 1;

  await new Promise((resolveOpen, rejectOpen) => {
    socket.addEventListener('open', resolveOpen, { once: true });
    socket.addEventListener('error', rejectOpen, { once: true });
  });

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data));
    if (!message.id || !pending.has(message.id)) {
      return;
    }
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) {
      reject(new Error(message.error.message ?? 'CDP command failed'));
    } else {
      resolve(message.result ?? {});
    }
  });

  return {
    send(method, params = {}) {
      const id = nextId;
      nextId += 1;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
      });
    },
    close() {
      socket.close();
    },
  };
}

async function sampleBrowserFrames(cdp, sampleMs) {
  const expression = `
    new Promise((resolve) => {
      const started = performance.now();
      let frames = 0;
      let maxFrameMs = 0;
      let lastFrame = started;
      function step(now) {
        frames += 1;
        maxFrameMs = Math.max(maxFrameMs, now - lastFrame);
        lastFrame = now;
        if (now - started >= ${JSON.stringify(sampleMs)}) {
          resolve({
            frames,
            duration_ms: now - started,
            fps: frames * 1000 / (now - started),
            max_frame_ms: maxFrameMs,
            canvas_count: document.querySelectorAll('canvas').length,
            visibility_state: document.visibilityState,
            user_agent: navigator.userAgent
          });
          return;
        }
        requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    })
  `;

  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  return result.result.value;
}

function writeResult(result) {
  const text = `${JSON.stringify(result, null, 2)}\n`;
  if (outPath !== null) {
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, text);
  }
  process.stdout.write(text);
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
    rmSync(profilePath, { recursive: true, force: true });
  } catch (error) {
    console.warn(`[godot:web-performance] unable to remove browser profile ${profilePath}: ${error.message}`);
  }
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function relativeToRepo(path) {
  return path.startsWith(repoRoot) ? path.slice(repoRoot.length + 1) : path;
}

function snippet(text, maxLength = 1000) {
  const value = String(text ?? '').trim();
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}
