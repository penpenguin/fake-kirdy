import type Phaser from 'phaser';
import type { Kirdy } from '../characters/Kirdy';
import type { ActionStateMap } from './InhaleSystem';
import type { SwallowedPayload } from './SwallowSystem';
import type { PhysicsSystem } from '../physics/PhysicsSystem';
import type { AudioManager } from '../audio/AudioManager';

export const ABILITY_TYPES = ['fire', 'ice', 'sword'] as const;
export type AbilityType = (typeof ABILITY_TYPES)[number];

export type AbilityMetadata = {
  type: AbilityType;
  name: string;
  attack: string;
  color: string;
  damage: number;
};

type AbilityContext = {
  scene: Phaser.Scene;
  kirdy: Kirdy;
  physicsSystem?: PhysicsSystem;
  audioManager?: AudioManager;
};

type AbilityDefinition = AbilityMetadata & {
  onAcquire?: (context: AbilityContext) => void;
  onRemove?: (context: AbilityContext) => void;
  performAttack?: (context: AbilityContext) => void;
};

type AbilitySource =
  | { getAbilityType?: () => unknown; getData?: (key: string) => unknown; sprite?: { getData?: (key: string) => unknown } }
  | Phaser.Physics.Matter.Sprite
  | null
  | undefined;

const FIRE_PROJECTILE_SPEED = 420;
const FIRE_PROJECTILE_LIFETIME = 700;
const ICE_PROJECTILE_SPEED = 300;
const ICE_PROJECTILE_LIFETIME = 900;
const SWORD_SLASH_LIFETIME = 200;
const ABILITY_PROJECTILE_DAMAGE = 3;

const abilityCatalogueBase = {
  fire: { type: 'fire', name: 'Fire', attack: 'fire-attack', color: '#FF7B4A', damage: ABILITY_PROJECTILE_DAMAGE },
  ice: { type: 'ice', name: 'Ice', attack: 'ice-attack', color: '#9FD8FF', damage: ABILITY_PROJECTILE_DAMAGE },
  sword: { type: 'sword', name: 'Sword', attack: 'sword-slash', color: '#E9E48D', damage: ABILITY_PROJECTILE_DAMAGE },
} as const satisfies Record<AbilityType, AbilityMetadata>;

const abilityCatalogue: Record<AbilityType, AbilityMetadata> = {
  fire: Object.freeze({ ...abilityCatalogueBase.fire }),
  ice: Object.freeze({ ...abilityCatalogueBase.ice }),
  sword: Object.freeze({ ...abilityCatalogueBase.sword }),
};

Object.freeze(abilityCatalogue);

const abilityTextureFallbacks: Record<AbilityType, readonly string[]> = {
  fire: ['kirdy-fire'],
  ice: ['kirdy-ice'],
  sword: ['kirdy-sword'],
};

const BASE_TEXTURE_FALLBACKS = ['kirdy-idle'] as const;

type TextureEntry = {
  has?: (frame: string) => boolean;
  hasFrame?: (frame: string) => boolean;
  frames?: Record<string, unknown>;
};

type TextureManagerLike = {
  exists?: (key: string) => boolean;
  get?: (key: string) => TextureEntry | undefined;
};

