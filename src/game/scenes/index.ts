import Phaser from 'phaser';
import { createKirdy, type Kirdy, type KirdyOptions } from '../characters/Kirdy';
import { InhaleSystem } from '../mechanics/InhaleSystem';
import { AbilitySystem, type AbilityType } from '../mechanics/AbilitySystem';
import { SwallowSystem, type SwallowedPayload } from '../mechanics/SwallowSystem';
import {
  PlayerInputManager,
  type PlayerInputSnapshot,
  type PlayerAction,
  type InputButtonState,
} from '../input/PlayerInputManager';
import { type EnemySpawn, type WabbleBeeOptions, type DrontoDurtOptions } from '../enemies';
import { EnemyManager } from '../enemies/EnemyManager';
import { PhysicsSystem } from '../physics/PhysicsSystem';
import { AreaManager, AREA_IDS, type AreaManagerSnapshot, type Vector2 } from '../world/AreaManager';
import { MapOverlay, createMapSummaries } from '../ui/MapOverlay';
import { Hud } from '../ui/Hud';
import { SaveManager, type GameProgressSnapshot, DEFAULT_SETTINGS, type GameSettingsSnapshot } from '../save/SaveManager';
import { createAssetManifest, queueAssetManifest, type AssetFallback } from '../assets/pipeline';
import { PerformanceMonitor, type PerformanceMetrics } from '../performance/PerformanceMonitor';
import { recordLowFpsEvent, recordStableFpsEvent } from '../performance/RenderingModePreference';
import { AudioManager } from '../audio/AudioManager';
import { ErrorHandler, type GameError } from '../errors/ErrorHandler';

export const SceneKeys = {
  Boot: 'BootScene',
  Menu: 'MenuScene',
  Game: 'GameScene',
  Pause: 'PauseScene',
  GameOver: 'GameOverScene',
} as const;

type SceneKey = (typeof SceneKeys)[keyof typeof SceneKeys];

const TERRAIN_TEXTURE_KEY = 'tileset-main';
const TERRAIN_VISUAL_DEPTH = -50;
const TERRAIN_FRAME_KEYS = {
  wall: 'wall',
  floor: 'floor',
} as const;

type TerrainTilePlacement = {
  column: number;
  row: number;
  centerX: number;
  centerY: number;
  tileSize: number;
};

function buildConfig(key: SceneKey) {
  return { key } satisfies Phaser.Types.Scenes.SettingsConfig;
}

type LoaderLike = Partial<{
  image(key: string, url: string, frameConfig?: unknown): void;
  audio(key: string, urls: string[], config?: unknown): void;
  json(key: string, url: string): void;
  start(): void;
}>;

function enqueueFallback(loader: LoaderLike, key: string, fallback: AssetFallback) {
  switch (fallback.type) {
    case 'image':
      loader.image?.(key, fallback.url);
      break;
    case 'audio':
      loader.audio?.(key, [fallback.url]);
      break;
    case 'data':
      loader.json?.(key, fallback.url);
      break;
    default:
      break;
  }
}

export class BootScene extends Phaser.Scene {
  public static readonly KEY = SceneKeys.Boot;

  constructor() {
    super(buildConfig(SceneKeys.Boot));
  }

