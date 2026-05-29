import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));

describe('index.html styling', () => {
  it('sets the page background to gray', () => {
    const html = readFileSync(join(currentDir, '..', 'index.html'), 'utf8');
    expect(html).toMatch(/background:\s*#808080;/i);
  });
});
