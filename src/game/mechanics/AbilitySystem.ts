import type Phaser from 'phaser';
import type { Kirdy } from '../characters/Kirdy';
import type { ActionStateMap } from './InhaleSystem';
import type { SwallowedPayload } from './SwallowSystem';
import type { PhysicsSystem } from '../physics/PhysicsSystem';

export const ABILITY_TYPES = ['fire', 'ice', 'sword'] as const;
export type AbilityType = (typeof ABILITY_TYPES)[number];

type AbilityContext = {
  scene: Phaser.Scene;
  kirdy: Kirdy;
  physicsSystem?: PhysicsSystem;
};

type AbilityDefinition = {
  type: AbilityType;
  onAcquire?: (context: AbilityContext) => void;
  onRemove?: (context: AbilityContext) => void;
  performAttack?: (context: AbilityContext) => void;
};

const FIRE_PROJECTILE_SPEED = 420;
const FIRE_PROJECTILE_LIFETIME = 700;
const ICE_PROJECTILE_SPEED = 300;
const ICE_PROJECTILE_LIFETIME = 900;
const SWORD_SLASH_LIFETIME = 200;
const ABILITY_PROJECTILE_DAMAGE = 2;

const abilityDefinitions: Record<AbilityType, AbilityDefinition> = {
  fire: {
    type: 'fire',
    onAcquire: ({ kirdy }) => {
      kirdy.sprite.setTint?.(0xff7b4a);
      kirdy.sprite.setTexture?.('kirdy', 'fire');
    },
    onRemove: ({ kirdy }) => {
      kirdy.sprite.clearTint?.();
      kirdy.sprite.setTexture?.('kirdy');
    },
    performAttack: ({ scene, kirdy, physicsSystem }) => {
      const projectile = spawnProjectile({ scene, kirdy }, 'fire-attack');
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
      physicsSystem?.registerPlayerAttack(projectile, { damage: ABILITY_PROJECTILE_DAMAGE });
      scene.sound?.play?.('ability-fire-attack');
    },
  },
  ice: {
    type: 'ice',
    onAcquire: ({ kirdy }) => {
      kirdy.sprite.setTint?.(0x9fd8ff);
      kirdy.sprite.setTexture?.('kirdy', 'ice');
    },
    onRemove: ({ kirdy }) => {
      kirdy.sprite.clearTint?.();
      kirdy.sprite.setTexture?.('kirdy');
    },
    performAttack: ({ scene, kirdy, physicsSystem }) => {
      const projectile = spawnProjectile({ scene, kirdy }, 'ice-attack');
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
      physicsSystem?.registerPlayerAttack(projectile, { damage: ABILITY_PROJECTILE_DAMAGE });
      scene.sound?.play?.('ability-ice-attack');
    },
  },
  sword: {
    type: 'sword',
    onAcquire: ({ kirdy }) => {
      kirdy.sprite.setTint?.(0xe9e48d);
      kirdy.sprite.setTexture?.('kirdy', 'sword');
    },
    onRemove: ({ kirdy }) => {
      kirdy.sprite.clearTint?.();
      kirdy.sprite.setTexture?.('kirdy');
    },
    performAttack: ({ scene, kirdy, physicsSystem }) => {
      const slash = spawnSlash({ scene, kirdy }, 'sword-slash');
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
      physicsSystem?.registerPlayerAttack(slash, { damage: ABILITY_PROJECTILE_DAMAGE });
      scene.sound?.play?.('ability-sword-attack');
    },
  },
};

export class AbilitySystem {
  private currentAbility?: AbilityDefinition;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly kirdy: Kirdy,
    private readonly physicsSystem?: PhysicsSystem,
  ) {}

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
      this.currentAbility.performAttack?.({ scene: this.scene, kirdy: this.kirdy, physicsSystem: this.physicsSystem });
      this.kirdy.sprite.anims?.play?.(`kirdy-${this.currentAbility.type}-attack`, true);
    }
  }

  applySwallowedPayload(payload?: SwallowedPayload) {
    const abilityType = payload?.abilityType as AbilityType | undefined;
    if (!abilityType) {
      return;
    }

    const definition = abilityDefinitions[abilityType];
    if (!definition) {
      return;
    }

    if (this.currentAbility?.type === abilityType) {
      definition.onAcquire?.({ scene: this.scene, kirdy: this.kirdy, physicsSystem: this.physicsSystem });
      this.kirdy.sprite.setData?.('equippedAbility', abilityType);
      this.scene.events?.emit?.('ability-acquired', { abilityType });
      return;
    }

    this.clearAbility();
    this.currentAbility = definition;
    definition.onAcquire?.({ scene: this.scene, kirdy: this.kirdy, physicsSystem: this.physicsSystem });
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

    this.currentAbility.onRemove?.({ scene: this.scene, kirdy: this.kirdy, physicsSystem: this.physicsSystem });
    this.kirdy.sprite.setData?.('equippedAbility', undefined);
    this.scene.events?.emit?.('ability-cleared', {});
    this.currentAbility = undefined;
  }
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
