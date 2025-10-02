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
const ABILITY_PROJECTILE_DAMAGE = 2;

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
    onAcquire: ({ kirdy }) => {
      kirdy.sprite.setTint?.(hexToTint(abilityCatalogue.fire.color));
      kirdy.sprite.setTexture?.('kirdy', 'fire');
    },
    onRemove: ({ kirdy }) => {
      kirdy.sprite.clearTint?.();
      kirdy.sprite.setTexture?.('kirdy');
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
    onAcquire: ({ kirdy }) => {
      kirdy.sprite.setTint?.(hexToTint(abilityCatalogue.ice.color));
      kirdy.sprite.setTexture?.('kirdy', 'ice');
    },
    onRemove: ({ kirdy }) => {
      kirdy.sprite.clearTint?.();
      kirdy.sprite.setTexture?.('kirdy');
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
    onAcquire: ({ kirdy }) => {
      kirdy.sprite.setTint?.(hexToTint(abilityCatalogue.sword.color));
      kirdy.sprite.setTexture?.('kirdy', 'sword');
    },
    onRemove: ({ kirdy }) => {
      kirdy.sprite.clearTint?.();
      kirdy.sprite.setTexture?.('kirdy');
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
    context.kirdy.sprite.anims?.play?.(`kirdy-${ability.type}-attack`, true);
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
  return slash;
}

export function isAbilityType(value: string | undefined): value is AbilityType {
  return (ABILITY_TYPES as readonly string[]).includes(value ?? '');
}
