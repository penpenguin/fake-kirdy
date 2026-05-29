import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const args = new Set(process.argv.slice(2));
const repoRoot = process.cwd();
const ledgerPath = join(repoRoot, 'docs/godot-v2/phaser-parity-ledger.json');
const allowedStatuses = new Set(['ported', 'partial', 'deferred', 'deprecated', 'pending']);

if (!existsSync(ledgerPath)) {
  console.error('[godot:parity-ledger] missing docs/godot-v2/phaser-parity-ledger.json');
  process.exit(1);
}

const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
const errors = validateLedger(ledger);

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`[godot:parity-ledger] ${error}`);
  }
  process.exit(1);
}

const summary = summarizeLedger(ledger);

if (args.has('--fail-on-blockers') && summary.blocker_count > 0) {
  console.error(
    `[godot:parity-ledger] retirement blockers remain: ${summary.blockers.join(', ')}`,
  );
  process.exit(1);
}

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

function validateLedger(value) {
  const validationErrors = [];

  if (value === null || typeof value !== 'object') {
    return ['ledger must be an object'];
  }

  if (value.version !== 1) {
    validationErrors.push('version must be 1');
  }
  if (value.canonical_runtime !== 'godot') {
    validationErrors.push('canonical_runtime must be godot');
  }
  if (value.legacy_reference !== 'phaser-matter') {
    validationErrors.push('legacy_reference must be phaser-matter');
  }
  if (!Array.isArray(value.entries) || value.entries.length === 0) {
    validationErrors.push('entries must be a non-empty array');
    return validationErrors;
  }

  const ids = new Set();
  for (const [index, entry] of value.entries.entries()) {
    validateEntry(entry, index, ids, validationErrors);
  }

  return validationErrors;
}

function validateEntry(entry, index, ids, validationErrors) {
  const prefix = `entries[${index}]`;
  if (entry === null || typeof entry !== 'object') {
    validationErrors.push(`${prefix} must be an object`);
    return;
  }

  if (typeof entry.id !== 'string' || entry.id.length === 0) {
    validationErrors.push(`${prefix}.id must be a non-empty string`);
  } else if (ids.has(entry.id)) {
    validationErrors.push(`${prefix}.id duplicates ${entry.id}`);
  } else {
    ids.add(entry.id);
  }

  if (!allowedStatuses.has(entry.status)) {
    validationErrors.push(`${prefix}.status must be one of ${[...allowedStatuses].join(', ')}`);
  }

  if (typeof entry.summary !== 'string' || entry.summary.length === 0) {
    validationErrors.push(`${prefix}.summary must be a non-empty string`);
  }

  validatePathArray(entry.godot_evidence, `${prefix}.godot_evidence`, validationErrors);
  validatePathArray(entry.docs_evidence, `${prefix}.docs_evidence`, validationErrors);
  validatePathArray(entry.legacy_reference_files, `${prefix}.legacy_reference_files`, validationErrors);

  if (!Array.isArray(entry.validation) || entry.validation.length === 0) {
    validationErrors.push(`${prefix}.validation must be a non-empty array`);
  } else {
    for (const command of entry.validation) {
      if (typeof command !== 'string' || command.length === 0) {
        validationErrors.push(`${prefix}.validation must contain non-empty strings`);
      }
    }
  }
}

function validatePathArray(value, fieldName, validationErrors) {
  if (value === undefined) {
    return;
  }
  if (!Array.isArray(value)) {
    validationErrors.push(`${fieldName} must be an array when present`);
    return;
  }

  for (const relativePath of value) {
    if (typeof relativePath !== 'string' || relativePath.length === 0) {
      validationErrors.push(`${fieldName} must contain non-empty strings`);
      continue;
    }

    if (!existsSync(join(repoRoot, relativePath))) {
      validationErrors.push(`${fieldName} path does not exist: ${relativePath}`);
    }
  }
}

function summarizeLedger(value) {
  const statuses = {};
  const blockers = [];
  const entries = Array.isArray(value.entries) ? value.entries : [];

  for (const entry of entries) {
    statuses[entry.status] = (statuses[entry.status] ?? 0) + 1;
    if (entry.retirement_blocker === true) {
      blockers.push(entry.id);
    }
  }

  blockers.sort();

  return {
    canonical_runtime: value.canonical_runtime,
    legacy_reference: value.legacy_reference,
    entry_count: entries.length,
    statuses,
    blocker_count: blockers.length,
    blockers,
  };
}
