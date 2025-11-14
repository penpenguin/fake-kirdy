import type Phaser from 'phaser';

export interface GoalResultPayload {
  score: number;
  timeMs: number;
}

export interface ResultsOverlayOptions {
  autoTransitionMs?: number;
  onComplete?: (payload: GoalResultPayload) => void;
}

type KeyboardLike = {
  on?: (event: string, handler: (event: unknown) => void) => void;
  off?: (event: string, handler: (event: unknown) => void) => void;
};

type PointerLike = {
  once?: (event: string, handler: () => void) => void;
  off?: (event: string, handler: () => void) => void;
};

export class ResultsOverlay {
  private readonly scene: Phaser.Scene;
  private readonly autoTransitionMs: number;
  private readonly onComplete?: (payload: GoalResultPayload) => void;
  private container?: Phaser.GameObjects.Container;
  private titleText?: Phaser.GameObjects.Text;
  private scoreText?: Phaser.GameObjects.Text;
  private timeText?: Phaser.GameObjects.Text;
  private hintText?: Phaser.GameObjects.Text;
  private background?: Phaser.GameObjects.Rectangle;
  private activePayload?: GoalResultPayload;
  private keyboardHandler?: (event: unknown) => void;
  private pointerHandler?: () => void;
  private scheduledTransition?: { remove?: () => void };
  private initialized = false;

  constructor(scene: Phaser.Scene, options: ResultsOverlayOptions = {}) {
    this.scene = scene;
    this.autoTransitionMs = options.autoTransitionMs ?? 3000;
    this.onComplete = options.onComplete;
  }

  show(payload: GoalResultPayload) {
    this.ensureUi();
    this.activePayload = payload;
    this.render(payload);
    this.container?.setVisible(true);
    this.container?.setAlpha(1);
    this.attachInputHandlers();
    this.scheduleAutoTransition();
  }

  hide() {
    this.cancelAutoTransition();
    this.detachInputHandlers();
    this.container?.setVisible(false);
    this.container?.setAlpha(0);
    this.activePayload = undefined;
  }

  complete() {
    if (!this.activePayload) {
      return;
    }

    const payload = this.activePayload;
    this.hide();
    this.onComplete?.(payload);
  }

  destroy() {
    this.hide();
    this.background?.destroy?.();
    this.titleText?.destroy?.();
    this.scoreText?.destroy?.();
    this.timeText?.destroy?.();
    this.hintText?.destroy?.();
    this.container?.destroy?.();
  }

  private buildUi() {
    if (this.initialized) {
      return;
    }

    const { add } = this.scene;
    if (!add?.container) {
      return;
    }

    const width = this.scene.scale?.width ?? 800;
    const height = this.scene.scale?.height ?? 600;
    const container = add.container(0, 0);
    container.setScrollFactor?.(0, 0);
    container.setDepth?.(2500);
    container.setVisible?.(false);
    container.setAlpha?.(0);

    const background = add.rectangle?.(width / 2, height / 2, width, height, 0x000000, 0.8);
    background?.setScrollFactor?.(0, 0);
    background?.setDepth?.(0);
    background?.setOrigin?.(0.5);
    if (background) {
      container.add?.([background]);
    }

    const title = add.text?.(width / 2, height * 0.3, 'Run Complete', {
      fontSize: '32px',
      color: '#ffffff',
    });
    title?.setOrigin?.(0.5);
    title?.setDepth?.(1);
    title?.setScrollFactor?.(0, 0);
    if (title) {
      container.add?.([title]);
    }

    const score = add.text?.(width / 2, height * 0.45, '', {
      fontSize: '24px',
      color: '#f8e16c',
    });
    score?.setOrigin?.(0.5);
    score?.setDepth?.(1);
    score?.setScrollFactor?.(0, 0);
    if (score) {
      container.add?.([score]);
    }

    const time = add.text?.(width / 2, height * 0.52, '', {
      fontSize: '24px',
      color: '#a0d8ff',
    });
    time?.setOrigin?.(0.5);
    time?.setDepth?.(1);
    time?.setScrollFactor?.(0, 0);
    if (time) {
      container.add?.([time]);
    }

    const hint = add.text?.(width / 2, height * 0.7, 'Press SPACE to continue', {
      fontSize: '20px',
      color: '#ffffff',
    });
    hint?.setOrigin?.(0.5);
    hint?.setDepth?.(1);
    hint?.setScrollFactor?.(0, 0);
    if (hint) {
      container.add?.([hint]);
    }

    this.container = container;
    this.background = background ?? undefined;
    this.titleText = title ?? undefined;
    this.scoreText = score ?? undefined;
    this.timeText = time ?? undefined;
    this.hintText = hint ?? undefined;
    this.initialized = true;
  }

  private ensureUi() {
    if (!this.initialized) {
      this.buildUi();
    }
  }

  private render(payload: GoalResultPayload) {
    const formattedTime = formatTime(payload.timeMs);
    this.scoreText?.setText?.(`Score: ${payload.score.toLocaleString()}`);
    this.timeText?.setText?.(`Time: ${formattedTime}`);
    this.hintText?.setText?.('Press SPACE or click to view results');
  }

  private attachInputHandlers() {
    this.detachInputHandlers();
    const keyboard = this.scene.input?.keyboard as KeyboardLike | undefined;
    const pointer = this.scene.input as PointerLike | undefined;

    this.keyboardHandler = () => this.complete();
    keyboard?.on?.('keydown-SPACE', this.keyboardHandler);
    keyboard?.on?.('keydown-ENTER', this.keyboardHandler);
    this.pointerHandler = () => this.complete();
    pointer?.once?.('pointerdown', this.pointerHandler);
  }

  private detachInputHandlers() {
    const keyboard = this.scene.input?.keyboard as KeyboardLike | undefined;
    keyboard?.off?.('keydown-SPACE', this.keyboardHandler!);
    keyboard?.off?.('keydown-ENTER', this.keyboardHandler!);
    this.keyboardHandler = undefined;
    const pointer = this.scene.input as PointerLike | undefined;
    pointer?.off?.('pointerdown', this.pointerHandler!);
    this.pointerHandler = undefined;
  }

  private scheduleAutoTransition() {
    this.cancelAutoTransition();
    if (!Number.isFinite(this.autoTransitionMs) || this.autoTransitionMs <= 0) {
      return;
    }

    if (this.scene.time?.delayedCall) {
      this.scheduledTransition = this.scene.time.delayedCall(this.autoTransitionMs, () => this.complete(), [], this);
      return;
    }

    const timeout = setTimeout(() => this.complete(), this.autoTransitionMs);
    this.scheduledTransition = { remove: () => clearTimeout(timeout) };
  }

  private cancelAutoTransition() {
    this.scheduledTransition?.remove?.();
    this.scheduledTransition = undefined;
  }
}

function formatTime(timeMs: number) {
  if (!Number.isFinite(timeMs) || timeMs < 0) {
    return '0:00.0';
  }

  const totalSeconds = Math.floor(timeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const tenths = Math.floor((timeMs % 1000) / 100);
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${tenths}`;
}