  preload() {
    const loader = this.load;
    const add = this.add;

    if (!loader) {
      this.scene.start(SceneKeys.Menu);
      return;
    }

    const textureManager = this.textures as
      | {
          setDefaultFilter?: (mode: Phaser.Textures.FilterMode) => void;
          get?: (
            key: string,
          ) =>
            | {
                setFilter?: (mode: Phaser.Textures.FilterMode) => void;
                setGenerateMipmaps?: (value: boolean) => void;
              }
            | undefined;
        }
      | undefined;

    const nearestFilter = Phaser.Textures?.FilterMode?.NEAREST ?? Phaser.Textures?.FilterMode?.LINEAR;
    textureManager?.setDefaultFilter?.(nearestFilter);

    loader.once?.('filecomplete-image-tileset-main', () => {
      const texture = textureManager?.get?.(TERRAIN_TEXTURE_KEY);
      texture?.setFilter?.(nearestFilter);
      texture?.setGenerateMipmaps?.(false);
    });

    const manifest = createAssetManifest();
    const { fallbackMap } = queueAssetManifest(loader, manifest);
    const attemptedFallbacks = new Set<string>();

    const width = this.scale?.width ?? 800;
    const height = this.scale?.height ?? 600;
    const textStyle = {
      fontSize: '18px',
      color: '#ffffff',
    } satisfies Phaser.Types.GameObjects.Text.TextStyle;

    const progressText = add?.text?.(width / 2, height / 2, 'Loading... 0%', textStyle);
    progressText?.setOrigin?.(0.5, 0.5);
    progressText?.setScrollFactor?.(0, 0);
    progressText?.setDepth?.(2000);
    progressText?.setText?.('Loading... 0%');

    const updateProgress = (value: number) => {
      const normalized = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
      const percent = Math.round(normalized * 100);
      progressText?.setText?.(`Loading... ${percent}%`);
    };

    const retryWithFallback = (file?: { key?: string; type?: string }) => {
      const key = file?.key;
      if (!key || attemptedFallbacks.has(key)) {
        return;
      }

      const fallback = fallbackMap.get(key);
      if (!fallback) {
        return;
      }

      attemptedFallbacks.add(key);
      enqueueFallback(loader, key, fallback);
      loader.start?.();
    };

    loader.on?.('progress', updateProgress);
    loader.on?.('loaderror', retryWithFallback);

    loader.once?.('complete', () => {
      loader.off?.('progress', updateProgress);
      loader.off?.('loaderror', retryWithFallback);
      progressText?.destroy?.();
      this.scene.start(SceneKeys.Menu);
    });

    loader.start?.();
  }

  create() {}
}

export class MenuScene extends Phaser.Scene {
  public static readonly KEY = SceneKeys.Menu;

  constructor() {
    super(buildConfig(SceneKeys.Menu));
  }

