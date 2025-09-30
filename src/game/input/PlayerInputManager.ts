import type Phaser from 'phaser';
import type { KirdyInputState } from '../characters/Kirdy';

export type PlayerAction = 'inhale' | 'swallow' | 'spit' | 'discard';
export type PlayerTouchControl = 'left' | 'right' | 'jump' | PlayerAction;

export interface InputButtonState {
  isDown: boolean;
  justPressed: boolean;
}

export interface PlayerInputSnapshot {
  kirdy: KirdyInputState;
  actions: Record<PlayerAction, InputButtonState>;
}

interface KeyLike {
  isDown?: boolean;
}

const MOVEMENT_KEY_CODES = {
  left: ['LEFT', 'A'],
  right: ['RIGHT', 'D'],
  jump: ['SPACE', 'UP', 'W'],
  hover: ['SPACE'],
};

const ACTION_KEY_CODES: Record<PlayerAction, string[]> = {
  inhale: ['C'],
  swallow: ['S', 'DOWN'],
  spit: ['Z'],
  discard: ['X'],
};

const TOUCH_DEFAULT_STATE: Record<PlayerTouchControl, boolean> = {
  left: false,
  right: false,
  jump: false,
  inhale: false,
  swallow: false,
  spit: false,
  discard: false,
};

export class PlayerInputManager {
  private keyboard?: Phaser.Input.Keyboard.KeyboardPlugin;
  private keys = new Map<string, KeyLike>();
  private previousActionDown: Record<PlayerAction, boolean> = {
    inhale: false,
    swallow: false,
    spit: false,
    discard: false,
  };
  private touchState: Record<PlayerTouchControl, boolean> = { ...TOUCH_DEFAULT_STATE };
  private snapshot: PlayerInputSnapshot = this.createEmptySnapshot();
  private buttonCleanup: Array<() => void> = [];
  private touchContainer?: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene) {
    this.keyboard = scene.input?.keyboard;

    this.registerMovementKeys();
    this.registerActionKeys();
    this.createTouchControls(scene);
  }

  update(): PlayerInputSnapshot {
    const leftDown = this.anyKeyDown(MOVEMENT_KEY_CODES.left) || this.touchState.left;
    const rightDown = this.anyKeyDown(MOVEMENT_KEY_CODES.right) || this.touchState.right;
    const jumpDown = this.anyKeyDown(MOVEMENT_KEY_CODES.jump) || this.touchState.jump;
    const hoverDown = this.anyKeyDown(MOVEMENT_KEY_CODES.hover) || this.touchState.jump;

    const actions = this.computeActionStates();

    this.snapshot = {
      kirdy: {
        left: leftDown,
        right: rightDown,
        jumpPressed: jumpDown,
        hoverPressed: hoverDown,
      },
      actions,
    };

    return this.snapshot;
  }

  destroy() {
    this.buttonCleanup.forEach((disposer) => disposer());
    this.buttonCleanup = [];
    this.touchState = { ...TOUCH_DEFAULT_STATE };
    this.previousActionDown = {
      inhale: false,
      swallow: false,
      spit: false,
      discard: false,
    };
    this.snapshot = this.createEmptySnapshot();
    this.touchContainer?.destroy?.();
    this.touchContainer = undefined;
    this.keys.clear();
  }

  simulateTouch(control: PlayerTouchControl, pressed: boolean) {
    this.setTouchState(control, pressed);
  }

  private createEmptySnapshot(): PlayerInputSnapshot {
    return {
      kirdy: {
        left: false,
        right: false,
        jumpPressed: false,
        hoverPressed: false,
      },
      actions: {
        inhale: { isDown: false, justPressed: false },
        swallow: { isDown: false, justPressed: false },
        spit: { isDown: false, justPressed: false },
        discard: { isDown: false, justPressed: false },
      },
    } satisfies PlayerInputSnapshot;
  }

  private registerMovementKeys() {
    Object.values(MOVEMENT_KEY_CODES).flat().forEach((code) => {
      this.registerKey(code);
    });
  }

  private registerActionKeys() {
    Object.values(ACTION_KEY_CODES).flat().forEach((code) => {
      this.registerKey(code);
    });
  }

  private registerKey(code: string) {
    if (!this.keyboard?.addKey) {
      return;
    }

    const existing = this.keys.get(code);
    if (existing) {
      return;
    }

    const key = this.keyboard.addKey(code) as KeyLike | undefined;
    if (key) {
      this.keys.set(code, key);
    }
  }

  private anyKeyDown(codes: string[]) {
    return codes.some((code) => this.keys.get(code)?.isDown === true);
  }

  private computeActionStates(): Record<PlayerAction, InputButtonState> {
    const results = { ...this.snapshot.actions };

    (Object.keys(ACTION_KEY_CODES) as PlayerAction[]).forEach((action) => {
      const keyCodes = ACTION_KEY_CODES[action];
      const keyDown = this.anyKeyDown(keyCodes);
      const touchDown = this.touchState[action];
      const isDown = keyDown || touchDown;
      const justPressed = isDown && !this.previousActionDown[action];

      this.previousActionDown[action] = isDown;
      results[action] = { isDown, justPressed };
    });

    return results;
  }

  private createTouchControls(scene: Phaser.Scene) {
    const container = scene.add?.container?.(0, 0);
    if (!container) {
      return;
    }

    this.touchContainer = container as Phaser.GameObjects.Container;
    container.setScrollFactor?.(0, 0);
    container.setDepth?.(1000);

    const width = scene.scale?.width ?? 800;
    const height = scene.scale?.height ?? 600;

    const buttons: Array<{ control: PlayerTouchControl; x: number; y: number }> = [
      { control: 'left', x: 80, y: height - 80 },
      { control: 'right', x: 180, y: height - 80 },
      { control: 'jump', x: width - 120, y: height - 80 },
      { control: 'inhale', x: width - 220, y: height - 160 },
      { control: 'swallow', x: width - 280, y: height - 100 },
      { control: 'spit', x: width - 60, y: height - 200 },
      { control: 'discard', x: width - 160, y: height - 240 },
    ];

    buttons.forEach(({ control, x, y }) => {
      const button = scene.add?.image?.(x, y, 'virtual-controls', control);
      if (!button) {
        return;
      }

      const downHandler = () => {
        this.setTouchState(control, true);
        button.setAlpha?.(0.6);
      };
      const upHandler = () => {
        this.setTouchState(control, false);
        button.setAlpha?.(1);
      };

      button.setInteractive?.({ useHandCursor: true });
      button.on?.('pointerdown', downHandler);
      button.on?.('pointerup', upHandler);
      button.on?.('pointerout', upHandler);
      button.on?.('pointerupoutside', upHandler);
      button.on?.('pointercancel', upHandler);
      button.setAlpha?.(1);
      button.setScrollFactor?.(0, 0);

      container.add?.(button);

      const disposer = () => {
        button.off?.('pointerdown', downHandler);
        button.off?.('pointerup', upHandler);
        button.off?.('pointerout', upHandler);
        button.off?.('pointerupoutside', upHandler);
        button.off?.('pointercancel', upHandler);
        button.setAlpha?.(1);
        button.destroy?.();
      };

      this.buttonCleanup.push(disposer);
    });
  }

  private setTouchState(control: PlayerTouchControl, pressed: boolean) {
    this.touchState[control] = pressed;
  }
}
