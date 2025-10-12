import type Phaser from 'phaser';
import { createDrontoDurt, createWabbleBee } from './index';
import type { DrontoDurtOptions, Enemy, EnemySpawn, WabbleBeeOptions } from './index';

type Bounds = { left: number; right: number; top: number; bottom: number };

type PlayerPosition = { x: number; y: number } | undefined;

type PlayerPositionProvider = () => PlayerPosition;

type CullingBoundsProvider = () => Bounds | undefined;

type InhaleSystemBridge = Pick<
  import('../mechanics/InhaleSystem').InhaleSystem,
  'addInhalableTarget' | 'setInhalableTargets'
>;

type PhysicsSystemBridge = Pick<import('../physics/PhysicsSystem').PhysicsSystem, 'registerEnemy'>;

interface EnemyManagerConfig {
  maxActiveEnemies: number;
  enemyClusterLimit: number;
  enemySafetyRadius: number;
  enemySpawnCooldownMs: number;
  enemyDisperseCooldownMs: number;
}

interface EnemyManagerOptions {
  scene: Phaser.Scene;
  inhaleSystem: InhaleSystemBridge;
  physicsSystem: PhysicsSystemBridge;
  getPlayerPosition: PlayerPositionProvider;
  getCullingBounds: CullingBoundsProvider;
  config?: Partial<EnemyManagerConfig>;
}

const DEFAULT_CONFIG: EnemyManagerConfig = {
  maxActiveEnemies: 3,
  enemyClusterLimit: 2,
  enemySafetyRadius: 96,
  enemySpawnCooldownMs: 1200,
  enemyDisperseCooldownMs: 400,
};

export class EnemyManager {
  private readonly scene: Phaser.Scene;
  private readonly inhaleSystem: InhaleSystemBridge;
  private readonly physicsSystem: PhysicsSystemBridge;
  private readonly getPlayerPositionRef: PlayerPositionProvider;
  private readonly getCullingBoundsRef: CullingBoundsProvider;
  private readonly maxActiveEnemies: number;
  private readonly enemyClusterLimit: number;
  private readonly enemySafetyRadius: number;
  private readonly enemySpawnCooldownMs: number;
  private readonly enemyDisperseCooldownMs: number;
  private enemies: Enemy[] = [];
  private enemySpawnCooldownRemaining = 0;
  private readonly enemyDisperseCooldowns = new Map<Enemy, number>();

  constructor(options: EnemyManagerOptions) {
    this.scene = options.scene;
    this.inhaleSystem = options.inhaleSystem;
    this.physicsSystem = options.physicsSystem;
    this.getPlayerPositionRef = options.getPlayerPosition;
    this.getCullingBoundsRef = options.getCullingBounds;

    const config = { ...DEFAULT_CONFIG, ...(options.config ?? {}) };
    this.maxActiveEnemies = Math.max(1, config.maxActiveEnemies);
    this.enemyClusterLimit = Math.max(0, Math.min(this.maxActiveEnemies, config.enemyClusterLimit));
    this.enemySafetyRadius = Math.max(1, config.enemySafetyRadius);
    this.enemySpawnCooldownMs = Math.max(0, config.enemySpawnCooldownMs);
    this.enemyDisperseCooldownMs = Math.max(0, config.enemyDisperseCooldownMs);
  }

  spawnWabbleBee(spawn: EnemySpawn, options: WabbleBeeOptions = {}) {
    if (!this.canSpawnEnemy()) {
      return undefined;
    }

    const enemy = createWabbleBee(this.scene, spawn, this.withPlayerPosition(options));
    return this.registerEnemy(enemy);
  }

  spawnDrontoDurt(spawn: EnemySpawn, options: DrontoDurtOptions = {}) {
    if (!this.canSpawnEnemy()) {
      return undefined;
    }

    const enemy = createDrontoDurt(this.scene, spawn, this.withPlayerPosition(options));
    return this.registerEnemy(enemy);
  }

  update(delta: number) {
    this.tickEnemySpawnCooldown(delta);
    this.tickEnemyDisperseCooldowns(delta);

    if (this.enemies.length === 0) {
      return;
    }

    const bounds = this.getCullingBoundsRef();

    this.enemies.forEach((enemy) => {
      if (enemy.isDefeated()) {
        return;
      }

      const position = this.getEnemyPosition(enemy);
      const inView = bounds ? this.isWithinBounds(position, bounds) : true;

      enemy.sprite.setActive?.(inView);
      enemy.sprite.setVisible?.(inView);

      if (inView) {
        enemy.update(delta);
      }
    });

    const activeEnemies = this.getActiveEnemies();
    if (activeEnemies.length !== this.enemies.length) {
      this.inhaleSystem.setInhalableTargets(activeEnemies.map((enemy) => enemy.sprite));
    }

    this.enemies = activeEnemies;
    if (this.enemyDisperseCooldowns.size > 0) {
      const activeSet = new Set(activeEnemies);
      for (const enemy of Array.from(this.enemyDisperseCooldowns.keys())) {
        if (!activeSet.has(enemy)) {
          this.enemyDisperseCooldowns.delete(enemy);
        }
      }
    }
    this.enforceEnemyDensity(activeEnemies);
  }

  destroy() {
    this.enemies.forEach((enemy) => {
      enemy.sprite.destroy?.();
    });
    this.enemies = [];
    this.enemySpawnCooldownRemaining = 0;
    this.inhaleSystem.setInhalableTargets([]);
    this.enemyDisperseCooldowns.clear();
  }

