import type Phaser from 'phaser';
import type { Kirdy } from '../characters/Kirdy';
import type { Enemy } from '../enemies';

export type MatterGameObject = Phaser.GameObjects.GameObject & Partial<Phaser.Physics.Matter.Sprite>;

type MatterBody = {
  gameObject?: MatterGameObject;
  id?: number;
  [key: string]: unknown;
};

type CollisionPair = {
  bodyA: MatterBody;
  bodyB: MatterBody;
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

const ENEMY_COLLISION_MASK = PhysicsCategory.Player | PhysicsCategory.PlayerAttack | PhysicsCategory.Terrain;

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
  private readonly suspendedEnemies = new Map<MatterGameObject, Enemy>();
  private playerSprite?: MatterGameObject;

  constructor(private readonly scene: Phaser.Scene) {
    const world = this.scene.matter?.world;
    const width = this.scene.scale?.width ?? 800;
    const height = this.scene.scale?.height ?? 600;

    world?.setGravity?.(0, 1);
    world?.setBounds?.(0, 0, width, height);

    world?.on?.('collisionstart', this.handleCollisionStart);
    world?.on?.('collisionactive', this.handleCollisionActive);
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
    terrain.setFriction?.(0, 0, 0);
    terrain.setFrictionStatic?.(0);
    terrain.setCollisionCategory?.(PhysicsCategory.Terrain);
    terrain.setCollidesWith?.(PhysicsCategory.Player | PhysicsCategory.PlayerAttack | PhysicsCategory.Enemy);
    this.terrainObjects.add(terrain);
  }

  clearTerrain() {
    this.terrainObjects.clear();
    this.terrainContactIds.clear();
    this.playerSprite?.setData?.('isGrounded', false);
  }

  registerEnemy(enemy: Enemy) {
    const sprite = enemy.sprite as MatterGameObject;
    sprite.setCollisionCategory?.(PhysicsCategory.Enemy);
    sprite.setCollidesWith?.(ENEMY_COLLISION_MASK);
    this.enemyByObject.set(sprite, enemy);
    this.suspendedEnemies.delete(sprite);
    if (typeof sprite.once === 'function') {
      sprite.once('destroy', () => {
        this.enemyByObject.delete(sprite);
        this.suspendedEnemies.delete(sprite);
      });
    }
  }

  suspendEnemy(sprite: MatterGameObject) {
    const enemy = this.enemyByObject.get(sprite);
    if (!enemy) {
      return false;
    }

    this.enemyByObject.delete(sprite);
    this.suspendedEnemies.set(sprite, enemy);
    sprite.setCollidesWith?.(0);
    return true;
  }

  resumeEnemy(sprite: MatterGameObject) {
    const enemy = this.suspendedEnemies.get(sprite);
    if (!enemy) {
      return false;
    }

    this.suspendedEnemies.delete(sprite);
    this.enemyByObject.set(sprite, enemy);
    sprite.setCollidesWith?.(ENEMY_COLLISION_MASK);
    return true;
  }

  consumeEnemy(sprite: MatterGameObject) {
    this.enemyByObject.delete(sprite);
    this.suspendedEnemies.delete(sprite);
    sprite.setCollidesWith?.(0);
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

  private resolveGameObject(body?: MatterBody): MatterGameObject | undefined {
    let current: MatterBody | undefined = body;
    while (current) {
      const candidate = current.gameObject as MatterGameObject | undefined;
      if (candidate) {
        return candidate;
      }

      const parent = current.parent as MatterBody | undefined;
      if (!parent || parent === current) {
        break;
      }

      current = parent;
    }

    return undefined;
  }

  private handleCollisionStart = (event: CollisionEvent) => {
    event.pairs?.forEach((pair) => {
      this.handlePairCollision(pair);
    });
  };

  private handleCollisionActive = (event: CollisionEvent) => {
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
    const gameObjectA = this.resolveGameObject(pair.bodyA);
    const gameObjectB = this.resolveGameObject(pair.bodyB);
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
    const gameObjectA = this.resolveGameObject(pair.bodyA);
    const gameObjectB = this.resolveGameObject(pair.bodyB);
    if (!gameObjectA || !gameObjectB) {
      return;
    }

    this.handleTerrainSeparation(gameObjectA, pair.bodyA, gameObjectB, pair.bodyB);
    this.handleTerrainSeparation(gameObjectB, pair.bodyB, gameObjectA, pair.bodyA);
  }

  private handlePlayerTerrainContact(
    candidate: MatterGameObject,
    _candidateBody: MatterBody,
    other: MatterGameObject,
    otherBody: MatterBody,
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
    _candidateBody: MatterBody,
    other: MatterGameObject,
    otherBody: MatterBody,
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
    world?.off?.('collisionactive', this.handleCollisionActive);
    world?.off?.('collisionend', this.handleCollisionEnd);
    this.enemyByObject.clear();
    this.suspendedEnemies.clear();
    this.terrainObjects.clear();
    this.projectileData.clear();
    this.terrainContactIds.clear();
    this.playerSprite = undefined;
  }
}
