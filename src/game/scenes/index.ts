import Phaser from 'phaser';
import { createKirdy, type Kirdy } from '../characters/Kirdy';
import {
  PlayerInputManager,
  type PlayerInputSnapshot,
  type PlayerAction,
  type InputButtonState,
} from '../input/PlayerInputManager';

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
  private playerInput?: PlayerInputManager;
  private latestInput?: PlayerInputSnapshot;
  private static readonly PLAYER_SPAWN = { x: 160, y: 360 } as const;

  constructor() {
    super(buildConfig(SceneKeys.Game));
  }

  create() {
    const pauseHandler = () => this.pauseGame();
    this.input?.keyboard?.once?.('keydown-ESC', pauseHandler);

    this.kirdy = createKirdy(this, GameScene.PLAYER_SPAWN);
    this.playerInput = new PlayerInputManager(this);

    this.events?.once?.('shutdown', () => {
      this.playerInput?.destroy();
      this.playerInput = undefined;
      this.latestInput = undefined;
    });
  }

  pauseGame() {
    this.scene.launch(SceneKeys.Pause);
  }

  update(time: number, delta: number) {
    const snapshot = this.playerInput?.update();
    if (!snapshot) {
      return;
    }

    this.latestInput = snapshot;
    this.kirdy?.update?.(time, delta, snapshot.kirdy);
  }

  getPlayerInputSnapshot(): PlayerInputSnapshot | undefined {
    return this.latestInput;
  }

  getActionState(action: PlayerAction): InputButtonState | undefined {
    return this.latestInput?.actions[action];
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
