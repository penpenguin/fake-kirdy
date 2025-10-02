import type Phaser from 'phaser';
import type { AbilityType } from '../mechanics/AbilitySystem';

export interface HudHPState {
  current: number;
  max: number;
}

const SCORE_DIGITS = 6;

export class Hud {
  private container?: Phaser.GameObjects.Container;
  private hpBar?: Phaser.GameObjects.Rectangle;
  private hpFill?: Phaser.GameObjects.Rectangle;
  private hpLabel?: Phaser.GameObjects.Text;
  private abilityLabel?: Phaser.GameObjects.Text;
  private scoreLabel?: Phaser.GameObjects.Text;
  private controlsLabel?: Phaser.GameObjects.Text;

  constructor(private readonly scene: Phaser.Scene) {
    const { add } = scene;
    if (!add?.container || !add.rectangle || !add.text) {
      return;
    }

    const container = add.container(0, 0);
    container.setScrollFactor?.(0, 0);
    container.setDepth?.(2000);
    container.setVisible?.(true);

    const padding = 16;
    const hpBarWidth = 180;
    const hpBarHeight = 16;

    const hpBar = add.rectangle(padding, padding, hpBarWidth, hpBarHeight, 0x000000, 0.4);
    hpBar.setOrigin?.(0, 0.5);
    hpBar.setScrollFactor?.(0, 0);
    hpBar.setDepth?.(1);

    const hpFill = add.rectangle(padding, padding, hpBarWidth, hpBarHeight, 0xff6bc5, 0.9);
    hpFill.setOrigin?.(0, 0.5);
    hpFill.setScrollFactor?.(0, 0);
    hpFill.setDepth?.(2);

    const labelStyle = { fontSize: '14px', color: '#ffffff' } satisfies Phaser.Types.GameObjects.Text.TextStyle;
    const hpLabel = add.text(padding, padding - 18, 'HP 0 / 0', labelStyle);
    hpLabel.setScrollFactor?.(0, 0);
    hpLabel.setDepth?.(3);

    const abilityLabel = add.text(padding, padding + 18, 'Ability: None', labelStyle);
    abilityLabel.setScrollFactor?.(0, 0);
    abilityLabel.setDepth?.(3);

    const scoreX = padding + hpBarWidth + 24;
    const scoreLabel = add.text(scoreX, padding - 2, 'Score: 000000', labelStyle);
    scoreLabel.setScrollFactor?.(0, 0);
    scoreLabel.setDepth?.(3);

    const controlsLines = [
      'Controls: Left/Right or A/D to move, Space to jump or hover',
      'C inhale, S swallow, Z spit, X discard',
      'Touch: use on-screen buttons',
    ];
    const controlsLabel = add.text(padding, padding + 48, '', labelStyle);
    controlsLabel.setScrollFactor?.(0, 0);
    controlsLabel.setDepth?.(3);
    controlsLabel.setLineSpacing?.(2);
    controlsLabel.setWordWrap?.({ width: (this.scene.scale?.width ?? 800) - padding * 2 });
    controlsLabel.setText?.(controlsLines.join('\n'));

    container.add?.([hpBar, hpFill, hpLabel, abilityLabel, scoreLabel, controlsLabel] as any);

    this.container = container;
    this.hpBar = hpBar;
    this.hpFill = hpFill;
    this.hpLabel = hpLabel;
    this.abilityLabel = abilityLabel;
    this.scoreLabel = scoreLabel;
    this.controlsLabel = controlsLabel;
  }

  updateHP(state: HudHPState) {
    if (!this.hpFill || !this.hpLabel) {
      return;
    }

    const { current, max } = state;
    const normalizedMax = Math.max(0, max);
    const safeCurrent = Math.max(0, Math.min(current, normalizedMax));
    const ratio = normalizedMax <= 0 ? 0 : safeCurrent / normalizedMax;

    this.hpFill.setScale?.(ratio, 1);
    this.hpLabel.setText?.(`HP ${safeCurrent} / ${normalizedMax}`);
  }

  updateAbility(ability: AbilityType | undefined) {
    if (!this.abilityLabel) {
      return;
    }

    const label = ability ? ability.toUpperCase() : 'None';
    this.abilityLabel.setText?.(`Ability: ${label}`);
  }

  updateScore(score: number) {
    if (!this.scoreLabel) {
      return;
    }

    const normalized = Math.max(0, Math.floor(score));
    const formatted = normalized.toString().padStart(SCORE_DIGITS, '0').slice(-SCORE_DIGITS);
    this.scoreLabel.setText?.(`Score: ${formatted}`);
  }

  destroy() {
    this.hpLabel?.destroy?.();
    this.abilityLabel?.destroy?.();
    this.scoreLabel?.destroy?.();
    this.controlsLabel?.destroy?.();
    this.hpFill?.destroy?.();
    this.hpBar?.destroy?.();
    this.container?.destroy?.();
    this.hpLabel = undefined;
    this.abilityLabel = undefined;
    this.scoreLabel = undefined;
    this.controlsLabel = undefined;
    this.hpFill = undefined;
    this.hpBar = undefined;
    this.container = undefined;
  }
}
