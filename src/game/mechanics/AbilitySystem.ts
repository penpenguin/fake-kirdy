import type Phaser from 'phaser';
import type { Kirdy } from '../characters/Kirdy';
import type { ActionStateMap } from './InhaleSystem';
import type { SwallowedPayload } from './SwallowSystem';
import type { PhysicsSystem } from '../physics/PhysicsSystem';
import { PhysicsCategory } from '../physics/PhysicsSystem';
import type { AudioManager } from '../audio/AudioManager';
import { configureProjectileHitbox, resolveForwardSpawnPosition } from './projectilePlacement';
import { attachProjectileTrail } from './projectileTrail';

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
const FIRE_PROJECTILE_STEP_INTERVAL = 100;
const FIRE_PROJECTILE_STEP_DISTANCE = (FIRE_PROJECTILE_SPEED * FIRE_PROJECTILE_STEP_INTERVAL) / 1000;
const FIRE_PROJECTILE_STEP_COUNT = Math.max(1, Math.ceil(FIRE_PROJECTILE_LIFETIME / FIRE_PROJECTILE_STEP_INTERVAL));
const DEFAULT_TILE_SIZE = 32;
const ICE_AOE_MARGIN = DEFAULT_TILE_SIZE;
const ICE_AOE_LIFETIME = 200;
const ICE_AOE_ALPHA = 0.6;
const ICE_TEXTURE_SIZE = 128;
const SWORD_SLASH_LIFETIME = 200;
const SWORD_STRIKE_WIDTH = 72;
const SWORD_STRIKE_HEIGHT = 64;
const SWORD_TEXTURE_WIDTH = 96;
const SWORD_TEXTURE_HEIGHT = 32;
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

