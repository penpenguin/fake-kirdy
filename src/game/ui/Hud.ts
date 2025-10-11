import type Phaser from 'phaser';
import type { AbilityType } from '../mechanics/AbilitySystem';
import { HUD_SAFE_AREA_HEIGHT } from './hud-layout';

export interface HudHPState {
  current: number;
  max: number;
}

const SCORE_DIGITS = 6;

export class Hud {
  private container?: Phaser.GameObjects.Container;
  private background?: Phaser.GameObjects.Rectangle;
  private border?: Phaser.GameObjects.Rectangle;
  private hpBar?: Phaser.GameObjects.Rectangle;
  private hpFill?: Phaser.GameObjects.Rectangle;
  private hpLabel?: Phaser.GameObjects.Text;
  private abilityLabel?: Phaser.GameObjects.Text;
  private scoreLabel?: Phaser.GameObjects.Text;

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
    const backgroundWidth = this.scene.scale?.width ?? 800;
    const backgroundHeight = HUD_SAFE_AREA_HEIGHT;

    const background = add.rectangle(0, 0, backgroundWidth, backgroundHeight, 0x121212, 1);
    background.setOrigin?.(0, 0);
    background.setScrollFactor?.(0, 0);
    background.setDepth?.(0);

    const borderHeight = 2;
    const border = add.rectangle(0, backgroundHeight - borderHeight, backgroundWidth, borderHeight, 0x000000, 1);
    border.setOrigin?.(0, 0);
    border.setScrollFactor?.(0, 0);
    border.setDepth?.(1);

    const hpBar = add.rectangle(padding, padding, hpBarWidth, hpBarHeight, 0x000000, 0.4);
    hpBar.setOrigin?.(0, 0.5);
    hpBar.setScrollFactor?.(0, 0);
    hpBar.setDepth?.(2);

    const hpFill = add.rectangle(padding, padding, hpBarWidth, hpBarHeight, 0xff6bc5, 0.9);
    hpFill.setOrigin?.(0, 0.5);
    hpFill.setScrollFactor?.(0, 0);
    hpFill.setDepth?.(3);

    const labelStyle = { fontSize: '14px', color: '#ffffff' } satisfies Phaser.Types.GameObjects.Text.TextStyle;
    const hpLabel = add.text(padding, padding - 18, 'HP 0 / 0', labelStyle);
    hpLabel.setScrollFactor?.(0, 0);
    hpLabel.setDepth?.(4);

    const abilityLabel = add.text(padding, padding + 18, 'Ability: None', labelStyle);
    abilityLabel.setScrollFactor?.(0, 0);
    abilityLabel.setDepth?.(4);

    const scoreX = padding + hpBarWidth + 24;
    const scoreLabel = add.text(scoreX, padding - 2, 'Score: 000000', labelStyle);
    scoreLabel.setScrollFactor?.(0, 0);
    scoreLabel.setDepth?.(4);

    container.add?.([background, border, hpBar, hpFill, hpLabel, abilityLabel, scoreLabel] as any);

    this.container = container;
    this.background = background;
    this.border = border;
    this.hpBar = hpBar;
    this.hpFill = hpFill;
    this.hpLabel = hpLabel;
    this.abilityLabel = abilityLabel;
    this.scoreLabel = scoreLabel;
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
    this.background?.destroy?.();
    this.hpLabel?.destroy?.();
    this.abilityLabel?.destroy?.();
    this.scoreLabel?.destroy?.();
    this.hpFill?.destroy?.();
    this.hpBar?.destroy?.();
    this.border?.destroy?.();
    this.container?.destroy?.();
    this.background = undefined;
    this.border = undefined;
    this.hpLabel = undefined;
    this.abilityLabel = undefined;
    this.scoreLabel = undefined;
    this.hpFill = undefined;
    this.hpBar = undefined;
    this.container = undefined;
  }

}