  create(data?: { errorMessage?: string }) {
    const errorMessage = data?.errorMessage?.trim();

    if (errorMessage && this.add?.text) {
      const notice = this.add.text(0, -48, errorMessage, {
        fontSize: '20px',
        color: '#ff6666',
        wordWrap: { width: 620 },
      });
      notice.setOrigin?.(0, 0);
      notice.setScrollFactor?.(0, 0);
      notice.setDepth?.(1000);
    }

    if (this.add?.text) {
      const prompt = this.add.text(0, 0, 'Press Space or Tap to Start', {
        fontSize: '24px',
        color: '#ffffff',
      });
      prompt.setOrigin?.(0, 0);
      prompt.setScrollFactor?.(0, 0);
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
  private enemyManager?: EnemyManager;
  private readonly enemyCullingPadding = 96;
  private readonly enemyManagerConfig = {
    maxActiveEnemies: 3,
    enemyClusterLimit: 2,
    enemySafetyRadius: 96,
    enemySpawnCooldownMs: 1200,
  } as const;
  private static readonly PLAYER_SPAWN = { x: 160, y: 360 } as const;
  private physicsSystem?: PhysicsSystem;
  private areaManager?: AreaManager;
  private mapOverlay?: MapOverlay;
  private mapToggleHandler?: () => void;
  private pauseKeyHandler?: () => void;
  private lastAreaSummaryHash?: string;
  private hud?: Hud;
  private readonly playerMaxHP = 6;
  private readonly scorePerEnemy = 100;
  private isGameOver = false;
  private runtimeErrorCaptured = false;
  private saveManager?: SaveManager;
  private progressDirty = false;
  private lastSavedTileKey?: string;
  private performanceMonitor?: PerformanceMonitor;
  private readonly performanceRecoveryThresholdFps = 55;
  private audioManager?: AudioManager;
  private terrainColliders: Array<Phaser.Physics.Matter.Image | Phaser.Physics.Matter.Sprite> = [];
  private terrainTiles: Array<Phaser.GameObjects.GameObject & { destroy?: () => void }> = [];
  private cameraFollowConfigured = false;

  constructor() {
    super(buildConfig(SceneKeys.Game));
  }

  private readonly handleAbilityAcquired = (event: { abilityType?: AbilityType }) => {
    if (!event?.abilityType || !this.kirdy) {
      return;
    }

    this.kirdy.setAbility(event.abilityType);
    this.hud?.updateAbility(event.abilityType);
    this.requestSave();
  };

  private readonly handleAbilityCleared = () => {
    this.kirdy?.clearAbility();
    this.hud?.updateAbility(undefined);
    this.requestSave();
  };

  private readonly handleEnemyDefeated = () => {
    if (!this.kirdy) {
      return;
    }

    const updatedScore = this.kirdy.addScore(this.scorePerEnemy);
    this.hud?.updateScore(updatedScore);
    this.requestSave();
  };

  private readonly handlePlayerDefeated = () => {
    if (this.isGameOver) {
      return;
    }

    this.isGameOver = true;
    this.scene.pause(SceneKeys.Game);
    const score = this.kirdy?.getScore() ?? 0;
    const ability = this.kirdy?.getAbility();
    const maxHP = this.kirdy?.getMaxHP() ?? this.playerMaxHP;

    this.scene.launch(SceneKeys.GameOver, {
      score,
      ability,
      maxHP,
    });
    this.requestSave();
  };

  private handlePerformanceSample(metrics: PerformanceMetrics) {
    if (!Number.isFinite(metrics.averageFps)) {
      return;
    }

    if (metrics.averageFps >= this.performanceRecoveryThresholdFps) {
      recordStableFpsEvent();
    }
  }

  private handleLowFps(metrics: PerformanceMetrics) {
    recordLowFpsEvent();
    this.events?.emit?.('performance:low-fps', metrics);
  }

  public damagePlayer(amount: number) {
    if (!Number.isFinite(amount) || !this.kirdy) {
      return;
    }

    const normalized = Math.max(0, Math.floor(amount));
    if (normalized <= 0) {
      return;
    }

    const previous = this.kirdy.getHP();
    const current = this.kirdy.takeDamage(normalized);

    if (current === previous) {
      return;
    }

    this.hud?.updateHP({ current, max: this.kirdy.getMaxHP() });

    if (current <= 0) {
      this.handlePlayerDefeated();
    }

    this.requestSave();
  }

  create() {
    const savedProgress = this.initializeSaveManager();

    this.audioManager = new AudioManager(this);
    this.audioManager.playBgm('bgm-main', { volume: 1 });

    this.isGameOver = false;
    this.progressDirty = false;
    this.physicsSystem = new PhysicsSystem(this);
    this.performanceMonitor = new PerformanceMonitor({
      sampleWindowMs: 500,
      lowFpsThreshold: 40,
      lowFpsSampleCount: 3,
      onSample: (metrics) => this.handlePerformanceSample(metrics),
      onLowFps: (metrics) => this.handleLowFps(metrics),
    });

    const areaSnapshot = savedProgress?.area as AreaManagerSnapshot | undefined;
    const startingAreaId = areaSnapshot?.currentAreaId ?? AREA_IDS.CentralHub;
    this.areaManager = new AreaManager(startingAreaId, undefined, areaSnapshot);
    this.mapOverlay = new MapOverlay(this);
    this.hud = new Hud(this);

    this.rebuildTerrainColliders();
    this.buildTerrainVisuals();

    const spawn = this.determineSpawnPosition();
    const savedPlayer = savedProgress?.player;
    const kirdyOptions: KirdyOptions = {
      maxHP: savedPlayer?.maxHP ?? this.playerMaxHP,
      initialHP: savedPlayer?.hp ?? savedPlayer?.maxHP ?? this.playerMaxHP,
      score: savedPlayer?.score ?? 0,
      ability: savedPlayer?.ability,
    };
    this.pauseKeyHandler = () => this.pauseGame();
    this.input?.keyboard?.on?.('keydown-ESC', this.pauseKeyHandler);
    this.mapToggleHandler = () => this.toggleMapOverlay();
    if (this.mapToggleHandler) {
      this.input?.keyboard?.on?.('keydown-M', this.mapToggleHandler);
    }

    this.kirdy = createKirdy(this, spawn, kirdyOptions);
    if (this.kirdy) {
      this.physicsSystem?.registerPlayer(this.kirdy);
      this.configureCamera();
    }
    this.playerInput = new PlayerInputManager(this);
    if (this.kirdy) {
      this.inhaleSystem = new InhaleSystem(this, this.kirdy);
      this.swallowSystem = new SwallowSystem(this, this.kirdy, this.inhaleSystem, this.physicsSystem);
      this.abilitySystem = new AbilitySystem(this, this.kirdy, this.physicsSystem, this.audioManager);
    }

    if (this.inhaleSystem && this.physicsSystem) {
      this.enemyManager = new EnemyManager({
        scene: this,
        inhaleSystem: this.inhaleSystem,
        physicsSystem: this.physicsSystem,
        getPlayerPosition: () => this.getPlayerPosition(),
        getCullingBounds: () => this.getCullingBounds(),
        config: this.enemyManagerConfig,
      });
    }

    this.events?.on?.('ability-acquired', this.handleAbilityAcquired, this);
    this.events?.on?.('ability-cleared', this.handleAbilityCleared, this);
    this.events?.on?.('enemy-defeated', this.handleEnemyDefeated, this);

    if (savedProgress?.player.ability) {
      this.abilitySystem?.applySwallowedPayload({ abilityType: savedProgress.player.ability } as SwallowedPayload);
    }

    this.events?.once?.('shutdown', () => {
      this.playerInput?.destroy();
      this.playerInput = undefined;
      this.latestInput = undefined;
      this.inhaleSystem = undefined;
      this.swallowSystem = undefined;
      this.abilitySystem = undefined;
      this.enemyManager?.destroy();
      this.enemyManager = undefined;
      this.physicsSystem = undefined;
      this.areaManager = undefined;
      this.destroyTerrainColliders();
      this.cameraFollowConfigured = false;
      if (this.mapToggleHandler) {
        this.input?.keyboard?.off?.('keydown-M', this.mapToggleHandler);
        this.mapToggleHandler = undefined;
      }
      if (this.pauseKeyHandler) {
        this.input?.keyboard?.off?.('keydown-ESC', this.pauseKeyHandler);
        this.pauseKeyHandler = undefined;
      }
      this.mapOverlay?.destroy();
      this.mapOverlay = undefined;
      this.events?.off?.('ability-acquired', this.handleAbilityAcquired, this);
      this.events?.off?.('ability-cleared', this.handleAbilityCleared, this);
      this.events?.off?.('enemy-defeated', this.handleEnemyDefeated, this);
      this.hud?.destroy();
      this.hud = undefined;
      this.kirdy = undefined;
      this.isGameOver = false;
      this.saveManager = undefined;
      this.progressDirty = false;
      this.lastSavedTileKey = undefined;
      this.performanceMonitor = undefined;
      this.audioManager?.stopBgm();
      this.audioManager = undefined;
    });

    if (this.kirdy) {
      this.hud?.updateHP({ current: this.kirdy.getHP(), max: this.kirdy.getMaxHP() });
      this.hud?.updateScore(this.kirdy.getScore());
      this.hud?.updateAbility(this.kirdy.getAbility());
    } else {
      this.hud?.updateHP({ current: this.playerMaxHP, max: this.playerMaxHP });
      this.hud?.updateScore(0);
      this.hud?.updateAbility(undefined);
    }

    this.initializeExplorationSaveKey();
  }

  setAudioVolume(value: number) {
    this.audioManager?.setMasterVolume(value);
  }

  setAudioMuted(muted: boolean) {
    this.audioManager?.setMuted(muted);
  }

  toggleAudioMute() {
    this.audioManager?.toggleMute();
  }

  pauseGame() {
    this.scene.launch(SceneKeys.Pause);
  }

  update(time: number, delta: number) {
    if (this.runtimeErrorCaptured) {
      return;
    }

    try {
      this.performanceMonitor?.update(delta);

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
      this.enemyManager?.update(delta);
      this.updateAreaState();

      if (this.progressDirty) {
        this.persistProgress();
      }
    } catch (error) {
      this.handleRuntimeFailure(error);
    }
  }

  private handleRuntimeFailure(error: unknown) {
    if (this.runtimeErrorCaptured) {
      return;
    }

    this.runtimeErrorCaptured = true;
    ErrorHandler.handleGameError(this.toGameError(error), this);
  }

  private toGameError(error: unknown): GameError {
    if (error && typeof (error as { type?: unknown }).type === 'string') {
      return error as GameError;
    }

    if (error instanceof Error) {
      return {
        type: 'CRITICAL_GAME_ERROR',
        message: error.message,
      } satisfies GameError;
    }

    return {
      type: 'CRITICAL_GAME_ERROR',
    } satisfies GameError;
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
    return this.enemyManager?.spawnWabbleBee(spawn, options);
  }

  spawnDrontoDurt(spawn: EnemySpawn, options: DrontoDurtOptions = {}) {
    return this.enemyManager?.spawnDrontoDurt(spawn, options);
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

    if (result.areaChanged) {
      this.rebuildTerrainColliders();
      this.buildTerrainVisuals();
      this.configureCamera();
    }

    this.trackExplorationProgress(result.areaChanged);

    if (this.mapOverlay?.isVisible()) {
      this.refreshMapOverlay();
    }
  }

  private collectWallTiles(): TerrainTilePlacement[] {
    const areaState = this.areaManager?.getCurrentAreaState();
    const tileMap = areaState?.tileMap as Partial<{
      tileSize: number;
      columns: number;
      rows: number;
      getTileAt: (column: number, row: number) => string | undefined;
    }>;

    const columns = Number.isFinite(tileMap?.columns) ? (tileMap!.columns as number) : 0;
    const rows = Number.isFinite(tileMap?.rows) ? (tileMap!.rows as number) : 0;
    const tileSize = Number.isFinite(tileMap?.tileSize) ? (tileMap!.tileSize as number) : 32;
    const getTileAt = typeof tileMap?.getTileAt === 'function' ? tileMap!.getTileAt!.bind(tileMap) : undefined;

    if (!getTileAt || columns <= 0 || rows <= 0 || tileSize <= 0) {
      return [];
    }

    const placements: TerrainTilePlacement[] = [];
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const tile = getTileAt(column, row);
        if (tile !== 'wall') {
          continue;
        }

        const centerX = column * tileSize + tileSize / 2;
        const centerY = row * tileSize + tileSize / 2;
        placements.push({ column, row, centerX, centerY, tileSize });
      }
    }

    return placements;
  }

