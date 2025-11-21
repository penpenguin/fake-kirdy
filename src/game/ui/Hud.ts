import type Phaser from 'phaser';
import { ABILITY_TYPES, type AbilityType } from '../mechanics/AbilitySystem';
import { BRANCH_RELIC_ITEM_IDS, type BranchRelicItemId } from '../world/branch-relics';
import { resolveCollectibleTextureKey } from '../world/collectible-assets';
import { HUD_LINE_SPACING, HUD_SAFE_AREA_HEIGHT } from './hud-layout';

export const HUD_ABILITY_ICON_SIZE = 20;
export const HUD_RELIC_LABEL_OFFSET = 120;
const HUD_RELIC_ICON_SIZE = 20;
const RELIC_ICON_DIM_ALPHA = 0.35;
const RELIC_ICON_DIM_TINT = 0x4d4d4d;
const RELIC_ICON_SPACING = 6;

type CanvasTextureLike = {
  context?: CanvasRenderingContext2D | null;
  refresh?: () => void;
  destroy?: () => void;
};

type TextureManagerLike = {
  exists?: (key: string) => boolean;
  get?: (
    key: string,
  ) =>
    | {
        hasFrame?: (frame: string) => boolean;
        has?: (frame: string) => boolean;
        frames?: Record<string, unknown>;
      }
    | undefined;
  createCanvas?: (key: string, width: number, height: number) => CanvasTextureLike | undefined;
};

export interface HudHPState {
  current: number;
  max: number;
}

const SCORE_DIGITS = 6;
type AbilityIconTheme = {
  background: string;
  border: string;
  shapePrimary?: string;
  shapeSecondary?: string;
  detail?: string;
  glyph?: string;
  glyphColor?: string;
  glyphOffsetY?: number;
};

const DEFAULT_ABILITY_ICON_THEME: AbilityIconTheme = {
  background: '#c0c0c0',
  border: '#ffffff',
  glyph: '?',
  glyphColor: '#1f1f1f',
};

const ABILITY_ICON_THEMES: Record<AbilityType, AbilityIconTheme> = ABILITY_TYPES.reduce(
  (acc, type) => {
    if (type === 'fire') {
      acc[type] = {
        background: '#2b0d1a',
        border: '#ffb347',
        shapePrimary: '#ff6b3d',
        shapeSecondary: '#ffd166',
      };
    } else if (type === 'ice') {
      acc[type] = {
        background: '#0b1a33',
        border: '#8ee1ff',
        shapePrimary: '#c3f3ff',
        shapeSecondary: '#78c0e0',
      };
    } else if (type === 'sword') {
      acc[type] = {
        background: '#eae8dc',
        border: '#4f5d75',
        shapePrimary: '#bcc5d3',
        shapeSecondary: '#f4a259',
        detail: '#2d3142',
      };
    } else {
      acc[type] = { ...DEFAULT_ABILITY_ICON_THEME };
    }
    return acc;
  },
  {} as Record<AbilityType, AbilityIconTheme>,
);

type AbilityIconRenderer = (context: CanvasRenderingContext2D, theme: AbilityIconTheme) => void;

const ABILITY_ICON_RENDERERS: Partial<Record<AbilityType, AbilityIconRenderer>> = {
  fire: drawFireIcon,
  ice: drawIceIcon,
  sword: drawSwordIcon,
};

type AbilityIconCandidate = { key: string; frame?: string };

function textureHasFrame(texture: { hasFrame?: (frame: string) => boolean; has?: (frame: string) => boolean; frames?: Record<string, unknown> } | undefined, frame: string) {
  if (!texture || !frame) {
    return false;
  }

  if (typeof texture.hasFrame === 'function' && texture.hasFrame(frame)) {
    return true;
  }

  if (typeof texture.has === 'function' && texture.has(frame)) {
    return true;
  }

  if (texture.frames && Object.prototype.hasOwnProperty.call(texture.frames, frame)) {
    return true;
  }

  return false;
}

function canUseTextureCandidate(candidate: AbilityIconCandidate, textures: TextureManagerLike | undefined) {
  if (!candidate.key) {
    return false;
  }

  const hasTexture = textures?.exists?.(candidate.key);
  if (textures?.exists && hasTexture === false) {
    return false;
  }

  if (candidate.frame === undefined || !textures?.get) {
    return true;
  }

  const texture = textures.get(candidate.key);
  return textureHasFrame(texture, candidate.frame);
}

function abilityIconTextureKey(ability: AbilityType) {
  return `hud-ability-${ability}`;
}