function textureHasFrame(texture: TextureEntry | undefined, frame: string) {
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

function attemptSetTexture(
  sprite: { setTexture?: (key: string, frame?: string) => unknown },
  key: string,
  frame?: string,
) {
  try {
    if (frame !== undefined) {
      sprite.setTexture?.(key, frame);
    } else {
      sprite.setTexture?.(key);
    }
    return true;
  } catch {
    return false;
  }
}

function trySetKirdyTexture(
  context: AbilityContext,
  key: string,
  frame?: string,
  fallbackKeys: readonly string[] = [],
) {
  const sprite = context.kirdy.sprite;
  const textures = context.scene?.textures as TextureManagerLike | undefined;
  const attempts: Array<{ key: string; frame?: string }> = [];

  if (key) {
    attempts.push({ key, frame });
  }

  fallbackKeys.forEach((fallback) => {
    if (fallback) {
      attempts.push({ key: fallback });
    }
  });

  if (key) {
    attempts.push({ key });
  }

  for (const attempt of attempts) {
    const hasTexture = textures?.exists?.(attempt.key);
    if (textures?.exists && hasTexture === false) {
      continue;
    }

    if (attempt.frame) {
      const texture = textures?.get?.(attempt.key);
      if (textures && texture && !textureHasFrame(texture, attempt.frame)) {
        continue;
      }
    }

    if (attemptSetTexture(sprite, attempt.key, attempt.frame)) {
      return;
    }
  }
}

function playAbilitySound(context: AbilityContext, key: string) {
  if (context.audioManager) {
    context.audioManager.playSfx(key);
    return;
  }

  context.scene.sound?.play?.(key);
}

const abilityDefinitions: Record<AbilityType, AbilityDefinition> = {
  fire: {
    ...abilityCatalogue.fire,
    onAcquire: (context) => {
      context.kirdy.sprite.setTint?.(hexToTint(abilityCatalogue.fire.color));
      trySetKirdyTexture(context, 'kirdy', 'fire', abilityTextureFallbacks.fire);
    },
    onRemove: (context) => {
      context.kirdy.sprite.clearTint?.();
      trySetKirdyTexture(context, 'kirdy', undefined, BASE_TEXTURE_FALLBACKS);
    },
    performAttack: (context) => {
      const { scene, kirdy, physicsSystem } = context;
      const projectile = spawnProjectile({ scene, kirdy }, abilityCatalogue.fire.attack);
      if (!projectile) {
        return;
      }

      const direction = kirdy.sprite.flipX === true ? -1 : 1;
      projectile.setIgnoreGravity?.(true);
      projectile.setFixedRotation?.();
      projectile.setName?.('kirdy-fire-attack');
      projectile.setVelocityX?.(direction * FIRE_PROJECTILE_SPEED);
      projectile.once?.('destroy', () => {
        scene.events?.emit?.('ability-attack-destroyed', { abilityType: 'fire', projectile });
      });
      scene.time?.delayedCall?.(FIRE_PROJECTILE_LIFETIME, () => {
        if (physicsSystem) {
          physicsSystem.destroyProjectile(projectile);
        } else {
          projectile.destroy?.();
        }
      });
      physicsSystem?.registerPlayerAttack(projectile, { damage: abilityCatalogue.fire.damage });
      playAbilitySound(context, 'ability-fire-attack');
    },
  },
  ice: {
    ...abilityCatalogue.ice,
    onAcquire: (context) => {
      context.kirdy.sprite.setTint?.(hexToTint(abilityCatalogue.ice.color));
      trySetKirdyTexture(context, 'kirdy', 'ice', abilityTextureFallbacks.ice);
    },
    onRemove: (context) => {
      context.kirdy.sprite.clearTint?.();
      trySetKirdyTexture(context, 'kirdy', undefined, BASE_TEXTURE_FALLBACKS);
    },
    performAttack: (context) => {
      const { scene, kirdy, physicsSystem } = context;
      const projectile = spawnProjectile({ scene, kirdy }, abilityCatalogue.ice.attack);
      if (!projectile) {
        return;
      }

      const direction = kirdy.sprite.flipX === true ? -1 : 1;
      projectile.setIgnoreGravity?.(true);
      projectile.setFixedRotation?.();
      projectile.setName?.('kirdy-ice-attack');
      projectile.setVelocityX?.(direction * ICE_PROJECTILE_SPEED);
      projectile.once?.('destroy', () => {
        scene.events?.emit?.('ability-attack-destroyed', { abilityType: 'ice', projectile });
      });
      scene.time?.delayedCall?.(ICE_PROJECTILE_LIFETIME, () => {
        if (physicsSystem) {
          physicsSystem.destroyProjectile(projectile);
        } else {
          projectile.destroy?.();
        }
      });
      physicsSystem?.registerPlayerAttack(projectile, { damage: abilityCatalogue.ice.damage });
      playAbilitySound(context, 'ability-ice-attack');
    },
  },
  sword: {
    ...abilityCatalogue.sword,
    onAcquire: (context) => {
      context.kirdy.sprite.setTint?.(hexToTint(abilityCatalogue.sword.color));
      trySetKirdyTexture(context, 'kirdy', 'sword', abilityTextureFallbacks.sword);
    },
    onRemove: (context) => {
      context.kirdy.sprite.clearTint?.();
      trySetKirdyTexture(context, 'kirdy', undefined, BASE_TEXTURE_FALLBACKS);
    },
    performAttack: (context) => {
      const { scene, kirdy, physicsSystem } = context;
      const slash = spawnSlash({ scene, kirdy }, abilityCatalogue.sword.attack);
      if (!slash) {
        return;
      }

      slash.once?.('destroy', () => {
        scene.events?.emit?.('ability-attack-destroyed', { abilityType: 'sword', projectile: slash });
      });
      scene.time?.delayedCall?.(SWORD_SLASH_LIFETIME, () => {
        if (physicsSystem) {
          physicsSystem.destroyProjectile(slash);
        } else {
          slash.destroy?.();
        }
      });
      physicsSystem?.registerPlayerAttack(slash, { damage: abilityCatalogue.sword.damage });
      playAbilitySound(context, 'ability-sword-attack');
    },
  },
};

export class AbilitySystem {
  static readonly abilities: Readonly<Record<AbilityType, AbilityMetadata>> = abilityCatalogue;

  static copyAbility(source: AbilitySource): AbilityMetadata | undefined {
    const abilityType = AbilitySystem.extractAbilityType(source);
    return abilityType ? AbilitySystem.abilities[abilityType] : undefined;
  }

  static executeAbility(ability: AbilityMetadata | AbilityDefinition, context: AbilityContext) {
    const definition = abilityDefinitions[ability.type];
    if (!definition) {
      return;
    }

    definition.performAttack?.(context);
    const animationKey = `kirdy-${ability.type}-attack`;
    const animations = context.scene?.anims as Partial<{ exists: (key: string) => boolean }> | undefined;
    if (!animations?.exists || animations.exists(animationKey)) {
      context.kirdy.sprite.anims?.play?.(animationKey, true);
    }
  }

  private static extractAbilityType(source: AbilitySource): AbilityType | undefined {
    if (!source) {
      return undefined;
    }

    const abilityGetter = (source as { getAbilityType?: () => unknown }).getAbilityType;
    if (typeof abilityGetter === 'function') {
      const value = abilityGetter.call(source);
      if (typeof value === 'string' && isAbilityType(value)) {
        return value;
      }
    }

    const direct = AbilitySystem.readAbilityTypeFromData(source as { getData?: (key: string) => unknown });
    if (direct) {
      return direct;
    }

    const sprite = (source as { sprite?: { getData?: (key: string) => unknown } }).sprite;
    if (sprite) {
      const spriteAbility = AbilitySystem.readAbilityTypeFromData(sprite);
      if (spriteAbility) {
        return spriteAbility;
      }
    }

    return undefined;
  }

  private static readAbilityTypeFromData(candidate: { getData?: (key: string) => unknown } | undefined): AbilityType | undefined {
    if (!candidate?.getData) {
      return undefined;
    }

    const value = candidate.getData('abilityType');
    if (typeof value === 'string' && isAbilityType(value)) {
      return value;
    }

    return undefined;
  }

  private currentAbility?: AbilityDefinition;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly kirdy: Kirdy,
    private readonly physicsSystem?: PhysicsSystem,
    private readonly audioManager?: AudioManager,
  ) {}

  private buildAbilityContext(): AbilityContext {
    return {
      scene: this.scene,
      kirdy: this.kirdy,
      physicsSystem: this.physicsSystem,
      audioManager: this.audioManager,
    };
  }

  update(actions: ActionStateMap) {
    if (!this.currentAbility) {
      return;
    }

    if (actions.discard?.justPressed) {
      const discarded = this.currentAbility.type;
      this.clearAbility();
      this.scene.events?.emit?.('ability-discarded', { abilityType: discarded });
      return;
    }

    if (actions.spit?.justPressed) {
      AbilitySystem.executeAbility(this.currentAbility, this.buildAbilityContext());
    }
  }

  applySwallowedPayload(payload?: SwallowedPayload) {
    const definition = this.resolveAbilityDefinition(payload);
    if (!definition) {
      return;
    }

    const abilityType = definition.type;

    if (this.currentAbility?.type === abilityType) {
      definition.onAcquire?.(this.buildAbilityContext());
      this.kirdy.sprite.setData?.('equippedAbility', abilityType);
      this.scene.events?.emit?.('ability-acquired', { abilityType });
      return;
    }

    this.clearAbility();
    this.currentAbility = definition;
    definition.onAcquire?.(this.buildAbilityContext());
    this.kirdy.sprite.setData?.('equippedAbility', abilityType);
    this.scene.events?.emit?.('ability-acquired', { abilityType });
  }

  getCurrentAbilityType(): AbilityType | undefined {
    return this.currentAbility?.type;
  }

  private clearAbility() {
    if (!this.currentAbility) {
      return;
    }

    this.currentAbility.onRemove?.(this.buildAbilityContext());
    this.kirdy.sprite.setData?.('equippedAbility', undefined);
    this.scene.events?.emit?.('ability-cleared', {});
    this.currentAbility = undefined;
  }

  private resolveAbilityDefinition(payload?: SwallowedPayload): AbilityDefinition | undefined {
    if (!payload) {
      return undefined;
    }

    const ability = payload.ability;
    if (ability && isAbilityType(ability.type)) {
      const definition = abilityDefinitions[ability.type];
      if (definition) {
        return definition;
      }
    }

    const abilityType = payload.abilityType;
    if (typeof abilityType === 'string' && isAbilityType(abilityType)) {
      return abilityDefinitions[abilityType];
    }

    return undefined;
  }
}