  private buildTerrainVisuals() {
    this.destroyTerrainVisuals();

    const displayFactory = this.add;
    if (!displayFactory) {
      return;
    }

    const placements = this.collectWallTiles();
    if (placements.length === 0) {
      return;
    }

    placements.forEach(({ centerX, centerY, tileSize }) => {
      let visual = displayFactory.image?.(centerX, centerY, TERRAIN_TEXTURE_KEY, TERRAIN_FRAME_KEYS.wall) as
        | (Phaser.GameObjects.Image & { destroy?: () => void })
        | undefined;

      if (!visual && displayFactory.rectangle) {
        visual = displayFactory.rectangle(centerX, centerY, tileSize, tileSize, 0x4a4a4a, 1) as
          | (Phaser.GameObjects.Rectangle & { destroy?: () => void })
          | undefined;
      }

      if (!visual) {
        return;
      }

      visual.setOrigin?.(0.5, 0.5);
      visual.setDepth?.(TERRAIN_VISUAL_DEPTH);
      visual.setDisplaySize?.(tileSize, tileSize);
      visual.setFrame?.(TERRAIN_FRAME_KEYS.wall);
      visual.setVisible?.(true);

      this.terrainTiles.push(visual);
    });
  }

  private destroyTerrainVisuals() {
    this.terrainTiles.forEach((tile) => {
      tile.destroy?.();
    });
    this.terrainTiles = [];
  }

