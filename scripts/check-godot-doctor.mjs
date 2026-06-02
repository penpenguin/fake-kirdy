import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const repoRoot = process.cwd();
const godotRoot = join(repoRoot, 'godot');
const options = parseArgs(process.argv.slice(2));
const requireGodot = options.requireGodot || process.env.CI_REQUIRE_GODOT === '1';
const requireExportTemplates = requireGodot && !options.skipExportTemplates;

const checks = {
  project: checkProject(),
  node: checkNode(),
  npm: checkNpm(),
  godot: checkGodot(),
  browser: checkBrowser(),
};
checks.export_templates = checkExportTemplates(checks.godot);

const failedChecks = Object.entries(checks)
  .filter(([, check]) => check.severity === 'error')
  .map(([id, check]) => ({ id, severity: check.severity, message: check.message }));

const report = {
  required: requireGodot,
  require_export_templates: requireExportTemplates,
  platform: {
    os: process.platform,
    arch: process.arch,
  },
  environment: {
    ci: Boolean(process.env.CI),
    github_actions: Boolean(process.env.GITHUB_ACTIONS),
    ci_require_godot: process.env.CI_REQUIRE_GODOT === '1',
    godot_bin_set: Boolean(process.env.GODOT_BIN),
    chrome_bin_set: Boolean(process.env.CHROME_BIN),
  },
  checks,
  failed_checks: failedChecks,
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
    requireGodot: false,
    skipExportTemplates: false,
  };

  for (const arg of args) {
    if (arg === '--json') {
      parsed.json = true;
      continue;
    }
    if (arg === '--require-godot') {
      parsed.requireGodot = true;
      continue;
    }
    if (arg === '--skip-export-templates') {
      parsed.skipExportTemplates = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function checkProject() {
  const projectPath = join(godotRoot, 'project.godot');
  if (!existsSync(projectPath)) {
    return {
      status: 'error',
      severity: 'error',
      message: 'Missing canonical Godot project at godot/project.godot',
    };
  }
  return {
    status: 'ok',
    severity: 'info',
    path: 'godot/project.godot',
  };
}

function checkNode() {
  return {
    status: 'ok',
    severity: 'info',
    version: process.version,
  };
}

function checkNpm() {
  const result = spawnSync('npm', ['--version'], { encoding: 'utf8' });
  if (result.error?.code === 'ENOENT') {
    return localOrRequiredCheck('npm', 'npm executable was not found on PATH');
  }
  if (result.status !== 0 || result.error) {
    return {
      status: requireGodot ? 'error' : 'warning',
      severity: requireGodot ? 'error' : 'warning',
      message: result.error?.message ?? trim(result.stderr) ?? 'npm --version failed',
    };
  }
  return {
    status: 'ok',
    severity: 'info',
    version: trim(result.stdout),
  };
}

function checkGodot() {
  const executable = findVersionedExecutable(
    process.env.GODOT_BIN,
    ['godot', 'godot4'],
    ['--version'],
  );
  if (executable === null) {
    return localOrRequiredCheck('godot', 'Godot executable was not found. Set GODOT_BIN or install godot/godot4.');
  }
  return {
    status: 'ok',
    severity: 'info',
    executable: executable.command,
    label: executable.label,
    version: executable.version,
  };
}

function checkBrowser() {
  const executable = findVersionedExecutable(
    process.env.CHROME_BIN,
    [
      'google-chrome',
      'google-chrome-stable',
      'chromium',
      'chromium-browser',
      'chrome',
    ],
    ['--version'],
  );
  if (executable === null) {
    return {
      status: 'warning',
      severity: 'warning',
      message: 'Chromium/Chrome executable was not found. Set CHROME_BIN for Web runtime checks.',
    };
  }
  return {
    status: 'ok',
    severity: 'info',
    executable: executable.command,
    label: executable.label,
    version: executable.version,
  };
}

function checkExportTemplates(godotCheck) {
  if (options.skipExportTemplates) {
    return {
      status: 'skipped',
      severity: 'info',
      message: 'Export template validation skipped by --skip-export-templates',
    };
  }
  if (godotCheck.status !== 'ok') {
    return {
      status: requireExportTemplates ? 'error' : 'warning',
      severity: requireExportTemplates ? 'error' : 'warning',
      message: 'Godot export templates could not be checked because Godot is unavailable.',
    };
  }

  const versionDirName = exportTemplateVersion(godotCheck.version);
  const roots = exportTemplateRoots();
  const matchingDirs = roots
    .map((root) => (versionDirName === null ? null : join(root, versionDirName)))
    .filter(Boolean);
  const templateDir = matchingDirs.find((candidate) => existsSync(candidate) && statSync(candidate).isDirectory());
  if (templateDir === undefined) {
    return {
      status: requireExportTemplates ? 'error' : 'warning',
      severity: requireExportTemplates ? 'error' : 'warning',
      version: godotCheck.version,
      expected_version_dir: versionDirName,
      searched_roots: roots,
      message: 'Godot export templates were not found for the detected version.',
    };
  }

  const files = readdirSync(templateDir);
  const hasWebTemplate = files.some((file) => file === 'web_release.zip' || file.startsWith('web_'));
  if (!hasWebTemplate) {
    return {
      status: requireExportTemplates ? 'error' : 'warning',
      severity: requireExportTemplates ? 'error' : 'warning',
      path: templateDir,
      message: 'Godot export template directory exists but no Web template was found.',
    };
  }

  return {
    status: 'ok',
    severity: 'info',
    path: templateDir,
  };
}

function findVersionedExecutable(envCommand, candidates, versionArgs) {
  const commands = [
    envCommand ? { command: envCommand, label: envCommand } : null,
    ...candidates.map((candidate) => ({ command: candidate, label: candidate })),
  ].filter(Boolean);

  for (const command of commands) {
    const result = spawnSync(command.command, versionArgs, { encoding: 'utf8' });
    if (result.error?.code === 'ENOENT' || result.status !== 0 || result.error) {
      continue;
    }
    return {
      ...command,
      version: trim(result.stdout) ?? trim(result.stderr) ?? 'unknown',
    };
  }

  return null;
}

function localOrRequiredCheck(id, message) {
  return {
    status: requireGodot ? 'error' : 'warning',
    severity: requireGodot ? 'error' : 'warning',
    message: `[${id}] ${message}`,
  };
}

function exportTemplateRoots() {
  const home = homedir();
  const roots = [];
  if (process.env.GODOT_EXPORT_TEMPLATES_DIR) {
    roots.push(process.env.GODOT_EXPORT_TEMPLATES_DIR);
  }
  if (process.env.XDG_DATA_HOME) {
    roots.push(join(process.env.XDG_DATA_HOME, 'godot', 'export_templates'));
  }
  roots.push(join(home, '.local', 'share', 'godot', 'export_templates'));
  roots.push(join(home, 'Library', 'Application Support', 'Godot', 'export_templates'));
  if (process.env.APPDATA) {
    roots.push(join(process.env.APPDATA, 'Godot', 'export_templates'));
  }
  return [...new Set(roots)];
}

function exportTemplateVersion(version) {
  const match = version.match(/\d+\.\d+(?:\.\d+)?\.(?:stable|rc\d+|beta\d+|alpha\d+|dev)/);
  return match?.[0] ?? null;
}

function printHumanReport(report) {
  console.log(`[godot:doctor] required=${report.required ? 'yes' : 'no'}`);
  for (const [id, check] of Object.entries(report.checks)) {
    const detail = check.version ?? check.path ?? check.message ?? '';
    console.log(`[godot:doctor] ${id}: ${check.status}${detail ? ` - ${detail}` : ''}`);
  }
}

function trim(value) {
  const text = String(value ?? '').trim();
  return text.length > 0 ? text : null;
}
