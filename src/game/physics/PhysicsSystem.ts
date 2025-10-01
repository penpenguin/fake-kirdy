import type Phaser from 'phaser';
import type MatterJS from 'matter-js';
import type { Kirdy } from '../characters/Kirdy';
import type { Enemy } from '../enemies';

type MatterGameObject = Phaser.GameObjects.GameObject & Partial<Phaser.Physics.Matter.Sprite>;

type CollisionPair = {
  bodyA: MatterJS.BodyType & { gameObject?: MatterGameObject };
  bodyB: MatterJS.BodyType & { gameObject?: MatterGameObject };
  isSensor?: boolean;
};

type CollisionEvent = {
  pairs?: CollisionPair[];
};

export const PhysicsCategory = {
  Player: 0x0001,
  Terrain: 0x0002,
  Enemy: 0x0004,
  PlayerAttack: 0x0008,
  EnemyAttack: 0x0010,
} as const;

type PlayerAttackOptions = {
  damage?: number;
  recycle?: (projectile: MatterGameObject) => boolean | void;
};

type ProjectileMetadata = {
  damage: number;
  recycle?: (projectile: MatterGameObject) => boolean | void;
};

export class PhysicsSystem {
  private readonly enemyByObject = new Map<MatterGameObject, Enemy>();
  private readonly terrainObjects = new Set<MatterGameObject>();
  private readonly projectileData = new Map<MatterGameObject, ProjectileMetadata>();
  private readonly terrainContactIds = new Set<number>();
  private playerSprite?: MatterGameObject;

  constructor(private readonly scene: Phaser.Scene) {
    const world = this.scene.matter?.world;
    const width = this.scene.scale?.width ?? 800;
    const height = this.scene.scale?.height ?? 600;

    world?.setGravity?.(0, 1);
    world?.setBounds?.(0, 0, width, height);

    world?.on?.('collisionstart', this.handleCollisionStart);
    world?.on?.('collisionend', this.handleCollisionEnd);

    this.scene.events?.once?.('shutdown', () => this.teardown());
  }

  registerPlayer(kirdy: Kirdy) {
    const sprite = kirdy.sprite as MatterGameObject;
    this.playerSprite = sprite;
    sprite.setCollisionCategory?.(PhysicsCategory.Player);
    sprite.setCollidesWith?.(PhysicsCategory.Terrain | PhysicsCategory.Enemy | PhysicsCategory.EnemyAttack);
    sprite.setData?.('isGrounded', false);
  }

  registerTerrain(terrain: MatterGameObject) {
    terrain.setStatic?.(true);
    terrain.setCollisionCategory?.(PhysicsCategory.Terrain);
    terrain.setCollidesWith?.(PhysicsCategory.Player | PhysicsCategory.PlayerAttack | PhysicsCategory.Enemy);
    this.terrainObjects.add(terrain);
  }

  registerEnemy(enemy: Enemy) {
    const sprite = enemy.sprite as MatterGameObject;
    sprite.setCollisionCategory?.(PhysicsCategory.Enemy);
    sprite.setCollidesWith?.(PhysicsCategory.Player | PhysicsCategory.PlayerAttack);
    this.enemyByObject.set(sprite, enemy);
  }

  registerPlayerAttack(projectile: MatterGameObject, options: PlayerAttackOptions = {}) {
    const damage = Math.max(0, Math.floor(options.damage ?? 1));
    projectile.setCollisionCategory?.(PhysicsCategory.PlayerAttack);
    projectile.setCollidesWith?.(PhysicsCategory.Enemy | PhysicsCategory.Terrain);
    const recycle = typeof options.recycle === 'function' ? options.recycle : undefined;
    this.projectileData.set(projectile, { damage, recycle });
    projectile.once?.('destroy', () => {
      this.projectileData.delete(projectile);
    });
  }

  destroyProjectile(projectile: MatterGameObject) {
    const metadata = this.projectileData.get(projectile);
    if (metadata) {
      this.projectileData.delete(projectile);
      if (metadata.recycle) {
        const handled = metadata.recycle(projectile);
        if (handled) {
          return;
        }
      }
    }

    projectile.destroy?.();
  }

