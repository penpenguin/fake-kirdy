import Phaser from 'phaser';
import { createKirdy, type Kirdy } from '../characters/Kirdy';
import { InhaleSystem } from '../mechanics/InhaleSystem';
import { AbilitySystem, type AbilityType } from '../mechanics/AbilitySystem';
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
import { Hud } from '../ui/Hud';

export const SceneKeys = {
  Boot: 'BootScene',
  Menu: 'MenuScene',
  Game: 'GameScene',
  Pause: 'PauseScene',
  GameOver: 'GameOverScene',
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
  private hud?: Hud;
  private readonly playerMaxHP = 6;
  private playerHP = this.playerMaxHP;
  private playerScore = 0;
  private currentAbility?: AbilityType;
  private readonly scorePerEnemy = 100;
  private isGameOver = false;

  constructor() {
    super(buildConfig(SceneKeys.Game));
  }

  private readonly handleAbilityAcquired = (event: { abilityType?: AbilityType }) => {
    if (!event?.abilityType) {
      return;
    }

    this.currentAbility = event.abilityType;
    this.hud?.updateAbility(event.abilityType);
  };

  private readonly handleAbilityCleared = () => {
    this.currentAbility = undefined;
    this.hud?.updateAbility(undefined);
  };

  private readonly handleEnemyDefeated = () => {
    this.playerScore += this.scorePerEnemy;
    this.hud?.updateScore(this.playerScore);
  };

  private readonly handlePlayerDefeated = () => {
    if (this.isGameOver) {
      return;
    }

    this.isGameOver = true;
    this.scene.pause(SceneKeys.Game);
    this.scene.launch(SceneKeys.GameOver, {
      score: this.playerScore,
      ability: this.currentAbility,
      maxHP: this.playerMaxHP,
    });
  };

  public damagePlayer(amount: number) {
    if (!Number.isFinite(amount)) {
      return;
    }

    const normalized = Math.max(0, Math.floor(amount));
    if (normalized <= 0) {
      return;
    }

    const previous = this.playerHP;
    this.playerHP = Math.max(0, this.playerHP - normalized);

    if (this.playerHP === previous) {
      return;
    }

    this.hud?.updateHP({ current: this.playerHP, max: this.playerMaxHP });

    if (this.playerHP <= 0) {
      this.handlePlayerDefeated();
    }
  }

  create() {
    this.playerHP = this.playerMaxHP;
    this.playerScore = 0;
    this.currentAbility = undefined;
    this.isGameOver = false;
    this.physicsSystem = new PhysicsSystem(this);
    this.areaManager = new AreaManager();
    this.mapOverlay = new MapOverlay(this);
    this.hud = new Hud(this);
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

    this.events?.on?.('ability-acquired', this.handleAbilityAcquired, this);
    this.events?.on?.('ability-cleared', this.handleAbilityCleared, this);
    this.events?.on?.('enemy-defeated', this.handleEnemyDefeated, this);

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
      this.events?.off?.('ability-acquired', this.handleAbilityAcquired, this);
      this.events?.off?.('ability-cleared', this.handleAbilityCleared, this);
      this.events?.off?.('enemy-defeated', this.handleEnemyDefeated, this);
      this.hud?.destroy();
      this.hud = undefined;
      this.playerHP = this.playerMaxHP;
      this.playerScore = 0;
      this.currentAbility = undefined;
      this.isGameOver = false;
    });

    this.hud?.updateHP({ current: this.playerHP, max: this.playerMaxHP });
    this.hud?.updateAbility(undefined);
    this.hud?.updateScore(this.playerScore);
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

    if (result.areaChanged && result.transition) {
      const { entryPosition } = result.transition;
      this.kirdy.sprite.setPosition?.(entryPosition.x, entryPosition.y);
      this.kirdy.sprite.setVelocity?.(0, 0);
    }

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
    const restartHandler = () => this.restartGame();
    const quitHandler = () => this.quitToMenu();

    this.input?.keyboard?.once?.('keydown-ESC', resumeHandler);
    this.input?.keyboard?.once?.('keydown-R', restartHandler);
    this.input?.keyboard?.once?.('keydown-Q', quitHandler);
    this.input?.once?.('pointerdown', resumeHandler);

    if (this.add?.text) {
      const style: Phaser.Types.GameObjects.Text.TextStyle = {
        fontSize: '24px',
        color: '#ffffff',
        align: 'center',
      };

      const submenuStyle: Phaser.Types.GameObjects.Text.TextStyle = {
        fontSize: '18px',
        color: '#ffe4f2',
      };

      const title = this.add.text(0, -60, 'Game Paused', style);
      title.setOrigin?.(0.5, 0.5);
      title.setScrollFactor?.(0, 0);
      title.setDepth?.(2000);

      const resumeOption = this.add.text(0, -10, 'Resume (ESC)', submenuStyle);
      resumeOption.setOrigin?.(0.5, 0.5);
      resumeOption.setScrollFactor?.(0, 0);
      resumeOption.setDepth?.(2000);
      resumeOption.setInteractive?.({ useHandCursor: true });
      resumeOption.on?.('pointerdown', resumeHandler);

      const restartOption = this.add.text(0, 30, 'Restart (R)', submenuStyle);
      restartOption.setOrigin?.(0.5, 0.5);
      restartOption.setScrollFactor?.(0, 0);
      restartOption.setDepth?.(2000);
      restartOption.setInteractive?.({ useHandCursor: true });
      restartOption.on?.('pointerdown', restartHandler);

      const quitOption = this.add.text(0, 70, 'Quit to Menu (Q)', submenuStyle);
      quitOption.setOrigin?.(0.5, 0.5);
      quitOption.setScrollFactor?.(0, 0);
      quitOption.setDepth?.(2000);
      quitOption.setInteractive?.({ useHandCursor: true });
      quitOption.on?.('pointerdown', quitHandler);
    }
  }

  resumeGame() {
    this.scene.stop(SceneKeys.Pause);
    this.scene.resume(SceneKeys.Game);
  }

  restartGame() {
    this.scene.stop(SceneKeys.Pause);
    this.scene.stop(SceneKeys.Game);
    this.scene.start(SceneKeys.Game);
  }

  quitToMenu() {
    this.scene.stop(SceneKeys.Pause);
    this.scene.stop(SceneKeys.Game);
    this.scene.start(SceneKeys.Menu);
  }
}

