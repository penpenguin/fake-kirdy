import { beforeEach, describe, expect, it, vi } from 'vitest';

const PhaserGameMock = vi.hoisted(() => {
  return class {
    static lastConfig: any;
    public config: any;
    public canvas: HTMLCanvasElement;

    constructor(config: any) {
      this.config = config;
      (PhaserGameMock as any).lastConfig = config;
      this.canvas = document.createElement('canvas');
      this.canvas.setAttribute('data-mock', 'true');

      if (config.parent instanceof HTMLElement) {
        config.parent.appendChild(this.canvas);
      }
    }
  };
});

vi.mock('phaser', () => {
  return {
    default: {
      Game: PhaserGameMock,
      AUTO: 'AUTO',
      Scale: { FIT: 'FIT', CENTER_BOTH: 'CENTER_BOTH' },
      Types: {
        Scenes: {
          SettingsConfig: class {},
        },
      },
    },
  };
});

import { createGame } from './createGame';

describe('createGame', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    document.body.innerHTML = '<div id="game"></div>';
    const found = document.getElementById('game');
    if (!found) {
      throw new Error('Test container missing');
    }
    container = found as HTMLDivElement;
    (PhaserGameMock as any).lastConfig = undefined;
  });

  it('creates a Phaser.Game instance attached to the provided container', () => {
    const game = createGame(container);

    expect(game).toBeInstanceOf(PhaserGameMock);
    expect((PhaserGameMock as any).lastConfig?.parent).toBe(container);
    expect(container.querySelector('canvas')).toBeInstanceOf(HTMLCanvasElement);
  });

  it('uses default game configuration values that enable the render loop', () => {
    createGame(container);

    const config = (PhaserGameMock as any).lastConfig;
    expect(config).toBeDefined();
    expect(config.type).toBe('AUTO');
    expect(config.width).toBeGreaterThan(0);
    expect(config.height).toBeGreaterThan(0);
    expect(config.scene).toBeDefined();
  });
});
