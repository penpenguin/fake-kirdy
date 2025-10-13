import type Phaser from 'phaser';
import type { KirdyInputState } from '../characters/Kirdy';
import type { ControlScheme } from '../save/SaveManager';

export type PlayerAction = 'inhale' | 'swallow' | 'spit' | 'discard';
export type PlayerTouchControl = 'left' | 'right' | 'jump' | PlayerAction;

type VirtualControlFrame =
  | 'inhale'
  | 'spit'
  | 'discard'
  | 'dpad-up'
  | 'dpad-left'
  | 'dpad-down'
  | 'dpad-right';

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
  hover: ['SPACE', 'UP', 'W'],
};

const ACTION_KEY_CODES: Record<PlayerAction, string[]> = {
  inhale: ['C'],
  swallow: ['S'],
  spit: ['Z'],
  discard: ['X'],
};

const SWALLOW_DOWN_KEY = 'DOWN';

const TOUCH_DEFAULT_STATE: Record<PlayerTouchControl, boolean> = {
  left: false,
  right: false,
  jump: false,
  inhale: false,
  swallow: false,
  spit: false,
  discard: false,
};

const VIRTUAL_CONTROL_FRAME_SIZE = 96;
const VIRTUAL_CONTROL_LAYOUT: Record<VirtualControlFrame, { column: number; row: number }> = {
  'dpad-up': { column: 0, row: 0 },
  'dpad-left': { column: 1, row: 0 },
  'dpad-down': { column: 2, row: 0 },
  'dpad-right': { column: 3, row: 0 },
  spit: { column: 0, row: 1 },
  discard: { column: 1, row: 1 },
  inhale: { column: 2, row: 1 },
};

function textureHasFrame(texture: any, frameKey: string) {
  if (!texture) {
    return false;
  }

  if (typeof texture.has === 'function' && texture.has(frameKey)) {
    return true;
  }

  if (typeof texture.hasFrame === 'function' && texture.hasFrame(frameKey)) {
    return true;
  }

  if (typeof texture.getFrame === 'function' && texture.getFrame(frameKey)) {
    return true;
  }

  const candidates = texture.getFrameNames?.() ?? Object.keys(texture.frames ?? {});
  return candidates.includes(frameKey);
}

function ensureVirtualControlFrames(texture: any) {
  if (!texture) {
    return;
  }

  const missing = (Object.keys(VIRTUAL_CONTROL_LAYOUT) as VirtualControlFrame[]).filter(
    (frameKey) => !textureHasFrame(texture, frameKey),
  );

  if (missing.length === 0) {
    return;
  }

  if (typeof texture.add !== 'function') {
    return;
  }

  const baseFrame = texture.frames?.__BASE as { width?: number; height?: number } | undefined;
  const sourceDimensions = Array.isArray((texture as any).source) ? (texture as any).source[0] : undefined;
  const totalWidth = baseFrame?.width ?? sourceDimensions?.width;
  const totalHeight = baseFrame?.height ?? sourceDimensions?.height;

  if (typeof totalWidth !== 'number' || typeof totalHeight !== 'number') {
    return;
  }

  missing.forEach((frameKey) => {
    const layout = VIRTUAL_CONTROL_LAYOUT[frameKey];
    if (!layout) {
      return;
    }

    const cutX = layout.column * VIRTUAL_CONTROL_FRAME_SIZE;
    const cutY = layout.row * VIRTUAL_CONTROL_FRAME_SIZE;

    if (cutX + VIRTUAL_CONTROL_FRAME_SIZE > totalWidth) {
      return;
    }

    if (cutY + VIRTUAL_CONTROL_FRAME_SIZE > totalHeight) {
      return;
    }

    texture.add(frameKey, 0, cutX, cutY, VIRTUAL_CONTROL_FRAME_SIZE, VIRTUAL_CONTROL_FRAME_SIZE);
  });
}

export class PlayerInputManager {
  private keyboard?: Phaser.Input.Keyboard.KeyboardPlugin;
  private keys = new Map<string, KeyLike>();
  private previousActionDown: Record<PlayerAction, boolean> = {
    inhale: false,
    swallow: false,
    spit: false,
    discard: false,
  };
  private allowSwallowDown = false;
  private touchState: Record<PlayerTouchControl, boolean> = { ...TOUCH_DEFAULT_STATE };
  private snapshot: PlayerInputSnapshot = this.createEmptySnapshot();
  private buttonCleanup: Array<() => void> = [];
  private touchContainer?: Phaser.GameObjects.Container;
  private controlScheme: ControlScheme = 'keyboard';