interface GameOverData {
  score?: number;
  ability?: AbilityType;
  maxHP?: number;
}

export class GameOverScene extends Phaser.Scene {
  public static readonly KEY = SceneKeys.GameOver;
  private finalScore = 0;
  private finalAbility?: AbilityType;

  constructor() {
    super(buildConfig(SceneKeys.GameOver));
  }

  create(data?: GameOverData) {
    this.finalScore = Math.max(0, Math.floor(data?.score ?? 0));
    this.finalAbility = data?.ability;

    const restartHandler = () => this.restartGame();
    const menuHandler = () => this.returnToMenu();

    this.input?.keyboard?.once?.('keydown-R', restartHandler);
    this.input?.keyboard?.once?.('keydown-M', menuHandler);
    this.input?.once?.('pointerdown', restartHandler);

    if (this.add?.text) {
      const style: Phaser.Types.GameObjects.Text.TextStyle = {
        fontSize: '30px',
        color: '#ffb4d9',
        align: 'center',
      };

      const infoStyle: Phaser.Types.GameObjects.Text.TextStyle = {
        fontSize: '18px',
        color: '#ffffff',
      };

      const title = this.add.text(0, -80, 'Game Over', style);
      title.setOrigin?.(0.5, 0.5);
      title.setScrollFactor?.(0, 0);
      title.setDepth?.(2000);

      const abilityLabel = this.finalAbility ? this.finalAbility.toUpperCase() : 'None';
      const scoreText = `Final Score: ${this.finalScore.toString().padStart(6, '0')}`;
      const abilityText = `Ability Carried: ${abilityLabel}`;

      const scoreLine = this.add.text(0, -20, scoreText, infoStyle);
      scoreLine.setOrigin?.(0.5, 0.5);
      scoreLine.setScrollFactor?.(0, 0);
      scoreLine.setDepth?.(2000);

      const abilityLine = this.add.text(0, 20, abilityText, infoStyle);
      abilityLine.setOrigin?.(0.5, 0.5);
      abilityLine.setScrollFactor?.(0, 0);
      abilityLine.setDepth?.(2000);

      const restartLine = this.add.text(0, 70, 'Restart (R)', infoStyle);
      restartLine.setOrigin?.(0.5, 0.5);
      restartLine.setScrollFactor?.(0, 0);
      restartLine.setDepth?.(2000);
      restartLine.setInteractive?.({ useHandCursor: true });
      restartLine.on?.('pointerdown', restartHandler);

      const menuLine = this.add.text(0, 110, 'Return to Menu (M)', infoStyle);
      menuLine.setOrigin?.(0.5, 0.5);
      menuLine.setScrollFactor?.(0, 0);
      menuLine.setDepth?.(2000);
      menuLine.setInteractive?.({ useHandCursor: true });
      menuLine.on?.('pointerdown', menuHandler);
    }
  }

  restartGame() {
    this.scene.stop(SceneKeys.GameOver);
    this.scene.stop(SceneKeys.Game);
    this.scene.start(SceneKeys.Game);
  }

  returnToMenu() {
    this.scene.stop(SceneKeys.GameOver);
    this.scene.stop(SceneKeys.Game);
    this.scene.start(SceneKeys.Menu);
  }
}

export const coreScenes = [BootScene, MenuScene, GameScene, PauseScene, GameOverScene];
