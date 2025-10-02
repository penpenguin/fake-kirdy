import { expect, it } from 'vitest';

it('GitHub Pages 用に base を /fake-kirdy/ に設定している', async () => {
  const configModule = await import('../vite.config');
  const config = configModule.default ?? configModule;

  expect(config.base).toBe('/fake-kirdy/');
});
