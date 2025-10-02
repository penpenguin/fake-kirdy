import Phaser from 'phaser';
import { coreScenes } from './scenes';
import { getPreferredRenderer } from './performance/RenderingModePreference';

export interface CreateGameOptions {
  config?: Partial<Phaser.Types.Core.GameConfig>;
}

const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;

export function createGame(parent: HTMLElement, options: CreateGameOptions = {}) {
  if (!(parent instanceof HTMLElement)) {
    throw new Error('createGame expects an HTMLElement as the parent container.');
  }

  const baseConfig: Phaser.Types.Core.GameConfig = {
    type: determineRendererType(),
    parent,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    backgroundColor: 0x808080,
    scene: coreScenes,
    physics: {
      default: 'matter',
      matter: {
        gravity: { x: 0, y: 1 },
      },
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  };

  const mergedConfig: Phaser.Types.Core.GameConfig = {
    ...baseConfig,
    ...options.config,
  };

  return new Phaser.Game(mergedConfig);
}

function determineRendererType() {
  const preferred = getPreferredRenderer();
  if (preferred === 'canvas') {
    return Phaser.CANVAS ?? Phaser.AUTO;
  }

  if (isWebglSupported()) {
    return Phaser.WEBGL ?? Phaser.AUTO;
  }

  return Phaser.CANVAS ?? Phaser.AUTO;
}

function isWebglSupported() {
  if (typeof globalThis === 'undefined') {
    return false;
  }

  return typeof (globalThis as any).WebGLRenderingContext !== 'undefined';
}
