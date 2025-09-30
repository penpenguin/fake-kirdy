import Phaser from 'phaser';
import { createKirdy, type Kirdy } from '../characters/Kirdy';
import { InhaleSystem } from '../mechanics/InhaleSystem';
import { AbilitySystem } from '../mechanics/AbilitySystem';
import { SwallowSystem, type SwallowedPayload } from '../mechanics/SwallowSystem';
import {
  PlayerInputManager,
  type PlayerInputSnapshot,
  type PlayerAction,
  type InputButtonState,
} from '../input/PlayerInputManager';
import {
  createWabbleBee,
  createDrontoDurt,
  type Enemy,
  type EnemySpawn,
  type WabbleBeeOptions,
  type DrontoDurtOptions,
} from '../enemies';
import { PhysicsSystem } from '../physics/PhysicsSystem';
import { AreaManager } from '../world/AreaManager';
import { MapOverlay, createMapSummaries } from '../ui/MapOverlay';

export const SceneKeys = {
  Boot: 'BootScene',
  Menu: 'MenuScene',
  Game: 'GameScene',
  Pause: 'PauseScene',
} as const;

type SceneKey = (typeof SceneKeys)[keyof typeof SceneKeys];

function buildConfig(key: SceneKey) {
  return { key } satisfies Phaser.Types.Scenes.SettingsConfig;
}

export class BootScene extends Phaser.Scene {
  public static readonly KEY = SceneKeys.Boot;

  constructor() {
    super(buildConfig(SceneKeys.Boot));
  }

  preload() {
    this.load?.once?.('complete', () => {
      this.scene.start(SceneKeys.Menu);
    });

    this.load?.start?.();
  }

  create() {}
}

export class MenuScene extends Phaser.Scene {
  public static readonly KEY = SceneKeys.Menu;

  constructor() {
    super(buildConfig(SceneKeys.Menu));
  }

  create() {
    if (this.add?.text) {
      this.add.text(0, 0, 'Press Space or Tap to Start', {
        fontSize: '24px',
        color: '#ffffff',
      });
    }

    const startHandler = () => this.startGame();

    this.input?.keyboard?.once?.('keydown-SPACE', startHandler);
    this.input?.on?.('pointerdown', startHandler);
  }

  startGame() {
    this.scene.start(SceneKeys.Game);
  }
}

export class GameScene extends Phaser.Scene {
  public static readonly KEY = SceneKeys.Game;
  private kirdy?: Kirdy;
  private playerInput?: PlayerInputManager;
  private latestInput?: PlayerInputSnapshot;
  private inhaleSystem?: InhaleSystem;
  private swallowSystem?: SwallowSystem;
  private abilitySystem?: AbilitySystem;
  private enemies: Enemy[] = [];
  private readonly maxActiveEnemies = 3;
  private readonly enemyClusterLimit = 2;
  private readonly enemySafetyRadius = 96;
  private readonly enemySpawnCooldownMs = 1200;
  private enemySpawnCooldownRemaining = 0;
  private static readonly PLAYER_SPAWN = { x: 160, y: 360 } as const;
  private physicsSystem?: PhysicsSystem;
  private areaManager?: AreaManager;
  private mapOverlay?: MapOverlay;
  private mapToggleHandler?: () => void;
  private lastAreaSummaryHash?: string;

  constructor() {
    super(buildConfig(SceneKeys.Game));
  }

  create() {
    this.physicsSystem = new PhysicsSystem(this);
    this.areaManager = new AreaManager();
    this.mapOverlay = new MapOverlay(this);
    const spawn = this.areaManager.getCurrentAreaState().playerSpawnPosition ?? GameScene.PLAYER_SPAWN;
    const pauseHandler = () => this.pauseGame();
    this.input?.keyboard?.once?.('keydown-ESC', pauseHandler);
    this.mapToggleHandler = () => this.toggleMapOverlay();
    if (this.mapToggleHandler) {
      this.input?.keyboard?.on?.('keydown-M', this.mapToggleHandler);
    }

    this.kirdy = createKirdy(this, spawn);
    if (this.kirdy) {
      this.physicsSystem?.registerPlayer(this.kirdy);
    }
    this.playerInput = new PlayerInputManager(this);
    if (this.kirdy) {
      this.inhaleSystem = new InhaleSystem(this, this.kirdy);
      this.swallowSystem = new SwallowSystem(this, this.kirdy, this.inhaleSystem, this.physicsSystem);
      this.abilitySystem = new AbilitySystem(this, this.kirdy, this.physicsSystem);
    }

    this.events?.once?.('shutdown', () => {
      this.playerInput?.destroy();
      this.playerInput = undefined;
      this.latestInput = undefined;
      this.inhaleSystem = undefined;
      this.swallowSystem = undefined;
      this.abilitySystem = undefined;
      this.enemies = [];
      this.physicsSystem = undefined;
      this.areaManager = undefined;
      if (this.mapToggleHandler) {
        this.input?.keyboard?.off?.('keydown-M', this.mapToggleHandler);
        this.mapToggleHandler = undefined;
      }
      this.mapOverlay?.destroy();
      this.mapOverlay = undefined;
    });
  }