function ensureAbilityIconTexture(ability: AbilityType, textures: TextureManagerLike | undefined) {
  if (!textures?.createCanvas) {
    return false;
  }

  const textureKey = abilityIconTextureKey(ability);
  if (textures.exists?.(textureKey)) {
    return true;
  }

  const canvasTexture = textures.createCanvas(textureKey, HUD_ABILITY_ICON_SIZE, HUD_ABILITY_ICON_SIZE);
  const context = canvasTexture?.context;
  if (!canvasTexture || !context) {
    canvasTexture?.destroy?.();
    return false;
  }

  drawAbilityIcon(context, ability);
  canvasTexture.refresh?.();

  return true;
}

function drawAbilityIcon(context: CanvasRenderingContext2D, ability: AbilityType) {
  const theme = ABILITY_ICON_THEMES[ability] ?? DEFAULT_ABILITY_ICON_THEME;
  drawIconBackground(context, theme);
  const renderer = ABILITY_ICON_RENDERERS[ability];
  if (renderer) {
    renderer(context, theme);
    return;
  }

  drawGlyphIcon(context, theme);
}

function drawIconBackground(context: CanvasRenderingContext2D, theme: AbilityIconTheme) {
  const size = HUD_ABILITY_ICON_SIZE;
  const half = size / 2;
  const radius = half - 1;

  context.clearRect(0, 0, size, size);
  context.beginPath();
  context.fillStyle = theme.background;
  context.arc(half, half, radius, 0, Math.PI * 2);
  context.fill();

  context.lineWidth = 2;
  context.strokeStyle = theme.border;
  context.stroke();
}

