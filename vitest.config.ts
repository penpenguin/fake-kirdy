import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['test/godot*.test.ts', 'test/trace-summary.test.ts'],
    setupFiles: fileURLToPath(new URL('./vitest.setup.ts', import.meta.url)),
  },
});
