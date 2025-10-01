import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

describe('package.json scripts', () => {
  it('exposes a typecheck command for TypeScript validation', () => {
    const filePath = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
    const raw = readFileSync(filePath, 'utf-8');
    const pkg = JSON.parse(raw) as { scripts?: Record<string, string> };

    expect(pkg.scripts?.typecheck).toBe('tsc --noEmit');
  });
});
