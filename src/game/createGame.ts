import Phaser from 'phaser';
import { coreScenes } from './scenes';
import { getPreferredRenderer } from './performance/RenderingModePreference';

export interface CreateGameOptions {
  config?: Partial<Phaser.Types.Core.GameConfig>;
}

const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;
const MAX_WIDTH_PX = `${DEFAULT_WIDTH}px`;

export function createGame(parent: HTMLElement, options: CreateGameOptions = {}) {
  if (!(parent instanceof HTMLElement)) {
    throw new Error('createGame expects an HTMLElement as the parent container.');
  }

  applyResponsiveContainer(parent);

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
      autoCenter: Phaser.Scale.NO_CENTER,
      max: {
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
      },
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

function applyResponsiveContainer(parent: HTMLElement) {
  const style = parent.style;
  style.margin = '0 auto';
  style.width = '100%';
  style.height = '100%';
  style.maxWidth = MAX_WIDTH_PX;

  if (!style.display) {
    style.display = 'flex';
  }

  if (!style.justifyContent) {
    style.justifyContent = 'center';
  }

  if (!style.alignItems) {
    style.alignItems = 'center';
  }
}

function isWebglSupported() {
  if (typeof globalThis === 'undefined') {
    return false;
  }

  return typeof (globalThis as any).WebGLRenderingContext !== 'undefined';
}
