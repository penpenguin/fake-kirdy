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
      Scene: class {},
      AUTO: 'AUTO',
      WEBGL: 'WEBGL',
      CANVAS: 'CANVAS',
      Scale: { FIT: 'FIT', CENTER_BOTH: 'CENTER_BOTH', NO_CENTER: 'NO_CENTER' },
      Types: {
        Scenes: {
          SettingsConfig: class {},
        },
      },
    },
  };
});

const renderingPreferenceStubs = vi.hoisted(() => ({
  getPreferredRenderer: vi.fn().mockReturnValue('auto'),
  recordLowFpsEvent: vi.fn(),
  recordStableFpsEvent: vi.fn(),
}));

vi.mock('./performance/RenderingModePreference', () => renderingPreferenceStubs);

import { createGame } from './createGame';
import { coreScenes } from './scenes';

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
    (globalThis as any).WebGLRenderingContext = function WebGLRenderingContext() {};
    renderingPreferenceStubs.getPreferredRenderer.mockReturnValue('auto');
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
    expect(config.type).toBe('WEBGL');
    expect(config.width).toBeGreaterThan(0);
    expect(config.height).toBeGreaterThan(0);
    expect(config.scene).toBeDefined();
  });

  it('デフォルトで背景色をグレーに設定する', () => {
    createGame(container);

    const config = (PhaserGameMock as any).lastConfig;
    expect(config.backgroundColor).toBe(0x808080);
  });

  it('registers the core scenes by default', () => {
    createGame(container);

    const config = (PhaserGameMock as any).lastConfig;
    expect(config.scene).toEqual(coreScenes);
  });

  it('レンダリングプリファレンスがキャンバスを要求したら強制する', () => {
    renderingPreferenceStubs.getPreferredRenderer.mockReturnValue('canvas');

    createGame(container);

    const config = (PhaserGameMock as any).lastConfig;
    expect(config.type).toBe('CANVAS');
  });

  it('WebGLが利用できない場合はキャンバスにフォールバックする', () => {
    delete (globalThis as any).WebGLRenderingContext;

    createGame(container);

    const config = (PhaserGameMock as any).lastConfig;
    expect(config.type).toBe('CANVAS');
  });

  it('スケール設定に最大サイズを設定して拡大しすぎないよう制限する', () => {
    createGame(container);

    const config = (PhaserGameMock as any).lastConfig;
    expect(config.scale?.max).toEqual({ width: 800, height: 600 });
  });

  it('Phaserのオートセンタリングを無効化してDOM側のレイアウトに任せる', () => {
    createGame(container);

    const config = (PhaserGameMock as any).lastConfig;
    expect(config.scale?.autoCenter).toBe('NO_CENTER');
  });

  it('親要素に幅800の上限と中央寄せを適用しつつ縦方向は全体に広げる', () => {
    createGame(container);

    expect(container.style.margin).toBe('0px auto');
    expect(container.style.width).toBe('100%');
    expect(container.style.height).toBe('100%');
    expect(container.style.maxWidth).toBe('800px');
    expect(container.style.maxHeight).toBe('');
    expect(container.style.display).toBe('flex');
    expect(container.style.justifyContent).toBe('center');
    expect(container.style.alignItems).toBe('center');
  });
});
