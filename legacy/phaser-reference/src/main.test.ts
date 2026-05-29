import { beforeEach, describe, expect, it, vi } from 'vitest';

const createGameMock = vi.hoisted(() => vi.fn());

vi.mock('./game/createGame', () => ({
  createGame: createGameMock,
}));

describe('browser entrypoint', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('creates the Phaser game inside #game container', async () => {
    document.body.innerHTML = '<div id="game"></div>';

    await import('./main');

    const container = document.getElementById('game') as HTMLDivElement;
    expect(container).toBeInstanceOf(HTMLDivElement);
    expect(createGameMock).toHaveBeenCalledWith(container);
  });

  it('throws a clear error when the container is missing', async () => {
    await expect(import('./main')).rejects.toThrowError(/#game container/i);
  });
});