  constructor(scene: Phaser.Scene) {
    this.keyboard = scene.input?.keyboard ?? undefined;

    this.registerMovementKeys();
    this.registerActionKeys();
    this.createTouchControls(scene);
    this.updateTouchVisibility();
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

  setControlScheme(scheme: ControlScheme) {
    this.controlScheme = scheme;
    this.updateTouchVisibility();
  }

  simulateTouch(control: PlayerTouchControl, pressed: boolean) {
    this.setTouchState(control, pressed);
  }

  setSwallowDownEnabled(enabled: boolean) {
    this.allowSwallowDown = Boolean(enabled);
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
    this.registerKey(SWALLOW_DOWN_KEY);
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
      let keyDown = this.anyKeyDown(keyCodes);
      if (action === 'swallow' && !keyDown && this.allowSwallowDown) {
        keyDown = this.anyKeyDown([SWALLOW_DOWN_KEY]);
      }
      const touchDown = this.touchState[action];
      const isDown = keyDown || touchDown;
      const justPressed = isDown && !this.previousActionDown[action];

      this.previousActionDown[action] = isDown;
      results[action] = { isDown, justPressed };
    });

    return results;
  }

  private createTouchControls(scene: Phaser.Scene) {
    const textures = scene.textures;
    if (!textures?.exists?.('virtual-controls')) {
      return;
    }

    const container = scene.add?.container?.(0, 0);
    if (!container) {
      return;
    }

    this.touchContainer = container as Phaser.GameObjects.Container;
    container.setScrollFactor?.(0, 0);
    container.setDepth?.(1000);

    const width = scene.scale?.width ?? 800;
    const height = scene.scale?.height ?? 600;

    const dpadCenterX = 140;
    const dpadCenterY = height - 140;
    const dpadOffset = 80;

    const actionBaseX = width - 250;
    const actionBaseY = height - 50;
    const actionStep = 80;

    const buttons: Array<{
      frame: VirtualControlFrame;
      control: PlayerTouchControl;
      x: number;
      y: number;
    }> = [
      { frame: 'dpad-left', control: 'left', x: dpadCenterX - dpadOffset, y: dpadCenterY },
      { frame: 'dpad-right', control: 'right', x: dpadCenterX + dpadOffset, y: dpadCenterY },
      { frame: 'dpad-up', control: 'jump', x: dpadCenterX, y: dpadCenterY - dpadOffset },
      { frame: 'dpad-down', control: 'swallow', x: dpadCenterX, y: dpadCenterY + dpadOffset },
      { frame: 'spit', control: 'spit', x: actionBaseX, y: actionBaseY },
      { frame: 'discard', control: 'discard', x: actionBaseX + actionStep, y: actionBaseY - actionStep },
      { frame: 'inhale', control: 'inhale', x: actionBaseX + actionStep * 2, y: actionBaseY - actionStep * 2 },
    ];

    const controlTexture = textures?.get?.('virtual-controls');
    ensureVirtualControlFrames(controlTexture);
    const availableFrames = controlTexture?.getFrameNames?.() ?? [];

    buttons.forEach(({ frame, control, x, y }) => {
      const frameAvailable = availableFrames.includes(frame) || textureHasFrame(controlTexture, frame);
      const textureFrame = frameAvailable ? frame : undefined;
      const button = scene.add?.image?.(x, y, 'virtual-controls', textureFrame);
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
      if (!frameAvailable) {
        button.setDisplaySize?.(96, 96);
      } else {
        button.setDisplaySize?.(80, 80);
      }
      button.setName?.(`touch-${frame}`);
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

  private updateTouchVisibility() {
    const wantsTouch = this.controlScheme === 'touch';
    this.touchContainer?.setVisible?.(wantsTouch);
    this.touchContainer?.setActive?.(wantsTouch);
    if (!wantsTouch) {
      this.touchState = { ...TOUCH_DEFAULT_STATE };
    }
  }
}
