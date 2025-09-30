import Phaser from 'phaser';
import { createKirdy, type Kirdy } from '../characters/Kirdy';

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
  private kirdy?: Kirdy;
  private cursorKeys?: Phaser.Types.Input.Keyboard.CursorKeys;
  private static readonly PLAYER_SPAWN = { x: 160, y: 360 } as const;

  constructor() {
    super(buildConfig(SceneKeys.Game));
  }

  create() {
    const pauseHandler = () => this.pauseGame();
    this.input?.keyboard?.once?.('keydown-ESC', pauseHandler);

    this.cursorKeys = this.input?.keyboard?.createCursorKeys?.();
    this.kirdy = createKirdy(this, GameScene.PLAYER_SPAWN);
  }

  pauseGame() {
    this.scene.launch(SceneKeys.Pause);
  }

  update(time: number, delta: number) {
    const spaceDown = this.cursorKeys?.space?.isDown ?? false;
    const upDown = this.cursorKeys?.up?.isDown ?? false;
    const inputState = {
      left: this.cursorKeys?.left?.isDown ?? false,
      right: this.cursorKeys?.right?.isDown ?? false,
      jumpPressed: spaceDown || upDown,
      hoverPressed: spaceDown,
    };

    this.kirdy?.update?.(time, delta, inputState);
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