function drawGlyphIcon(context: CanvasRenderingContext2D, theme: AbilityIconTheme) {
  const size = HUD_ABILITY_ICON_SIZE;
  const half = size / 2;
  context.fillStyle = theme.glyphColor ?? '#1f1f1f';
  context.font = `bold ${Math.round(size * 0.58)}px 'Press Start 2P', 'Courier New', sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(theme.glyph ?? '?', half, half + (theme.glyphOffsetY ?? 0));
}

function drawFireIcon(context: CanvasRenderingContext2D, theme: AbilityIconTheme) {
  const size = HUD_ABILITY_ICON_SIZE;
  const half = size / 2;

  context.beginPath();
  context.moveTo(half, size * 0.15);
  context.bezierCurveTo(size * 0.05, size * 0.3, size * 0.1, size * 0.75, half, size * 0.92);
  context.bezierCurveTo(size * 0.9, size * 0.75, size * 0.95, size * 0.3, half, size * 0.15);
  context.closePath();
  context.fillStyle = theme.shapePrimary ?? '#ff7f50';
  context.fill();

  context.beginPath();
  context.moveTo(half, size * 0.35);
  context.bezierCurveTo(size * 0.35, size * 0.4, size * 0.35, size * 0.6, half, size * 0.78);
  context.bezierCurveTo(size * 0.65, size * 0.6, size * 0.65, size * 0.4, half, size * 0.35);
  context.closePath();
  context.fillStyle = theme.shapeSecondary ?? '#ffe29a';
  context.fill();
}

function drawIceIcon(context: CanvasRenderingContext2D, theme: AbilityIconTheme) {
  const size = HUD_ABILITY_ICON_SIZE;
  const half = size / 2;

  context.save();
  context.translate(half, half);
  context.strokeStyle = theme.shapePrimary ?? '#cfefff';
  context.lineWidth = 2;

  for (let i = 0; i < 6; i += 1) {
    context.beginPath();
    context.moveTo(0, -half + 3);
    context.lineTo(0, half - 3);
    context.stroke();

    context.beginPath();
    context.moveTo(0, -half + 6);
    context.lineTo(3, -half + 11);
    context.moveTo(0, -half + 6);
    context.lineTo(-3, -half + 11);
    context.stroke();

    context.rotate(Math.PI / 3);
  }

  context.restore();
}

function drawSwordIcon(context: CanvasRenderingContext2D, theme: AbilityIconTheme) {
  const size = HUD_ABILITY_ICON_SIZE;
  const bladeWidth = size * 0.22;
  const bladeHeight = size * 0.55;
  const bladeX = (size - bladeWidth) / 2;
  const bladeY = size * 0.12;

  context.fillStyle = theme.shapePrimary ?? '#dfe7f2';
  context.fillRect(bladeX, bladeY, bladeWidth, bladeHeight);

  context.beginPath();
  context.moveTo(size / 2, bladeY);
  context.lineTo(bladeX, bladeY + bladeWidth * 0.6);
  context.lineTo(bladeX + bladeWidth, bladeY + bladeWidth * 0.6);
  context.closePath();
  context.fill();

  const guardY = bladeY + bladeHeight;
  context.fillStyle = theme.shapeSecondary ?? '#f4a259';
  context.fillRect(size * 0.25, guardY, size * 0.5, size * 0.08);

  context.fillStyle = theme.detail ?? '#2d3142';
  context.fillRect(size * 0.45, guardY + size * 0.08, size * 0.1, size * 0.22);
}

export class Hud {
  private container?: Phaser.GameObjects.Container;
  private background?: Phaser.GameObjects.Rectangle;
  private border?: Phaser.GameObjects.Rectangle;
  private hpBar?: Phaser.GameObjects.Rectangle;
  private hpFill?: Phaser.GameObjects.Rectangle;
  private hpLabel?: Phaser.GameObjects.Text;
  private abilityLabel?: Phaser.GameObjects.Text;
  private scoreLabel?: Phaser.GameObjects.Text;
  private mapLabel?: Phaser.GameObjects.Text;
  private abilityIcon?: Phaser.GameObjects.Image;
  private abilityIconPosition: { x: number; y: number } = { x: 0, y: 0 };
  private relicLabel?: Phaser.GameObjects.Text;
  private relicIcons: Array<{ itemId: BranchRelicItemId; icon?: Phaser.GameObjects.Image }> = [];

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

    const labelStyle =
      {
        fontSize: '14px',
        color: '#ffffff',
        lineSpacing: HUD_LINE_SPACING,
      } satisfies Phaser.Types.GameObjects.Text.TextStyle;
    const hpLabel = add.text(padding, padding - 18, 'HP 0 / 0', labelStyle);
    hpLabel.setScrollFactor?.(0, 0);
    hpLabel.setDepth?.(4);

    const abilityIconX = padding;
    const abilityIconY = padding + 18 + HUD_LINE_SPACING;
    const abilityLabelX = abilityIconX + HUD_ABILITY_ICON_SIZE + 8;
    const abilityLabel = add.text(abilityLabelX, abilityIconY, 'Ability: None', labelStyle);
    abilityLabel.setOrigin?.(0, 0.5);
    abilityLabel.setScrollFactor?.(0, 0);
    abilityLabel.setDepth?.(4);

    const scoreX = padding + hpBarWidth + 24;
    const scoreLabel = add.text(scoreX, padding - 2, 'Score: 000000', labelStyle);
    scoreLabel.setScrollFactor?.(0, 0);
    scoreLabel.setDepth?.(4);

    const mapLabelX = backgroundWidth - padding;
    const mapLabelY = padding - 2;
    const mapLabel = add.text(mapLabelX, mapLabelY, 'Map: Unknown', labelStyle);
    mapLabel.setOrigin?.(1, 0);
    mapLabel.setScrollFactor?.(0, 0);
    mapLabel.setDepth?.(4);

    const relicLabelX = mapLabelX - HUD_RELIC_LABEL_OFFSET;
    const relicLabelY = mapLabelY + HUD_LINE_SPACING + 18;
    const relicLabel = add.text(relicLabelX, relicLabelY, 'Relics:', labelStyle);
    relicLabel.setOrigin?.(1, 0.5);
    relicLabel.setScrollFactor?.(0, 0);
    relicLabel.setDepth?.(4);

    this.abilityIconPosition = { x: abilityIconX, y: abilityIconY };

    container.add?.([background, border, hpBar, hpFill, hpLabel, abilityLabel, scoreLabel, mapLabel, relicLabel] as any);

    const relicIconBaseX = mapLabelX;
    const relicIconY = relicLabelY;
    BRANCH_RELIC_ITEM_IDS.forEach((itemId, index) => {
      const iconX = relicIconBaseX - index * (HUD_RELIC_ICON_SIZE + RELIC_ICON_SPACING);
      const icon = add.image(iconX, relicIconY, resolveCollectibleTextureKey(itemId));
      icon.setOrigin?.(1, 0.5);
      icon.setScrollFactor?.(0, 0);
      icon.setDepth?.(4);
      icon.setDisplaySize?.(HUD_RELIC_ICON_SIZE, HUD_RELIC_ICON_SIZE);
      icon.setVisible?.(true);
      icon.setAlpha?.(RELIC_ICON_DIM_ALPHA);
      icon.setTint?.(RELIC_ICON_DIM_TINT);
      container.add?.(icon as any);
      this.relicIcons.push({ itemId, icon });
    });

    this.container = container;
    this.background = background;
    this.border = border;
    this.hpBar = hpBar;
    this.hpFill = hpFill;
    this.hpLabel = hpLabel;
    this.abilityLabel = abilityLabel;
    this.scoreLabel = scoreLabel;
    this.mapLabel = mapLabel;
    this.relicLabel = relicLabel;
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
    this.updateAbilityIcon(ability);
  }

  updateScore(score: number) {
    if (!this.scoreLabel) {
      return;
    }

    const normalized = Math.max(0, Math.floor(score));
    const formatted = normalized.toString().padStart(SCORE_DIGITS, '0').slice(-SCORE_DIGITS);
    this.scoreLabel.setText?.(`Score: ${formatted}`);
  }

  updateMapName(name?: string | null) {
    if (!this.mapLabel) {
      return;
    }

    const trimmed = typeof name === 'string' ? name.trim() : '';
    const resolved = trimmed.length > 0 ? trimmed : 'Unknown';
    this.mapLabel.setText?.(`Map: ${resolved}`);
  }

  updateRelics(collectedItems: string[] | undefined) {
    if (this.relicIcons.length === 0) {
      return;
    }

    const collectedSet = new Set(
      (collectedItems ?? []).filter(
        (itemId): itemId is string => typeof itemId === 'string' && itemId.trim().length > 0,
      ),
    );

    this.relicIcons.forEach(({ itemId, icon }) => {
      if (!icon) {
        return;
      }

      if (collectedSet.has(itemId)) {
        icon.clearTint?.();
        icon.setAlpha?.(1);
        return;
      }

      icon.setTint?.(RELIC_ICON_DIM_TINT);
      icon.setAlpha?.(RELIC_ICON_DIM_ALPHA);
    });
  }

  private updateAbilityIcon(ability: AbilityType | undefined) {
    if (!ability) {
      this.abilityIcon?.setVisible?.(false);
      return;
    }

    const icon = this.ensureAbilityIcon(ability);
    if (!icon) {
      return;
    }

    const textures = this.scene?.textures as TextureManagerLike | undefined;
    ensureAbilityIconTexture(ability, textures);
    const applied = this.applyAbilityIconTexture(icon, ability, textures);
    icon.setVisible(applied);
    if (!applied) {
      icon.setVisible(false);
    }
  }

  private ensureAbilityIcon(ability: AbilityType) {
    if (this.abilityIcon) {
      return this.abilityIcon;
    }

    const add = this.scene.add;
    if (!add?.image) {
      return undefined;
    }

    const textures = this.scene?.textures as TextureManagerLike | undefined;
    ensureAbilityIconTexture(ability, textures);
    const candidates = this.resolveAbilityIconCandidates(ability);
    const { x, y } = this.abilityIconPosition;

    for (const candidate of candidates) {
      if (!canUseTextureCandidate(candidate, textures)) {
        continue;
      }

      try {
        const icon =
          candidate.frame !== undefined
            ? add.image(x, y, candidate.key, candidate.frame)
            : add.image(x, y, candidate.key);
        icon.setOrigin?.(0, 0.5);
        icon.setScrollFactor?.(0, 0);
        icon.setDepth?.(4);
        icon.setVisible?.(false);
        icon.setDisplaySize?.(HUD_ABILITY_ICON_SIZE, HUD_ABILITY_ICON_SIZE);
        this.container?.add?.(icon as any);
        this.abilityIcon = icon;
        return icon;
      } catch {
        // try next candidate
      }
    }

    return undefined;
  }

  private applyAbilityIconTexture(
    icon: Phaser.GameObjects.Image,
    ability: AbilityType,
    textures: TextureManagerLike | undefined,
  ) {
    const candidates = this.resolveAbilityIconCandidates(ability);

    for (const candidate of candidates) {
      if (!canUseTextureCandidate(candidate, textures)) {
        continue;
      }

      try {
        if (candidate.frame !== undefined) {
          icon.setTexture(candidate.key, candidate.frame);
        } else {
          icon.setTexture(candidate.key);
        }
        return true;
      } catch {
        // try next candidate
      }
    }

    return false;
  }

  private resolveAbilityIconCandidates(ability: AbilityType): AbilityIconCandidate[] {
    return [
      { key: abilityIconTextureKey(ability) },
      { key: 'hud-ability-icons', frame: ability },
      { key: 'hud-ability', frame: ability },
      { key: `kirdy-${ability}` },
      { key: 'kirdy', frame: ability },
      { key: 'kirdy-idle', frame: ability },
    ];
  }

  destroy() {
    this.background?.destroy?.();
    this.hpLabel?.destroy?.();
    this.abilityLabel?.destroy?.();
    this.scoreLabel?.destroy?.();
    this.mapLabel?.destroy?.();
    this.hpFill?.destroy?.();
    this.hpBar?.destroy?.();
    this.border?.destroy?.();
    this.container?.destroy?.();
    this.abilityIcon?.destroy?.();
    this.background = undefined;
    this.border = undefined;
    this.hpLabel = undefined;
    this.abilityLabel = undefined;
    this.scoreLabel = undefined;
    this.mapLabel = undefined;
    this.hpFill = undefined;
    this.hpBar = undefined;
    this.container = undefined;
    this.abilityIcon = undefined;
    this.relicLabel?.destroy?.();
    this.relicIcons.forEach(({ icon }) => icon?.destroy?.());
    this.relicIcons = [];
    this.relicLabel = undefined;
  }

}
