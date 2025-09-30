import Phaser from 'phaser';

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
    type: Phaser.AUTO,
    parent,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    scene: [],
    physics: {
      default: 'matter',
      matter: {
        gravity: { y: 1 },
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