  private handleCollisionStart = (event: CollisionEvent) => {
    event.pairs?.forEach((pair) => {
      this.handlePairCollision(pair);
    });
  };

  private handleCollisionEnd = (event: CollisionEvent) => {
    event.pairs?.forEach((pair) => {
      this.handlePairSeparation(pair);
    });
  };

  private handlePairCollision(pair: CollisionPair) {
    const gameObjectA = pair.bodyA?.gameObject;
    const gameObjectB = pair.bodyB?.gameObject;
    if (!gameObjectA || !gameObjectB) {
      return;
    }

    if (!pair.isSensor) {
      this.handlePlayerTerrainContact(gameObjectA, pair.bodyA, gameObjectB, pair.bodyB);
      this.handlePlayerTerrainContact(gameObjectB, pair.bodyB, gameObjectA, pair.bodyA);
    }

    this.handlePlayerEnemyCollision(gameObjectA, gameObjectB);
    this.handlePlayerEnemyCollision(gameObjectB, gameObjectA);

    this.handleProjectileCollision(gameObjectA, gameObjectB);
    this.handleProjectileCollision(gameObjectB, gameObjectA);
  }

  private handlePairSeparation(pair: CollisionPair) {
    const gameObjectA = pair.bodyA?.gameObject;
    const gameObjectB = pair.bodyB?.gameObject;
    if (!gameObjectA || !gameObjectB) {
      return;
    }

    this.handleTerrainSeparation(gameObjectA, pair.bodyA, gameObjectB, pair.bodyB);
    this.handleTerrainSeparation(gameObjectB, pair.bodyB, gameObjectA, pair.bodyA);
  }

  private handlePlayerTerrainContact(
    candidate: MatterGameObject,
    _candidateBody: MatterJS.BodyType,
    other: MatterGameObject,
    otherBody: MatterJS.BodyType,
  ) {
    if (!this.playerSprite || candidate !== this.playerSprite) {
      return;
    }

    if (!this.terrainObjects.has(other)) {
      return;
    }

    if (typeof otherBody?.id !== 'number') {
      return;
    }

    this.terrainContactIds.add(otherBody.id);
    this.playerSprite.setData?.('isGrounded', true);
  }

  private handleTerrainSeparation(
    candidate: MatterGameObject,
    _candidateBody: MatterJS.BodyType,
    other: MatterGameObject,
    otherBody: MatterJS.BodyType,
  ) {
    if (!this.playerSprite || candidate !== this.playerSprite) {
      return;
    }

    if (!this.terrainObjects.has(other)) {
      return;
    }

    if (typeof otherBody?.id !== 'number') {
      return;
    }

    this.terrainContactIds.delete(otherBody.id);
    if (this.terrainContactIds.size === 0) {
      this.playerSprite.setData?.('isGrounded', false);
    }
  }

  private handlePlayerEnemyCollision(subject: MatterGameObject, other: MatterGameObject) {
    if (!this.playerSprite || subject !== this.playerSprite) {
      return;
    }

    const enemy = this.enemyByObject.get(other);
    if (!enemy) {
      return;
    }

    this.scene.events?.emit?.('player-collided-with-enemy', { enemy });
  }

  private handleProjectileCollision(projectileObject: MatterGameObject, targetObject: MatterGameObject) {
    const projectileInfo = this.projectileData.get(projectileObject);
    if (!projectileInfo) {
      return;
    }

    const enemy = this.enemyByObject.get(targetObject);
    if (enemy && !enemy.isDefeated()) {
      if (projectileInfo.damage > 0) {
        enemy.takeDamage(projectileInfo.damage);
      }
      this.scene.events?.emit?.('player-attack-hit-enemy', { enemy, damage: projectileInfo.damage });
    }

    this.destroyProjectile(projectileObject);
  }

  private teardown() {
    const world = this.scene.matter?.world;
    world?.off?.('collisionstart', this.handleCollisionStart);
    world?.off?.('collisionend', this.handleCollisionEnd);
    this.enemyByObject.clear();
    this.terrainObjects.clear();
    this.projectileData.clear();
    this.terrainContactIds.clear();
    this.playerSprite = undefined;
  }
}