  pauseGame() {
    this.scene.launch(SceneKeys.Pause);
  }

  update(time: number, delta: number) {
    const snapshot = this.playerInput?.update();
    if (!snapshot) {
      return;
    }

    this.latestInput = snapshot;
    this.kirdy?.update?.(time, delta, snapshot.kirdy);
    this.inhaleSystem?.update(snapshot.actions);
    this.swallowSystem?.update(snapshot.actions);

    const payload = this.swallowSystem?.consumeSwallowedPayload();
    if (payload) {
      this.abilitySystem?.applySwallowedPayload(payload);
    }

    this.abilitySystem?.update(snapshot.actions);
    this.updateEnemies(delta);
    this.updateAreaState();
  }

  getPlayerInputSnapshot(): PlayerInputSnapshot | undefined {
    return this.latestInput;
  }

  getActionState(action: PlayerAction): InputButtonState | undefined {
    return this.latestInput?.actions[action];
  }

  addInhalableTarget(target: Phaser.Physics.Matter.Sprite) {
    this.inhaleSystem?.addInhalableTarget(target);
  }

  setInhalableTargets(targets: Phaser.Physics.Matter.Sprite[]) {
    this.inhaleSystem?.setInhalableTargets(targets);
  }

  consumeSwallowedPayload(): SwallowedPayload | undefined {
    const payload = this.swallowSystem?.consumeSwallowedPayload();
    if (payload) {
      this.abilitySystem?.applySwallowedPayload(payload);
    }

    return payload;
  }

  spawnWabbleBee(spawn: EnemySpawn, options: WabbleBeeOptions = {}) {
    if (!this.canSpawnEnemy()) {
      return undefined;
    }

    const enemy = createWabbleBee(this, spawn, this.withBoundPlayerPosition(options));
    return this.registerEnemy(enemy);
  }

  spawnDrontoDurt(spawn: EnemySpawn, options: DrontoDurtOptions = {}) {
    if (!this.canSpawnEnemy()) {
      return undefined;
    }

    const enemy = createDrontoDurt(this, spawn, this.withBoundPlayerPosition(options));
    return this.registerEnemy(enemy);
  }

  private registerEnemy<T extends Enemy>(enemy: T): T {
    this.enemies.push(enemy);
    this.inhaleSystem?.addInhalableTarget(enemy.sprite);
    this.beginEnemySpawnCooldown();
    this.physicsSystem?.registerEnemy(enemy);
    return enemy;
  }

  private updateEnemies(delta: number) {
    this.tickEnemySpawnCooldown(delta);

    if (this.enemies.length === 0) {
      return;
    }

    this.enemies.forEach((enemy) => {
      if (!enemy.isDefeated()) {
        enemy.update(delta);
      }
    });

    const activeEnemies = this.getActiveEnemies();
    if (activeEnemies.length !== this.enemies.length) {
      this.enemies = activeEnemies;
      this.inhaleSystem?.setInhalableTargets(activeEnemies.map((enemy) => enemy.sprite));
    }

    this.enforceEnemyDensity();
  }

  private updateAreaState() {
    if (!this.areaManager || !this.kirdy) {
      return;
    }

    const playerPosition = this.getPlayerPosition();
    if (!playerPosition) {
      return;
    }

    const result = this.areaManager.updatePlayerPosition(playerPosition);
    if (!result.areaChanged || !result.transition) {
      return;
    }

    const { entryPosition } = result.transition;
    this.kirdy.sprite.setPosition?.(entryPosition.x, entryPosition.y);
    this.kirdy.sprite.setVelocity?.(0, 0);

    if (this.mapOverlay?.isVisible()) {
      this.refreshMapOverlay();
    }
  }

  private canSpawnEnemy() {
    if (this.enemySpawnCooldownRemaining > 0) {
      return false;
    }

    return this.getActiveEnemies().length < this.maxActiveEnemies;
  }

  private getActiveEnemies() {
    return this.enemies.filter((enemy) => !enemy.isDefeated());
  }

