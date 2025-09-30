import Phaser from 'phaser';

export const SceneKeys = {
  Boot: 'BootScene',
  Menu: 'MenuScene',
  Game: 'GameScene',
  Pause: 'PauseScene',
} as const;

type SceneKey = (typeof SceneKeys)[keyof typeof SceneKeys];

function buildConfig(key: SceneKey) {
  return { key } satisfies Phaser.Types.Scenes.SettingsConfig;
}

export class BootScene extends Phaser.Scene {
  public static readonly KEY = SceneKeys.Boot;

  constructor() {
    super(buildConfig(SceneKeys.Boot));
  }

  preload() {
    this.load?.once?.('complete', () => {
      this.scene.start(SceneKeys.Menu);
    });

    this.load?.start?.();
  }

  create() {}
}

export class MenuScene extends Phaser.Scene {
  public static readonly KEY = SceneKeys.Menu;

  constructor() {
    super(buildConfig(SceneKeys.Menu));
  }

  create() {
    if (this.add?.text) {
      this.add.text(0, 0, 'Press Space or Tap to Start', {
        fontSize: '24px',
        color: '#ffffff',
      });
    }

    const startHandler = () => this.startGame();

    this.input?.keyboard?.once?.('keydown-SPACE', startHandler);
    this.input?.on?.('pointerdown', startHandler);
  }

  startGame() {
    this.scene.start(SceneKeys.Game);
  }
}

export class GameScene extends Phaser.Scene {
  public static readonly KEY = SceneKeys.Game;

  constructor() {
    super(buildConfig(SceneKeys.Game));
  }

  create() {
    const pauseHandler = () => this.pauseGame();
    this.input?.keyboard?.once?.('keydown-ESC', pauseHandler);
  }

  pauseGame() {
    this.scene.launch(SceneKeys.Pause);
  }
}

export class PauseScene extends Phaser.Scene {
  public static readonly KEY = SceneKeys.Pause;

  constructor() {
    super(buildConfig(SceneKeys.Pause));
  }

  create() {
    const resumeHandler = () => this.resumeGame();

    this.input?.keyboard?.once?.('keydown-ESC', resumeHandler);
    this.input?.once?.('pointerdown', resumeHandler);

    if (this.add?.text) {
      this.add.text(0, 0, 'Paused - Press ESC or Tap to Resume', {
        fontSize: '24px',
        color: '#ffffff',
      });
    }
  }

  resumeGame() {
    this.scene.stop(SceneKeys.Pause);
    this.scene.resume(SceneKeys.Game);
  }
}

export const coreScenes = [BootScene, MenuScene, GameScene, PauseScene];