function hexToTint(color: string): number {
  const normalized = color.startsWith('#') ? color.slice(1) : color;
  const parsed = Number.parseInt(normalized, 16);
  return Number.isNaN(parsed) ? 0xffffff : parsed;
}

function spawnProjectile(context: { scene: Phaser.Scene; kirdy: Kirdy }, texture: string) {
  const { scene, kirdy } = context;
  const spawnX = kirdy.sprite.x ?? 0;
  const spawnY = kirdy.sprite.y ?? 0;
  return scene.matter?.add?.sprite?.(spawnX, spawnY, texture);
}

function spawnSlash(context: { scene: Phaser.Scene; kirdy: Kirdy }, texture: string) {
  const { scene, kirdy } = context;
  const spawnX = kirdy.sprite.x ?? 0;
  const spawnY = kirdy.sprite.y ?? 0;
  const slash = scene.matter?.add?.sprite?.(spawnX, spawnY, texture);
  slash?.setIgnoreGravity?.(true);
  slash?.setFixedRotation?.();
  slash?.setSensor?.(true);
  slash?.setName?.('kirdy-sword-slash');
  configureSlashHitbox(slash, kirdy.sprite);
  return slash;
}

function configureSlashHitbox(
  slash?: Phaser.Physics.Matter.Sprite,
  kirdySprite?: Phaser.Physics.Matter.Sprite,
) {
  if (!slash) {
    return;
  }

  slash.setOrigin?.(0.5, 0.5);

  const rawWidth = slash.displayWidth ?? slash.width ?? 0;
  const rawHeight = slash.displayHeight ?? slash.height ?? 0;
  const fallbackSize = 64;
  const width = Number.isFinite(rawWidth) && rawWidth > 0 ? rawWidth : fallbackSize;
  const height = Number.isFinite(rawHeight) && rawHeight > 0 ? rawHeight : fallbackSize;
  const radius = Math.max(1, Math.round(Math.max(width, height) / 2));
  const offsetX = Math.round(width / 2 - radius);
  const offsetY = Math.round(height / 2 - radius);

  if (typeof slash.setCircle === 'function') {
    slash.setCircle(radius, offsetX, offsetY);
  } else if (typeof slash.setBody === 'function') {
    slash.setBody({ type: 'circle', radius, x: offsetX, y: offsetY });
  } else {
    slash.setRectangle?.(radius * 2, radius * 2);
  }

  if (typeof slash.setPosition === 'function') {
    const targetX = kirdySprite?.x ?? slash.x ?? 0;
    const targetY = kirdySprite?.y ?? slash.y ?? 0;
    slash.setPosition(targetX, targetY);
  }
}

export function isAbilityType(value: string | undefined): value is AbilityType {
  return (ABILITY_TYPES as readonly string[]).includes(value ?? '');
}