  private beginEnemySpawnCooldown() {
    this.enemySpawnCooldownRemaining = this.enemySpawnCooldownMs;
  }

  private tickEnemySpawnCooldown(delta: number) {
    if (this.enemySpawnCooldownRemaining <= 0) {
      return;
    }

    this.enemySpawnCooldownRemaining = Math.max(0, this.enemySpawnCooldownRemaining - delta);
  }

  private enforceEnemyDensity() {
    const playerPosition = this.getPlayerPosition();
    if (!playerPosition) {
      return;
    }

    const activeEnemies = this.getActiveEnemies();
    if (activeEnemies.length <= this.enemyClusterLimit) {
      return;
    }

    const safetyRadiusSq = this.enemySafetyRadius * this.enemySafetyRadius;
    const nearbyEnemies = activeEnemies
      .map((enemy) => ({ enemy, position: this.getEnemyPosition(enemy) }))
      .map((entry) => ({
        ...entry,
        distanceSq: this.getDistanceSquared(entry.position, playerPosition),
      }))
      .filter((entry) => entry.distanceSq <= safetyRadiusSq);

    if (nearbyEnemies.length <= this.enemyClusterLimit) {
      return;
    }

    nearbyEnemies.sort((a, b) => a.distanceSq - b.distanceSq);
    const overflow = nearbyEnemies.slice(this.enemyClusterLimit);

    overflow.forEach((entry, index) => {
      this.disperseEnemy(entry.enemy, playerPosition, index, overflow.length);
    });
  }

  private getEnemyPosition(enemy: Enemy) {
    const sprite = enemy.sprite;
    return {
      x: sprite.x ?? sprite.body?.position?.x ?? 0,
      y: sprite.y ?? sprite.body?.position?.y ?? 0,
    };
  }

  private getDistanceSquared(a: { x: number; y: number }, b: { x: number; y: number }) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
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

    const newX = origin.x + normalizedX * this.enemySafetyRadius;
    const newY = origin.y + normalizedY * this.enemySafetyRadius;

    enemy.sprite.setPosition?.(newX, newY);
  }

  private withBoundPlayerPosition<T extends { getPlayerPosition?: () => { x: number; y: number } | undefined }>(
    options: T,
  ): T {
    if (options.getPlayerPosition) {
      return options;
    }

    return {
      ...options,
      getPlayerPosition: () => this.getPlayerPosition(),
    };
  }

  private getPlayerPosition() {
    const sprite = this.kirdy?.sprite;
    if (!sprite) {
      return undefined;
    }

    return {
      x: sprite.x ?? sprite.body?.position?.x ?? 0,
      y: sprite.y ?? sprite.body?.position?.y ?? 0,
    };
  }

  private toggleMapOverlay() {
    if (!this.mapOverlay || !this.areaManager) {
      return;
    }

    if (this.mapOverlay.isVisible()) {
      this.mapOverlay.hide();
      return;
    }

    this.refreshMapOverlay();
    this.mapOverlay.show();
  }

  private refreshMapOverlay() {
    if (!this.mapOverlay || !this.areaManager) {
      return;
    }

    const metadata = this.areaManager.getAllAreaMetadata();
    const discovered = this.areaManager.getDiscoveredAreas();
    const currentAreaId = this.areaManager.getCurrentAreaState().definition.id;

    const summaries = createMapSummaries(metadata, discovered, currentAreaId, (areaId) =>
      this.areaManager!.getExplorationState(areaId),
    );

    const hash = JSON.stringify(summaries.map((entry) => ({
      id: entry.id,
      discovered: entry.discovered,
      completion: entry.exploration.completion,
      isCurrent: entry.isCurrent,
    })));

    if (hash === this.lastAreaSummaryHash) {
      return;
    }

    this.mapOverlay.update(summaries);
    this.lastAreaSummaryHash = hash;
  }
}

export class PauseScene extends Phaser.Scene {
  public static readonly KEY = SceneKeys.Pause;

  constructor() {
    super(buildConfig(SceneKeys.Pause));
  }

  create() {
    const resumeHandler = () => this.resumeGame();

    this.input?.keyboard?.once?.('keydown-ESC', resumeHandler);
    this.input?.once?.('pointerdown', resumeHandler);

    if (this.add?.text) {
      this.add.text(0, 0, 'Paused - Press ESC or Tap to Resume', {
        fontSize: '24px',
        color: '#ffffff',
      });
    }
  }

  resumeGame() {
    this.scene.stop(SceneKeys.Pause);
    this.scene.resume(SceneKeys.Game);
  }
}

export const coreScenes = [BootScene, MenuScene, GameScene, PauseScene];