  private rebuildTerrainColliders() {
    this.destroyTerrainColliders();

    if (!this.physicsSystem) {
      return;
    }

    const areaState = this.areaManager?.getCurrentAreaState();
    const displayFactory = this.add;
    const matterFactory = this.matter?.add;
    if (!areaState || !displayFactory?.rectangle) {
      return;
    }

    const attachMatterObject = matterFactory?.gameObject ?? matterFactory?.existing;
    if (!attachMatterObject) {
      return;
    }

    this.collectWallTiles().forEach(({ centerX, centerY, tileSize }) => {
      // Use an invisible display object so Matter assigns a matching gameObject to the body.
      const rectangle = displayFactory.rectangle(centerX, centerY, tileSize, tileSize, 0x000000, 0);
      if (!rectangle) {
        return;
      }

      rectangle.setVisible?.(false);
      rectangle.setActive?.(false);
      rectangle.setDepth?.(0);

      const matterObject = attachMatterObject.call(matterFactory, rectangle, { isStatic: true }) as
        | (Phaser.Physics.Matter.Image & { body?: { gameObject?: any } })
        | (Phaser.Physics.Matter.Sprite & { body?: { gameObject?: any } })
        | (Phaser.GameObjects.Rectangle & { body?: { gameObject?: any } })
        | undefined;

      if (!matterObject) {
        rectangle.destroy?.();
        return;
      }

      const body = (matterObject as any).body ?? (rectangle as any).body;
      if (body) {
        body.gameObject = matterObject;
        (matterObject as any).body = body;
      }

      matterObject.setStatic?.(true);
      matterObject.setIgnoreGravity?.(true);
      matterObject.setDepth?.(0);
      matterObject.setName?.('Terrain');

      this.physicsSystem!.registerTerrain(matterObject as any);
      this.terrainColliders.push(matterObject);
    });
  }