// Particle systems randomize angle by default, so fire trails must use orientation-agnostic textures.
const abilityTrailParticleCandidates: Record<AbilityType, readonly string[]> = {
  fire: [],
  ice: ['ice-attack', 'inhale-sparkle'],
  sword: ['sword-slash', 'inhale-sparkle'],
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

type CanvasContextLike = {
  fillStyle?: string;
  fillRect?: (x: number, y: number, width: number, height: number) => unknown;
  clearRect?: (x: number, y: number, width: number, height: number) => unknown;
};

type CanvasTextureLike = {
  fill?: (red: number, green: number, blue: number, alpha?: number) => unknown;
  refresh?: () => unknown;
  canvas?: { getContext?: (contextType: string) => CanvasContextLike | null };
  getContext?: (contextType: string) => CanvasContextLike | null;
  getCanvas?: () => { getContext?: (contextType: string) => CanvasContextLike | null };
  context?: CanvasContextLike | null;
};

type TextureManagerWithCanvas = TextureManagerLike & {
  createCanvas?: (key: string, width: number, height: number) => CanvasTextureLike | undefined;
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

type TextureCreationOptions = {
  width?: number;
  height?: number;
  draw?: (context: CanvasContextLike) => void;
  fallbackColor?: string;
};

function ensureAbilityTexture(
  scene: Phaser.Scene,
  textureKey: string,
  color: string,
  options: TextureCreationOptions = {},
) {
  const textures = scene?.textures as TextureManagerWithCanvas | undefined;
  if (!textures || textures.exists?.(textureKey)) {
    return;
  }

  if (typeof textures.createCanvas !== 'function') {
    return;
  }

  const width = Math.max(2, Math.floor(options.width ?? 8));
  const height = Math.max(2, Math.floor(options.height ?? options.width ?? 8));
  const canvasTexture = textures.createCanvas(textureKey, width, height);
  if (!canvasTexture) {
    return;
  }

  const tint = hexToTint(color);
  const red = (tint >> 16) & 0xff;
  const green = (tint >> 8) & 0xff;
  const blue = tint & 0xff;

  const context =
    canvasTexture.context ??
    canvasTexture.getContext?.('2d') ??
    canvasTexture.canvas?.getContext?.('2d') ??
    canvasTexture.getCanvas?.()?.getContext?.('2d');

  if (options.draw && context) {
    options.draw(context);
  } else if (typeof canvasTexture.fill === 'function') {
    canvasTexture.fill(red, green, blue);
  } else if (context) {
    context.fillStyle = options.fallbackColor ?? `rgb(${red}, ${green}, ${blue})`;
    context.fillRect?.(0, 0, width, height);
  }

  canvasTexture.refresh?.();
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
      ensureAbilityTexture(scene, abilityCatalogue.fire.attack, abilityCatalogue.fire.color);
      const projectile = spawnProjectile({ scene, kirdy }, abilityCatalogue.fire.attack);
      if (!projectile) {
        return;
      }

      const direction = kirdy.sprite.flipX === true ? -1 : 1;
      const spawnPosition = resolveForwardSpawnPosition(kirdy.sprite, direction);
      const spawnY = kirdy.sprite.y ?? spawnPosition.y;
      const applyProjectileFacing = () => {
        projectile.setAngle?.(0);
        projectile.setFlipX?.(direction < 0);
      };
      projectile.setPosition?.(spawnPosition.x, spawnY);
      projectile.setIgnoreGravity?.(true);
      projectile.setFixedRotation?.();
      projectile.setSensor?.(true);
      configureProjectileHitbox(projectile);
      projectile.setName?.('kirdy-fire-attack');
      applyProjectileFacing();
      attachProjectileTrail(scene, projectile, { textureKeys: abilityTrailParticleCandidates.fire });
      let projectileDestroyed = false;
      const motionTimers: Array<{ remove?: () => void }> = [];

      const clearMotionTimers = () => {
        motionTimers.forEach((timer) => timer?.remove?.());
        motionTimers.length = 0;
      };

      const destroyProjectile = () => {
        if (projectileDestroyed) {
          return;
        }
        projectileDestroyed = true;
        clearMotionTimers();
        if (physicsSystem) {
          physicsSystem.destroyProjectile(projectile);
        } else {
          projectile.destroy?.();
        }
      };

      projectile.once?.('destroy', () => {
        projectileDestroyed = true;
        clearMotionTimers();
        scene.events?.emit?.('ability-attack-destroyed', { abilityType: 'fire', projectile });
      });

      const scheduleStep = (currentStep: number) => {
        const executeStep = () => {
          if (projectileDestroyed) {
            return;
          }

          const nextStep = currentStep + 1;
          const offsetX = direction * FIRE_PROJECTILE_STEP_DISTANCE * nextStep;
          projectile.setPosition?.(spawnPosition.x + offsetX, spawnY);
          projectile.setVelocity?.(0, 0);
          projectile.setIgnoreGravity?.(true);
          applyProjectileFacing();

          if (nextStep >= FIRE_PROJECTILE_STEP_COUNT) {
            destroyProjectile();
          } else {
            scheduleStep(nextStep);
          }
        };

        if (scene.time?.delayedCall) {
          const timer = scene.time.delayedCall(FIRE_PROJECTILE_STEP_INTERVAL, executeStep);
          if (timer) {
            motionTimers.push(timer);
          }
        } else {
          executeStep();
        }
      };

      scheduleStep(0);
      physicsSystem?.registerPlayerAttack(projectile, { damage: abilityCatalogue.fire.damage });
      projectile.setCollidesWith?.(PhysicsCategory.Enemy);
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
      ensureAbilityTexture(scene, abilityCatalogue.ice.attack, abilityCatalogue.ice.color, {
        width: ICE_TEXTURE_SIZE,
        height: ICE_TEXTURE_SIZE,
        draw: (context) => drawIceBurstTexture(context, abilityCatalogue.ice.color),
      });
      const projectile = spawnProjectile({ scene, kirdy }, abilityCatalogue.ice.attack);
      if (!projectile) {
        return;
      }

      projectile.setPosition?.(kirdy.sprite.x ?? 0, kirdy.sprite.y ?? 0);
      projectile.setIgnoreGravity?.(true);
      projectile.setFixedRotation?.();
      projectile.setSensor?.(true);
      configureIceBurstHitbox(projectile, kirdy.sprite);
      projectile.setAlpha?.(ICE_AOE_ALPHA);
      projectile.setName?.('kirdy-ice-attack');
      attachProjectileTrail(scene, projectile, { textureKeys: abilityTrailParticleCandidates.ice });
      projectile.once?.('destroy', () => {
        scene.events?.emit?.('ability-attack-destroyed', { abilityType: 'ice', projectile });
      });
      scene.time?.delayedCall?.(ICE_AOE_LIFETIME, () => {
        if (physicsSystem) {
          physicsSystem.destroyProjectile(projectile);
        } else {
          projectile.destroy?.();
        }
      });
      physicsSystem?.registerPlayerAttack(projectile, { damage: abilityCatalogue.ice.damage });
      projectile.setCollidesWith?.(PhysicsCategory.Enemy);
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
      ensureAbilityTexture(scene, abilityCatalogue.sword.attack, abilityCatalogue.sword.color, {
        width: SWORD_TEXTURE_WIDTH,
        height: SWORD_TEXTURE_HEIGHT,
        draw: (context) => drawSwordSlashTexture(context, abilityCatalogue.sword.color),
      });
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
      slash.setCollidesWith?.(PhysicsCategory.Enemy);
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

function configureIceBurstHitbox(
  projectile?: Phaser.Physics.Matter.Sprite,
  kirdySprite?: Phaser.Physics.Matter.Sprite,
) {
  if (!projectile) {
    return;
  }

  const fallbackSize = 64;
  const baseWidth = Math.max(
    fallbackSize,
    Math.round(kirdySprite?.displayWidth ?? kirdySprite?.width ?? projectile.displayWidth ?? projectile.width ?? fallbackSize),
  );
  const baseHeight = Math.max(
    fallbackSize,
    Math.round(kirdySprite?.displayHeight ?? kirdySprite?.height ?? projectile.displayHeight ?? projectile.height ?? fallbackSize),
  );
  const width = baseWidth + ICE_AOE_MARGIN * 2;
  const height = baseHeight + ICE_AOE_MARGIN * 2;

  if (typeof projectile.setRectangle === 'function') {
    projectile.setRectangle(width, height);
  } else if (typeof projectile.setBody === 'function') {
    projectile.setBody({ type: 'rectangle', width, height });
  } else if (typeof projectile.setCircle === 'function') {
    const radius = Math.max(4, Math.round(Math.max(width, height) / 2));
    projectile.setCircle(radius);
  }

  projectile.setDisplaySize?.(width, height);
}

function configureSlashHitbox(
  slash?: Phaser.Physics.Matter.Sprite,
  kirdySprite?: Phaser.Physics.Matter.Sprite,
) {
  if (!slash) {
    return;
  }

  const strikeWidth = SWORD_STRIKE_WIDTH;
  const strikeHeight = Math.max(
    SWORD_STRIKE_HEIGHT,
    Math.round(kirdySprite?.displayHeight ?? slash.displayHeight ?? slash.height ?? SWORD_STRIKE_HEIGHT),
  );

  if (typeof slash.setRectangle === 'function') {
    slash.setRectangle(strikeWidth, strikeHeight);
  } else if (typeof slash.setBody === 'function') {
    slash.setBody({ type: 'rectangle', width: strikeWidth, height: strikeHeight });
  } else if (typeof slash.setCircle === 'function') {
    const radius = Math.max(strikeWidth, strikeHeight) / 2;
    slash.setCircle(radius);
  }

  const direction = kirdySprite?.flipX === true ? -1 : 1;
  const baseWidth = Math.max(
    SWORD_STRIKE_WIDTH,
    Math.round(kirdySprite?.displayWidth ?? slash.displayWidth ?? slash.width ?? SWORD_STRIKE_WIDTH),
  );
  const offsetX = direction * Math.round(baseWidth / 2 + strikeWidth / 4);
  const targetX = (kirdySprite?.x ?? slash.x ?? 0) + offsetX;
  const targetY = kirdySprite?.y ?? slash.y ?? 0;
  slash.setPosition?.(targetX, targetY);
  slash.setAlpha?.(0.9);
  slash.setAngle?.(direction * 12);
  slash.setFlipX?.(direction < 0);
}

export function isAbilityType(value: string | undefined): value is AbilityType {
  return (ABILITY_TYPES as readonly string[]).includes(value ?? '');
}

function drawIceBurstTexture(context: CanvasContextLike, color: string) {
  const tint = hexToTint(color);
  const red = (tint >> 16) & 0xff;
  const green = (tint >> 8) & 0xff;
  const blue = tint & 0xff;
  const canvasLike = (context as { canvas?: { width?: number; height?: number } }).canvas;
  const width = canvasLike?.width ?? ICE_TEXTURE_SIZE;
  const height = canvasLike?.height ?? ICE_TEXTURE_SIZE;
  const centerX = width / 2;
  const centerY = height / 2;
  const layers = 8;

  context.clearRect?.(0, 0, width, height);

  for (let i = 0; i < layers; i += 1) {
    const progress = 1 - i / layers;
    const size = Math.max(4, Math.round(Math.max(width, height) * progress));
    const alpha = Math.max(0.1, ICE_AOE_ALPHA * progress);
    context.fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha.toFixed(2)})`;
    const offset = size / 2;
    context.fillRect?.(centerX - offset, centerY - offset, size, size);
  }
}

function drawSwordSlashTexture(context: CanvasContextLike, color: string) {
  const tint = hexToTint(color);
  const red = (tint >> 16) & 0xff;
  const green = (tint >> 8) & 0xff;
  const blue = tint & 0xff;
  const canvasLike = (context as { canvas?: { width?: number; height?: number } }).canvas;
  const width = canvasLike?.width ?? SWORD_TEXTURE_WIDTH;
  const height = canvasLike?.height ?? SWORD_TEXTURE_HEIGHT;
  context.clearRect?.(0, 0, width, height);

  const strokeThickness = 6;
  for (let i = -strokeThickness; i <= strokeThickness; i += 1) {
    const alpha = Math.max(0.2, 0.9 - Math.abs(i) * 0.12);
    context.fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha.toFixed(2)})`;
    const offset = i * 3;
    context.fillRect?.(offset + width * -0.1, i + height / 4, width * 1.2, 2);
  }
}