  resetSpawnCooldown() {
    this.enemySpawnCooldownRemaining = 0;
  }

  getActiveEnemyCount() {
    return this.enemies.reduce((count, enemy) => (enemy.isDefeated() ? count : count + 1), 0);
  }

  private canSpawnEnemy() {
    if (this.enemySpawnCooldownRemaining > 0) {
      return false;
    }

    return this.getActiveEnemies().length < this.maxActiveEnemies;
  }

  private registerEnemy<T extends Enemy>(enemy: T): T {
    this.enemies.push(enemy);
    this.inhaleSystem.addInhalableTarget(enemy.sprite);
    this.physicsSystem.registerEnemy(enemy);
    this.beginEnemySpawnCooldown();
    return enemy;
  }

  private beginEnemySpawnCooldown() {
    this.enemySpawnCooldownRemaining = this.enemySpawnCooldownMs;
  }

  private tickEnemySpawnCooldown(delta: number) {
    if (!Number.isFinite(delta) || delta <= 0) {
      return;
    }

    this.enemySpawnCooldownRemaining = Math.max(0, this.enemySpawnCooldownRemaining - delta);
  }

  private tickEnemyDisperseCooldowns(delta: number) {
    if (!Number.isFinite(delta) || delta <= 0 || this.enemyDisperseCooldowns.size === 0) {
      return;
    }

    for (const [enemy, remaining] of Array.from(this.enemyDisperseCooldowns.entries())) {
      const next = Math.max(0, remaining - delta);
      if (next <= 0) {
        this.enemyDisperseCooldowns.delete(enemy);
      } else {
        this.enemyDisperseCooldowns.set(enemy, next);
      }
    }
  }

  private getActiveEnemies() {
    return this.enemies.filter((enemy) => !enemy.isDefeated());
  }

  private enforceEnemyDensity(activeEnemies: Enemy[]) {
    if (activeEnemies.length <= this.enemyClusterLimit) {
      return;
    }

    const playerPosition = this.getPlayerPosition();
    if (!playerPosition) {
      return;
    }

    const safetyRadiusSq = this.enemySafetyRadius * this.enemySafetyRadius;
    const nearbyEnemies = activeEnemies
      .map((enemy) => ({ enemy, position: this.getEnemyPosition(enemy) }))
      .map((entry) => ({
        ...entry,
        distanceSq: this.getDistanceSquared(entry.position, playerPosition),
      }))
      .filter((entry) => entry.distanceSq < safetyRadiusSq);

    if (nearbyEnemies.length <= this.enemyClusterLimit) {
      return;
    }

    nearbyEnemies.sort((a, b) => a.distanceSq - b.distanceSq);
    const overflow = nearbyEnemies.slice(this.enemyClusterLimit);
    const dispersible = overflow.filter((entry) => !this.enemyDisperseCooldowns.has(entry.enemy));
    dispersible.forEach((entry, index) => {
      this.disperseEnemy(entry.enemy, playerPosition, index, dispersible.length);
    });
  }

  private disperseEnemy(enemy: Enemy, origin: { x: number; y: number }, index: number, total: number) {
    const directions = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
      { x: Math.SQRT1_2, y: Math.SQRT1_2 },
      { x: -Math.SQRT1_2, y: Math.SQRT1_2 },
      { x: Math.SQRT1_2, y: -Math.SQRT1_2 },
      { x: -Math.SQRT1_2, y: -Math.SQRT1_2 },
    ];

    const direction = directions[index % directions.length];
    const angleFallback = (index / Math.max(1, total)) * Math.PI * 2;
    const dx = direction?.x ?? Math.cos(angleFallback);
    const dy = direction?.y ?? Math.sin(angleFallback);

    const length = Math.hypot(dx, dy) || 1;
    const normalizedX = dx / length;
    const normalizedY = dy / length;

    const pushDistance = this.enemySafetyRadius + 8;
    const newX = origin.x + normalizedX * pushDistance;
    const newY = origin.y + normalizedY * pushDistance;

    enemy.sprite.setVelocity?.(0, 0);
    if (this.enemyDisperseCooldownMs > 0) {
      this.enemyDisperseCooldowns.set(enemy, this.enemyDisperseCooldownMs);
    }
    enemy.onDisperse?.({ x: newX, y: newY });
  }

  private getEnemyPosition(enemy: Enemy) {
    const sprite = enemy.sprite;
    return {
      x: sprite.x ?? sprite.body?.position?.x ?? 0,
      y: sprite.y ?? sprite.body?.position?.y ?? 0,
    };
  }

  private isWithinBounds(position: { x: number; y: number }, bounds: Bounds) {
    return position.x >= bounds.left && position.x <= bounds.right && position.y >= bounds.top && position.y <= bounds.bottom;
  }

  private getDistanceSquared(a: { x: number; y: number }, b: { x: number; y: number }) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  }

  private withPlayerPosition<T extends { getPlayerPosition?: PlayerPositionProvider }>(options: T): T {
    if (options.getPlayerPosition) {
      return options;
    }

    return {
      ...options,
      getPlayerPosition: () => this.getPlayerPosition(),
    } as T;
  }

  private getPlayerPosition(): PlayerPosition {
    const result = this.getPlayerPositionRef?.();
    if (!result) {
      return undefined;
    }

    const { x, y } = result;
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return undefined;
    }

    return { x, y };
  }
}