  private destroyTerrainColliders() {
    this.destroyTerrainVisuals();
    this.terrainColliders.forEach((collider) => {
      collider.destroy?.();
    });
    this.terrainColliders = [];
  }

  private configureCamera() {
    const camera = this.cameras?.main as Partial<Phaser.Cameras.Scene2D.Camera> | undefined;
    const sprite = this.kirdy?.sprite;
    if (!camera || !sprite) {
      return;
    }

    if (!this.cameraFollowConfigured) {
      camera.startFollow?.(sprite, true, 0.1, 0.1);
      this.cameraFollowConfigured = true;
    }

    const bounds = this.areaManager?.getCurrentAreaState()?.pixelBounds;
    if (Number.isFinite(bounds?.width) && Number.isFinite(bounds?.height)) {
      camera.setBounds?.(0, 0, bounds!.width as number, bounds!.height as number);
    }
  }

  private getCullingBounds() {
    const camera = this.cameras?.main;
    const view = camera?.worldView as { x: number; y: number; width: number; height: number } | undefined;
    if (!view) {
      return undefined;
    }

    const padding = this.enemyCullingPadding;
    return {
      left: view.x - padding,
      right: view.x + view.width + padding,
      top: view.y - padding,
      bottom: view.y + view.height + padding,
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

  private initializeSaveManager(): GameProgressSnapshot | undefined {
    this.saveManager = new SaveManager();
    return this.saveManager.load();
  }

  private determineSpawnPosition(): Vector2 {
    if (this.areaManager) {
      const lastKnown = this.areaManager.getLastKnownPlayerPosition();
      if (lastKnown) {
        return this.clampPositionToArea(lastKnown);
      }

      const areaState = this.areaManager.getCurrentAreaState();
      if (areaState?.playerSpawnPosition) {
        return this.clampPositionToArea(areaState.playerSpawnPosition);
      }
    }

    return { ...GameScene.PLAYER_SPAWN } satisfies Vector2;
  }

  private clampPositionToArea(position?: Vector2): Vector2 {
    const fallback = { ...GameScene.PLAYER_SPAWN } satisfies Vector2;
    const targetX = Number.isFinite(position?.x) ? (position!.x as number) : fallback.x;
    const targetY = Number.isFinite(position?.y) ? (position!.y as number) : fallback.y;

    const bounds = this.areaManager?.getCurrentAreaState()?.pixelBounds;
    if (!Number.isFinite(bounds?.width) || !Number.isFinite(bounds?.height)) {
      return { x: targetX, y: targetY } satisfies Vector2;
    }

    const maxX = Math.max(0, (bounds!.width as number) - 1);
    const maxY = Math.max(0, (bounds!.height as number) - 1);
    const clampedX = Math.min(Math.max(0, targetX), maxX);
    const clampedY = Math.min(Math.max(0, targetY), maxY);

    return { x: clampedX, y: clampedY } satisfies Vector2;
  }

  private initializeExplorationSaveKey() {
    if (!this.areaManager) {
      this.lastSavedTileKey = undefined;
      return;
    }

    const position = this.areaManager.getLastKnownPlayerPosition();
    this.lastSavedTileKey = this.buildTileKey(position);
  }

  private trackExplorationProgress(areaChanged: boolean) {
    if (!this.areaManager) {
      return;
    }

    const position = this.areaManager.getLastKnownPlayerPosition();
    const key = this.buildTileKey(position);
    if (!key) {
      return;
    }

    if (!this.lastSavedTileKey) {
      this.lastSavedTileKey = key;
      return;
    }

    if (areaChanged || this.lastSavedTileKey !== key) {
      this.lastSavedTileKey = key;
      this.requestSave();
    }
  }

  private buildTileKey(position?: Vector2) {
    if (!this.areaManager || !position) {
      return undefined;
    }

    const areaState = this.areaManager.getCurrentAreaState();
    const coordinate = areaState.tileMap.getClampedTileCoordinate(position);
    if (!coordinate) {
      return undefined;
    }

    return `${areaState.definition.id}:${coordinate.column},${coordinate.row}`;
  }

  private requestSave() {
    this.progressDirty = true;
  }

  private persistProgress() {
    if (!this.saveManager || !this.areaManager) {
      this.progressDirty = false;
      return;
    }

    const areaSnapshot = this.areaManager.getPersistenceSnapshot();
    const rawPosition = this.getPlayerPosition() ?? this.areaManager.getLastKnownPlayerPosition();
    const playerPosition = this.clampPositionToArea(rawPosition);

    const playerStats = this.kirdy?.toStatsSnapshot() ?? {
      hp: this.playerMaxHP,
      maxHP: this.playerMaxHP,
      score: 0,
      ability: undefined,
    };

    const snapshot: GameProgressSnapshot = {
      player: {
        ...playerStats,
        position: playerPosition,
      },
      area: {
        ...areaSnapshot,
        lastKnownPlayerPosition: playerPosition,
        completedAreas: areaSnapshot.completedAreas ?? [],
        collectedItems: areaSnapshot.collectedItems ?? [],
      },
      settings: this.getSettingsSnapshot(),
    };

    this.saveManager.save(snapshot);
    this.progressDirty = false;
  }

  private getSettingsSnapshot(): GameSettingsSnapshot {
    const volume = this.audioManager?.getMasterVolume?.();
    const normalizedVolume = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume as number)) : DEFAULT_SETTINGS.volume;

    return {
      volume: normalizedVolume,
      controls: DEFAULT_SETTINGS.controls,
      difficulty: DEFAULT_SETTINGS.difficulty,
    } satisfies GameSettingsSnapshot;
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
