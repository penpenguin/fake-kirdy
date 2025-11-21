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
import {
  type EnemySpawn,
  type WabbleBeeOptions,
  type DrontoDurtOptions,
  type EnemyType,
  type Enemy,
} from '../enemies';
import { EnemyManager } from '../enemies/EnemyManager';
import { PhysicsSystem } from '../physics/PhysicsSystem';
import {
  AreaManager,
  AREA_IDS,
  type AreaManagerSnapshot,
  type Vector2,
  type AreaEnemySpawnConfig,
  type AreaId,
  type AreaTransitionDirection,
  type AreaDefinitionMetadata,
} from '../world/AreaManager';
import { MapSystem, type SpawnTile } from '../world/MapSystem';
import { resolveCollectibleTextureKey } from '../world/collectible-assets';
import { STAGE_DEFINITIONS } from '../world/stages';
import { MapOverlay, createMapSummaries } from '../ui/MapOverlay';
import { Hud, type HudHPState } from '../ui/Hud';
import { HUD_SAFE_AREA_HEIGHT, HUD_WORLD_MARGIN } from '../ui/hud-layout';
import { ResultsOverlay, type GoalResultPayload } from '../ui/ResultsOverlay';
import {
  SaveManager,
  type GameProgressSnapshot,
  DEFAULT_SETTINGS,
  type GameSettingsSnapshot,
  type ControlScheme,
  type DifficultyLevel,
} from '../save/SaveManager';
import { createAssetManifest, queueAssetManifest, type AssetFallback } from '../assets/pipeline';
import { PerformanceMonitor, type PerformanceMetrics } from '../performance/PerformanceMonitor';
import { recordLowFpsEvent, recordStableFpsEvent } from '../performance/RenderingModePreference';
import { AudioManager } from '../audio/AudioManager';
import { ErrorHandler, type GameError } from '../errors/ErrorHandler';
import { GoalDoorController } from '../mechanics/GoalDoorController';
import { RunTimer } from '../performance/RunTimer';

export const SceneKeys = {
  Boot: 'BootScene',
  Menu: 'MenuScene',
  Game: 'GameScene',
  Settings: 'SettingsScene',
  Pause: 'PauseScene',
  GameOver: 'GameOverScene',
  Results: 'ResultsScene',
} as const;

type SceneKey = (typeof SceneKeys)[keyof typeof SceneKeys];

const WALL_TEXTURE_KEY = 'wall-texture';
const CLUSTER_TILE_TEXTURE_KEYS = {
  hub: 'brick-tile',
  forest: 'forest-tile',
  fire: 'fire-tile',
  ice: 'ice-tile',
  ruins: 'stone-tile',
  sky: 'royal-tile',
  void: 'stone-tile',
} as const satisfies Record<AreaDefinitionMetadata['cluster'], string>;
const WALL_TILE_TEXTURE_KEYS = Array.from(
  new Set<string>([WALL_TEXTURE_KEY, ...Object.values(CLUSTER_TILE_TEXTURE_KEYS)]),
);
const PIXEL_ART_TEXTURE_KEYS = [...WALL_TILE_TEXTURE_KEYS];
const MENU_BLUR_FALLBACK_TEXTURE_KEY = '__menu-blur-fallback';
const TERRAIN_VISUAL_DEPTH = -50;
const DOOR_TEXTURE_KEY = 'door-marker';
const GOAL_DOOR_TEXTURE_KEY = 'goal-door';
const LOCKED_DOOR_TEXTURE_KEY = 'locked-door';
const DOOR_MARKER_COLOR = 0xffdd66;
const DOOR_MARKER_ALPHA = 0.8;
const GOAL_DOOR_MARKER_COLOR = 0x66ffe3;
const LOCKED_DOOR_MARKER_COLOR = 0x9fa8c9;
const DOOR_MARKER_DEPTH = TERRAIN_VISUAL_DEPTH + 4;
const CONTROL_SCHEME_SEQUENCE: ControlScheme[] = ['keyboard', 'touch', 'controller'];
const DIFFICULTY_SEQUENCE: DifficultyLevel[] = ['easy', 'normal', 'hard'];

type TerrainTilePlacement = {
  column: number;
  row: number;
  centerX: number;
  centerY: number;
  tileSize: number;
  doorType?: 'standard' | 'goal';
  doorTargetId?: AreaId;
  doorDirection?: AreaTransitionDirection;
};

type StageEnemySpawnEntry = {
  type: EnemyType;
  limit: number;
};

type StageEnemySpawnPlan = {
  baseline: number;
  maxActive: number;
  entries: StageEnemySpawnEntry[];
};

type AreaCluster = AreaDefinitionMetadata['cluster'];
type TextureManagerLike = { exists?: (key: string) => boolean } | undefined;

function resolveWallTextureKey(cluster?: AreaCluster) {
  if (!cluster) {
    return WALL_TEXTURE_KEY;
  }

  return CLUSTER_TILE_TEXTURE_KEYS[cluster] ?? WALL_TEXTURE_KEY;
}

function selectWallTextureForArea(textureManager: TextureManagerLike, cluster?: AreaCluster) {
  const desiredKey = resolveWallTextureKey(cluster);
  if (textureManager?.exists?.(desiredKey)) {
    return desiredKey;
  }

  if (desiredKey !== WALL_TEXTURE_KEY && textureManager?.exists?.(WALL_TEXTURE_KEY)) {
    return WALL_TEXTURE_KEY;
  }

  return undefined;
}

type PlayerEnemyCollisionEvent = {
  enemy?: Enemy;
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

    const applyPixelArtSettings = (textureKey: string) => {
      const texture = textureManager?.get?.(textureKey);
      texture?.setFilter?.(nearestFilter);
      texture?.setGenerateMipmaps?.(false);
    };

    PIXEL_ART_TEXTURE_KEYS.forEach((textureKey) => {
      loader.once?.(`filecomplete-image-${textureKey}`, () => {
        applyPixelArtSettings(textureKey);
      });
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
  private readonly saveManager = new SaveManager();
  private resetNotice?: Phaser.GameObjects.Text;

  constructor() {
    super(buildConfig(SceneKeys.Menu));
  }

  create(data?: { errorMessage?: string }) {
    this.resetNotice?.destroy?.();
    this.resetNotice = undefined;
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
      const width = this.scale?.width ?? 800;
      const height = this.scale?.height ?? 600;
      const centerX = width / 2;
      const centerY = height / 2;
      const promptFontSize = 24;
      const promptMarginLines = 2;
      const promptMarginPixels = promptFontSize * promptMarginLines;
      const promptOffsetFromCenter = 180 + promptMarginPixels / 2;
      const promptBaseY = centerY - promptOffsetFromCenter;
      const promptDisplayY = promptBaseY + promptMarginPixels;
      const promptMessage = 'Press Space or Tap to Start';
      const prompt = this.add.text(centerX, promptDisplayY, promptMessage, {
        fontSize: '24px',
        color: '#ffffff',
        align: 'center',
      });
      prompt.setOrigin?.(0.5, 0.5);
      prompt.setPosition?.(centerX, promptDisplayY);
      prompt.setScrollFactor?.(0, 0);
      prompt.setDepth?.(100);
      this.createStartPromptBlink(prompt);

      const keycapPadding = { left: 8, right: 8, top: 4, bottom: 4 } as const;
      const keycapStyle: Phaser.Types.GameObjects.Text.TextStyle = {
        fontSize: '16px',
        color: '#f4f8ff',
        fontFamily: 'monospace',
        padding: keycapPadding,
        align: 'center',
      };
      const keycapBaseWidth = 64;
      const keycapCharWidth = 12;
      const keycapGap = 12;
      const keycapHeight = 32;
      const keycapRadius = 10;
      const keycapRowSpacing = 32;
      const sectionTitleSpacing = 44;
      const noteSpacing = 12;
      const zonePadding = 8;
      const zoneRowGap = 8;
      const zoneColumns = 2;
      const zoneColumnGap = 32;
      const zoneWidth = Math.min(width - 64, 660);
      const zoneFillColor = 0x0d162e;
      const zoneStrokeColor = 0x2b3650;
      const zonePanelDepth = 70;
      const zonePanelRadius = 16;
      const keycapBackgroundDepth = 90;
      const keycapTextDepth = 100;
      const columnWidth =
        (zoneWidth - zoneColumnGap * (zoneColumns - 1)) / zoneColumns;
      const gridTotalWidth = columnWidth * zoneColumns + zoneColumnGap * (zoneColumns - 1);
      const columnCenters = Array.from({ length: zoneColumns }, (_, columnIndex) =>
        centerX - gridTotalWidth / 2 + columnWidth / 2 + columnIndex * (columnWidth + zoneColumnGap),
      );
      const gridTop = promptBaseY + promptMarginPixels * 2 + 20;

      const computeKeycapWidth = (label: string) => {
        const horizontalPadding = keycapPadding.left + keycapPadding.right;
        return Math.max(keycapBaseWidth, label.length * keycapCharWidth + horizontalPadding);
      };

      const createKeycap = (x: number, y: number, label: string, backgroundWidth: number) => {
        const rectX = x - backgroundWidth / 2;
        const rectY = y - keycapHeight / 2;

        if (this.add?.graphics) {
          const keycapGraphic = this.add.graphics();
          keycapGraphic.fillStyle?.(0x1c2333, 1);
          keycapGraphic.lineStyle?.(1, 0x4f5f8f, 0.9);
          keycapGraphic.fillRoundedRect?.(rectX, rectY, backgroundWidth, keycapHeight, keycapRadius);
          keycapGraphic.strokeRoundedRect?.(rectX, rectY, backgroundWidth, keycapHeight, keycapRadius);
          keycapGraphic.setScrollFactor?.(0, 0);
          keycapGraphic.setDepth?.(keycapBackgroundDepth);
        }

        const text = this.add.text(x, y, label, keycapStyle);
        text.setOrigin?.(0.5, 0.5);
        text.setScrollFactor?.(0, 0);
        text.setDepth?.(keycapTextDepth);
        text.setPadding?.(
          keycapPadding.left,
          keycapPadding.top,
          keycapPadding.right,
          keycapPadding.bottom,
        );
        return text;
      };

      const renderSectionTitle = (x: number, y: number, title: string) => {
        const sectionTitleStyle: Phaser.Types.GameObjects.Text.TextStyle = {
          fontSize: '16px',
          color: '#ffe9ff',
          align: 'center',
        };
        const titleText = this.add.text(x, y, title, sectionTitleStyle);
        titleText.setOrigin?.(0.5, 0);
        titleText.setScrollFactor?.(0, 0);
        titleText.setDepth?.(keycapTextDepth);
      };

      const renderKeycapRow = (
        columnCenter: number,
        columnWidthValue: number,
        y: number,
        labels: string[],
        caption: string,
      ) => {
        const keyColumnCenter = columnCenter - columnWidthValue / 4;
        const descColumnCenter = columnCenter + columnWidthValue / 4;
        const rowWidths = labels.map((label) => computeKeycapWidth(label));
        const totalWidth = rowWidths.reduce((sum, width) => sum + width, 0) + (labels.length - 1) * keycapGap;
        let currentX = keyColumnCenter - totalWidth / 2;

        labels.forEach((label, index) => {
          const widthForKey = rowWidths[index];
          const labelCenterX = currentX + widthForKey / 2;
          createKeycap(labelCenterX, y, label, widthForKey);
          currentX += widthForKey + keycapGap;
        });

        const captionText = this.add.text(descColumnCenter, y, caption, {
          fontSize: '14px',
          color: '#dce6ff',
          align: 'center',
        });
        captionText.setOrigin?.(0.5, 0.5);
        captionText.setScrollFactor?.(0, 0);
        captionText.setDepth?.(keycapTextDepth);
      };

      const renderSectionNote = (x: number, y: number, note: string, availableWidth: number) => {
        const noteStyle: Phaser.Types.GameObjects.Text.TextStyle = {
          fontSize: '14px',
          color: '#ffffff',
          align: 'center',
        };
        const noteText = this.add.text(x, y, note, noteStyle);
        noteText.setOrigin?.(0.5, 0);
        noteText.setScrollFactor?.(0, 0);
        noteText.setDepth?.(keycapTextDepth);
        noteText.setWordWrapWidth?.(availableWidth - 24, true);
      };

      const renderZonePanel = (x: number, top: number, height: number, width: number) => {
        if (!this.add?.rectangle) {
          return;
        }

        const centerYPosition = top + height / 2;
        const panel = this.add.rectangle(x, centerYPosition, width, height, zoneFillColor, 0.85);
        panel.setStrokeStyle?.(1, zoneStrokeColor, 0.9);
        panel.setScrollFactor?.(0, 0);
        panel.setDepth?.(zonePanelDepth);
        panel.setVisible?.(false);

        if (this.add?.graphics) {
          const roundedPanel = this.add.graphics();
          const rectX = x - width / 2;
          const rectY = top;
          roundedPanel.fillStyle?.(zoneFillColor, 0.85);
          roundedPanel.lineStyle?.(1, zoneStrokeColor, 0.9);
          roundedPanel.fillRoundedRect?.(rectX, rectY, width, height, zonePanelRadius);
          roundedPanel.strokeRoundedRect?.(rectX, rectY, width, height, zonePanelRadius);
          roundedPanel.setScrollFactor?.(0, 0);
          roundedPanel.setDepth?.(zonePanelDepth);
        }
      };

      const sections: Array<{
        title: string;
        rows: Array<{ keys: string[]; caption: string }>;
        note?: string;
      }> = [
        {
          title: 'Movement',
          rows: [
            { keys: ['← / A'], caption: 'Left' },
            { keys: ['→ / D'], caption: 'Right' },
            { keys: ['Space'], caption: 'Jump' },
          ],
          note: 'Touch',
        },
        {
          title: 'Abilities',
          rows: [
            { keys: ['C', 'S'], caption: 'Inhale' },
            { keys: ['Z', 'X'], caption: 'Spit' },
          ],
        },
        {
          title: 'Menu Shortcuts',
          rows: [
            { keys: ['Esc'], caption: 'Pause' },
            { keys: ['O'], caption: 'Settings' },
            { keys: ['R'], caption: 'Reset' },
          ],
        },
        {
          title: 'Settings Adjustments',
          rows: [
            { keys: ['← / →'], caption: 'Volume' },
            { keys: ['↑ / ↓'], caption: 'Difficulty' },
            { keys: ['C'], caption: 'Controls' },
            { keys: ['Esc'], caption: 'Close' },
          ],
        },
      ];
      const measureSectionHeight = (section: (typeof sections)[number]) =>
        zonePadding * 2 + sectionTitleSpacing + section.rows.length * keycapRowSpacing + (section.note ? noteSpacing : 0);

      const sectionHeights = sections.map(measureSectionHeight);
      const uniformZoneHeight = Math.max(...sectionHeights, 0);
      const totalRows = Math.ceil(sections.length / zoneColumns);
      const rowTopOffsets: number[] = [];
      let nextRowTop = gridTop;
      for (let rowIndex = 0; rowIndex < totalRows; rowIndex += 1) {
        rowTopOffsets[rowIndex] = nextRowTop;
        nextRowTop += uniformZoneHeight + (rowIndex < totalRows - 1 ? zoneRowGap : 0);
      }

      sections.forEach((section, sectionIndex) => {
        const columnIndex = sectionIndex % zoneColumns;
        const rowIndex = Math.floor(sectionIndex / zoneColumns);
        const columnCenter = columnCenters[columnIndex] ?? centerX;
        const zoneTop = rowTopOffsets[rowIndex] ?? gridTop;
        const columnWidthValue = columnWidth - 12;
        let cursorY = zoneTop + zonePadding;

        renderSectionTitle(columnCenter, cursorY, section.title);
        cursorY += sectionTitleSpacing;

        section.rows.forEach(({ keys, caption }) => {
          renderKeycapRow(columnCenter, columnWidthValue, cursorY, keys, caption);
          cursorY += keycapRowSpacing;
        });

        if (section.note) {
          renderSectionNote(columnCenter, cursorY, section.note, columnWidthValue);
          cursorY += noteSpacing;
        }

        renderZonePanel(columnCenter, zoneTop, uniformZoneHeight, columnWidth);
      });
    }

    const startHandler = () => this.startGame();

    this.input?.keyboard?.once?.('keydown-SPACE', startHandler);
    this.input?.on?.('pointerdown', startHandler);
    this.input?.keyboard?.once?.('keydown-O', () => this.openSettings());
    this.input?.keyboard?.once?.('keydown-R', () => this.resetSpawn());
  }

  startGame() {
    this.scene.start(SceneKeys.Game);
  }

  private openSettings() {
    this.scene.launch(SceneKeys.Settings, { returnTo: SceneKeys.Menu });
    this.scene.pause(SceneKeys.Menu);
    this.input?.keyboard?.once?.('keydown-O', () => this.openSettings());
  }

  private resetSpawn() {
    this.saveManager.resetPlayerPosition();
    this.showResetNotice('初期位置をリセットしました');
    this.input?.keyboard?.once?.('keydown-R', () => this.resetSpawn());
  }

  private showResetNotice(message: string) {
    if (!this.add?.text) {
      return;
    }

    this.resetNotice?.destroy?.();
    const width = this.scale?.width ?? 800;
    const height = this.scale?.height ?? 600;
    const centerX = width / 2;
    const centerY = height / 2;
    const notice = this.add.text(centerX, centerY + 180, message, {
      fontSize: '16px',
      color: '#a8ffd0',
      align: 'center',
    });
    notice.setOrigin?.(0.5, 0.5);
    notice.setScrollFactor?.(0, 0);
    notice.setDepth?.(120);
    this.resetNotice = notice;
  }

  private createStartPromptBlink(prompt?: Phaser.GameObjects.Text) {
    if (!prompt || !this.tweens?.add) {
      return;
    }

    this.tweens.add({
      targets: prompt,
      alpha: { from: 1, to: 0 },
      duration: 1200,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });
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
  private enemySpawnPoints: EnemySpawn[] = [];
  private nextEnemySpawnIndex = 0;
  private enemyAutoSpawnTimer = 0;
  private enemyAutoSpawnEnabled = true;
  private enemyBaselinePopulation = 0;
  private enemySpawnPlan?: StageEnemySpawnPlan;
  private nextEnemyTypeIndex = 0;
  private readonly enemyCullingPadding = 96;
  private readonly defaultEnemyManagerConfig = {
    maxActiveEnemies: 3,
    enemyClusterLimit: 2,
    enemySafetyRadius: 96,
    enemySpawnCooldownMs: 10000,
  };
  private enemyManagerConfig = { ...this.defaultEnemyManagerConfig };
  private static readonly PLAYER_SPAWN = { x: 160, y: 360 } as const;
  private physicsSystem?: PhysicsSystem;
  private areaManager?: AreaManager;
  private readonly mapSystem = new MapSystem(STAGE_DEFINITIONS);
  private readonly runTimer = new RunTimer();
  private goalDoorController?: GoalDoorController;
  private mapOverlay?: MapOverlay;
  private mapToggleHandler?: () => void;
  private pauseKeyHandler?: () => void;
  private lastAreaSummaryHash?: string;
  private hud?: Hud;
  private resultsOverlay?: ResultsOverlay;
  private lastHudHp?: HudHPState;
  private lastHudAreaName?: string;
  private readonly playerMaxHP = 6;
  private currentSettings: GameSettingsSnapshot = { ...DEFAULT_SETTINGS };
  private readonly handleSettingsUpdated = (settings?: GameSettingsSnapshot) => {
    if (!this.saveManager) {
      return;
    }

    const resolved =
      settings ??
      this.saveManager.load()?.settings ??
      this.currentSettings;

    if (!resolved) {
      return;
    }

    this.applySettings(resolved);
  };
  private readonly scorePerEnemy = 100;
  private isGameOver = false;
  private runtimeErrorCaptured = false;
  private saveManager?: SaveManager;
  private progressDirty = false;
  private lastSavedTileKey?: string;
  private lastSafePlayerPosition?: Vector2;
  private performanceMonitor?: PerformanceMonitor;
  private readonly performanceRecoveryThresholdFps = 55;
  private audioManager?: AudioManager;
  private terrainColliders: Array<Phaser.Physics.Matter.Image | Phaser.Physics.Matter.Sprite> = [];
  private terrainTiles: Array<Phaser.GameObjects.GameObject & { destroy?: () => void }> = [];
  private terrainTransitionMarkers: Array<Phaser.GameObjects.GameObject & { destroy?: () => void }> = [];
  private cameraFollowConfigured = false;
  private readonly capturedSprites = new Set<Phaser.Physics.Matter.Sprite>();
  private menuBlurEffect?: { destroy?: () => void } | unknown;
  private menuBlurFallback?: Phaser.GameObjects.Image;
  private menuBlurSnapshotPending = false;
  private menuOverlayDepth = 0;
  private readonly playerContactDamage = 1;
  private readonly playerInvulnerabilityDurationMs = 2000;
  private playerInvulnerabilityRemainingMs = 0;
  private readonly healSprites = new Map<string, Phaser.GameObjects.Sprite>();
  private readonly collectibleSprites = new Map<string, Phaser.GameObjects.Sprite>();

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
    const kirdy = this.kirdy;
    if (!kirdy) {
      return;
    }

    const updatedScore = kirdy.addScore(this.scorePerEnemy);
    this.hud?.updateScore(updatedScore);
    this.requestSave();
  };

  private readonly handleEnemyCaptured = (event: { sprite?: Phaser.Physics.Matter.Sprite }) => {
    const sprite = event?.sprite;
    if (!sprite) {
      return;
    }

    this.capturedSprites.add(sprite);
    this.enemyManager?.suspendEnemy(sprite);
    this.physicsSystem?.suspendEnemy(sprite);
  };

  private readonly handleGoalReached = (payload: GoalResultPayload) => {
    this.resultsOverlay?.show(payload);
  };

  private readonly handleEnemyCaptureReleased = (event: { sprite?: Phaser.Physics.Matter.Sprite }) => {
    const sprite = event?.sprite;
    if (!sprite) {
      return;
    }

    const wasCaptured = this.capturedSprites.delete(sprite);
    const destroyed = (sprite as { destroyed?: boolean }).destroyed === true;
    if (!wasCaptured || destroyed) {
      return;
    }

    this.enemyManager?.resumeEnemy(sprite);
    this.physicsSystem?.resumeEnemy(sprite);
  };

  private readonly handleEnemySwallowed = (event: { sprite?: Phaser.Physics.Matter.Sprite }) => {
    const sprite = event?.sprite;
    if (!sprite) {
      return;
    }

    this.capturedSprites.delete(sprite);
    this.enemyManager?.consumeEnemy(sprite);
    this.physicsSystem?.consumeEnemy(sprite);
  };

  private readonly handlePlayerEnemyCollision = (event: PlayerEnemyCollisionEvent) => {
    const kirdy = this.kirdy;
    if (!kirdy) {
      return;
    }

    const sprite = event?.enemy?.sprite;
    if (sprite && this.capturedSprites.has(sprite)) {
      return;
    }

    this.damagePlayer(this.playerContactDamage);
  };

  private tickPlayerInvulnerability(delta: number) {
    if (!Number.isFinite(delta) || delta <= 0) {
      return;
    }

    if (this.playerInvulnerabilityRemainingMs <= 0) {
      return;
    }

    this.playerInvulnerabilityRemainingMs = Math.max(0, this.playerInvulnerabilityRemainingMs - delta);
  }

  private readonly handlePlayerDefeated = () => {
    if (this.isGameOver) {
      return;
    }

    this.isGameOver = true;
    this.activateMenuOverlay();
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

  private applyHudHp(state: HudHPState) {
    if (!this.hud) {
      return;
    }

    this.hud.updateHP(state);
    this.lastHudHp = { current: state.current, max: state.max };
  }

  private applyHudRelics() {
    if (!this.hud) {
      return;
    }

    const collectedItems = this.areaManager?.getCollectedItems?.() ?? [];
    this.hud.updateRelics(collectedItems);
  }

  private updateHudAreaLabel(force = false) {
    if (!this.hud) {
      return;
    }

    const rawName = this.areaManager?.getCurrentAreaState()?.definition.name;
    const trimmedName = typeof rawName === 'string' ? rawName.trim() : '';
    const resolvedName = trimmedName.length > 0 ? trimmedName : 'Unknown';

    if (!force && this.lastHudAreaName === resolvedName) {
      return;
    }

    this.hud.updateMapName(resolvedName);
    this.lastHudAreaName = resolvedName;
  }

  private syncHudHpWithPlayer() {
    if (!this.hud || !this.kirdy) {
      this.lastHudHp = undefined;
      return;
    }

    const current = this.kirdy.getHP();
    const max = this.kirdy.getMaxHP();

    if (!this.lastHudHp || this.lastHudHp.current !== current || this.lastHudHp.max !== max) {
      this.applyHudHp({ current, max });
    }
  }

  public damagePlayer(amount: number) {
    if (!Number.isFinite(amount) || !this.kirdy) {
      return;
    }

    const normalized = Math.max(0, Math.floor(amount));
    if (normalized <= 0) {
      return;
    }

    if (this.playerInvulnerabilityRemainingMs > 0) {
      return;
    }

    const previous = this.kirdy.getHP();
    const current = this.kirdy.takeDamage(normalized);

    if (current === previous) {
      return;
    }

    this.applyHudHp({ current, max: this.kirdy.getMaxHP() });

    this.playerInvulnerabilityRemainingMs = this.playerInvulnerabilityDurationMs;

    if (current <= 0) {
      this.handlePlayerDefeated();
    }

    this.requestSave();
  }

  create() {
    if (this.input) {
      this.input.enabled = true;
      const keyboardPlugin = this.input.keyboard as Phaser.Input.Keyboard.KeyboardPlugin | undefined;
      if (keyboardPlugin) {
        keyboardPlugin.enabled = true;
        keyboardPlugin.resetKeys?.();
        const keyboardManager = (keyboardPlugin as { manager?: Phaser.Input.Keyboard.KeyboardManager }).manager;
        if (keyboardManager) {
          keyboardManager.enabled = true;
          (keyboardManager as { resetKeys?: () => void }).resetKeys?.();
          (keyboardManager as { releaseAllKeys?: () => void }).releaseAllKeys?.();
          (keyboardManager as { clearCaptures?: () => void }).clearCaptures?.();
        }
      }
      const inputExtensions = this.input as unknown as {
        mouse?: { enabled?: boolean };
        touch?: { enabled?: boolean };
      };
      if (inputExtensions.mouse) {
        inputExtensions.mouse.enabled = true;
      }
      if (inputExtensions.touch) {
        inputExtensions.touch.enabled = true;
      }
    }

    const savedProgress = this.initializeSaveManager();

    this.audioManager = new AudioManager(this);
    this.audioManager.playBgm('bgm-main', { volume: 1 });
    this.applySettings(this.currentSettings);
    this.game?.events?.on?.('settings-updated', this.handleSettingsUpdated);

    this.isGameOver = false;
    this.runtimeErrorCaptured = false;
    this.progressDirty = false;
    this.playerInvulnerabilityRemainingMs = 0;
    this.physicsSystem = new PhysicsSystem(this);
    this.performanceMonitor = new PerformanceMonitor({
      sampleWindowMs: 500,
      lowFpsThreshold: 40,
      lowFpsSampleCount: 3,
      onSample: (metrics) => this.handlePerformanceSample(metrics),
      onLowFps: (metrics) => this.handleLowFps(metrics),
    });
    this.runTimer.reset();
    this.runTimer.start();

    const areaSnapshot = savedProgress?.area as AreaManagerSnapshot | undefined;
    const startingAreaId = areaSnapshot?.currentAreaId ?? AREA_IDS.CentralHub;
    this.areaManager = new AreaManager(startingAreaId, undefined, areaSnapshot);
    this.mapOverlay = new MapOverlay(this);
    this.hud = new Hud(this);
    this.updateHudAreaLabel(true);
    this.applyHudRelics();
    this.resultsOverlay = new ResultsOverlay(this, {
      onComplete: (payload) => this.transitionToResults(payload),
    });
    this.events?.once?.('shutdown', () => {
      this.deactivateMenuOverlay({ force: true });
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
      this.events?.off?.('enemy-captured', this.handleEnemyCaptured, this);
      this.events?.off?.('enemy-capture-released', this.handleEnemyCaptureReleased, this);
      this.events?.off?.('enemy-swallowed', this.handleEnemySwallowed, this);
      this.events?.off?.('player-collided-with-enemy', this.handlePlayerEnemyCollision, this);
      this.events?.off?.('goal:reached', this.handleGoalReached, this);
      this.hud?.destroy();
      this.hud = undefined;
      this.resultsOverlay?.destroy();
      this.resultsOverlay = undefined;
      this.lastHudHp = undefined;
      this.lastHudAreaName = undefined;
      this.kirdy = undefined;
      this.goalDoorController = undefined;
      if (this.isGameOver) {
        if (this.saveManager?.clearProgressPreservingSettings) {
          this.saveManager.clearProgressPreservingSettings(this.currentSettings);
        } else {
          this.saveManager?.clear();
        }
      }
      this.isGameOver = false;
      this.saveManager = undefined;
      this.progressDirty = false;
      this.lastSavedTileKey = undefined;
      this.lastSafePlayerPosition = undefined;
      this.performanceMonitor = undefined;
      this.audioManager?.stopBgm();
      this.audioManager = undefined;
    this.game?.events?.off?.('settings-updated', this.handleSettingsUpdated);
    this.capturedSprites.clear();
    this.clearHealSprites();
    this.clearCollectibleSprites();
  });

    this.rebuildTerrainColliders();
    this.buildTerrainVisuals();
    this.scatterDeadEndHeals();

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
      this.lastSafePlayerPosition = { x: spawn.x, y: spawn.y };
      this.physicsSystem?.registerPlayer(this.kirdy);
      this.configureCamera();
    }
    this.playerInput = new PlayerInputManager(this);
    this.playerInput?.setControlScheme?.(this.currentSettings.controls);
    if (this.kirdy) {
      this.inhaleSystem = new InhaleSystem(this, this.kirdy);
      this.swallowSystem = new SwallowSystem(this, this.kirdy, this.inhaleSystem, this.physicsSystem);
      this.abilitySystem = new AbilitySystem(this, this.kirdy, this.physicsSystem, this.audioManager);
    }

    this.initializeEnemyManager();
    this.goalDoorController = new GoalDoorController({
      sceneEvents: this.events,
      getAreaState: () => this.areaManager?.getCurrentAreaState(),
      getPlayerPosition: () => this.getPlayerPosition(),
      getScore: () => this.kirdy?.getScore() ?? 0,
      runTimer: this.runTimer,
    });

    this.events?.on?.('ability-acquired', this.handleAbilityAcquired, this);
    this.events?.on?.('ability-cleared', this.handleAbilityCleared, this);
    this.events?.on?.('enemy-defeated', this.handleEnemyDefeated, this);
    this.events?.on?.('enemy-captured', this.handleEnemyCaptured, this);
    this.events?.on?.('enemy-capture-released', this.handleEnemyCaptureReleased, this);
    this.events?.on?.('enemy-swallowed', this.handleEnemySwallowed, this);
    this.events?.on?.('player-collided-with-enemy', this.handlePlayerEnemyCollision, this);
    this.events?.on?.('goal:reached', this.handleGoalReached, this);

    if (savedProgress?.player.ability) {
      this.abilitySystem?.applySwallowedPayload({ abilityType: savedProgress.player.ability } as SwallowedPayload);
    }

    if (this.kirdy) {
      this.applyHudHp({ current: this.kirdy.getHP(), max: this.kirdy.getMaxHP() });
      this.hud?.updateScore(this.kirdy.getScore());
      this.hud?.updateAbility(this.kirdy.getAbility());
    } else {
      this.applyHudHp({ current: this.playerMaxHP, max: this.playerMaxHP });
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

  private applyMenuBlur() {
    if (this.menuBlurEffect || this.menuBlurFallback || this.menuBlurSnapshotPending) {
      return;
    }

    const camera = (this.cameras as {
      main?: {
        postFX?: {
          addBlur?: (...args: number[]) => unknown;
        };
      };
    } | undefined)?.main;
    const postFX = camera?.postFX;
    const addBlur = postFX?.addBlur;

    if (!postFX || typeof addBlur !== 'function') {
      this.createMenuBlurFallback();
      return;
    }

    let effect: unknown;

    try {
      effect = addBlur.call(postFX, 4, 1, 2);
    } catch (error) {
      console.warn?.('[GameScene] failed to add menu blur', error);
      this.createMenuBlurFallback();
      return;
    }

    if (!effect) {
      this.createMenuBlurFallback();
      return;
    }

    this.menuBlurEffect = effect as { destroy?: () => void } | unknown;
  }

  private clearMenuBlur() {
    const camera = (this.cameras as {
      main?: {
        postFX?: {
          remove?: (effect: unknown) => void;
          clear?: () => void;
        };
      };
    } | undefined)?.main;
    const postFX = camera?.postFX;
    const effect = this.menuBlurEffect;

    if (effect) {
      if (typeof postFX?.remove === 'function') {
        postFX.remove(effect);
      } else {
        const destroy = (effect as { destroy?: () => void })?.destroy;
        if (typeof destroy === 'function') {
          destroy.call(effect as { destroy: () => void });
        } else if (typeof postFX?.clear === 'function') {
          postFX.clear();
        }
      }
    }

    this.menuBlurEffect = undefined;
    this.destroyMenuBlurFallback();
  }

  private createMenuBlurFallback() {
    if (this.menuBlurFallback || this.menuBlurSnapshotPending) {
      return;
    }

    const renderer = this.game?.renderer as { snapshot?: (callback: (snapshot: CanvasImageSource) => void) => void } | undefined;
    const snapshot = renderer?.snapshot;
    if (typeof snapshot !== 'function') {
      return;
    }

    const width = typeof this.scale?.width === 'number' ? this.scale.width : 0;
    const height = typeof this.scale?.height === 'number' ? this.scale.height : 0;
    if (width <= 0 || height <= 0) {
      return;
    }

    this.menuBlurSnapshotPending = true;
    snapshot((raw) => {
      this.menuBlurSnapshotPending = false;

      if (this.menuOverlayDepth <= 0) {
        return;
      }

      const canvas = this.buildBlurredSnapshotCanvas(raw, width, height);
      if (!canvas) {
        return;
      }

      try {
        this.textures?.remove?.(MENU_BLUR_FALLBACK_TEXTURE_KEY);
      } catch {
        // ignore missing texture removal errors
      }

      this.textures?.addCanvas?.(MENU_BLUR_FALLBACK_TEXTURE_KEY, canvas);

      const fallbackImage = this.add?.image?.(width / 2, height / 2, MENU_BLUR_FALLBACK_TEXTURE_KEY);
      if (!fallbackImage) {
        return;
      }

      fallbackImage.setScrollFactor?.(0, 0);
      fallbackImage.setDepth?.(1995);
      fallbackImage.setAlpha?.(0.92);
      this.menuBlurFallback = fallbackImage as Phaser.GameObjects.Image;
    });
  }

  private buildBlurredSnapshotCanvas(raw: CanvasImageSource, width: number, height: number) {
    if (typeof document === 'undefined') {
      return undefined;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      return undefined;
    }

    context.filter = 'blur(6px)';
    try {
      context.drawImage(raw, 0, 0, width, height);
    } catch {
      return undefined;
    }

    return canvas;
  }

  private destroyMenuBlurFallback() {
    this.menuBlurFallback?.destroy?.();
    this.menuBlurFallback = undefined;
    this.menuBlurSnapshotPending = false;
    try {
      this.textures?.remove?.(MENU_BLUR_FALLBACK_TEXTURE_KEY);
    } catch {
      // ignore cleanup failures
    }
  }

  activateMenuOverlay() {
    this.menuOverlayDepth += 1;
    if (this.menuOverlayDepth === 1) {
      this.applyMenuBlur();
    }
  }

  deactivateMenuOverlay({ force = false }: { force?: boolean } = {}) {
    if (force) {
      this.menuOverlayDepth = 0;
    } else if (this.menuOverlayDepth > 0) {
      this.menuOverlayDepth -= 1;
    }

    if (this.menuOverlayDepth === 0) {
      this.clearMenuBlur();
    }
  }

  pauseGame() {
    this.activateMenuOverlay();
    this.scene.pause(SceneKeys.Game);
    this.scene.launch(SceneKeys.Pause);
  }

  private transitionToResults(payload: GoalResultPayload) {
    this.deactivateMenuOverlay({ force: true });
    this.scene.start(SceneKeys.Results, payload);
  }

  update(time: number, delta: number) {
    if (this.runtimeErrorCaptured) {
      return;
    }

    if (this.menuOverlayDepth > 0) {
      return;
    }

    try {
      this.performanceMonitor?.update(delta);
      this.tickPlayerInvulnerability(delta);

      const snapshot = this.playerInput?.update();
      if (!snapshot) {
        return;
      }

      this.latestInput = snapshot;
      this.kirdy?.update?.(time, delta, snapshot.kirdy);
      this.inhaleSystem?.update(snapshot.actions);
      this.swallowSystem?.update(snapshot.actions);
      const hasMouthContent = Boolean(this.kirdy?.getMouthContent?.());
      this.playerInput?.setSwallowDownEnabled?.(hasMouthContent);

      const payload = this.swallowSystem?.consumeSwallowedPayload();
      if (payload) {
        this.abilitySystem?.applySwallowedPayload(payload);
      }

      this.abilitySystem?.update(snapshot.actions);
      this.enemyManager?.update(delta);
      this.maintainEnemyPopulation(delta);
      this.goalDoorController?.update();
      this.updateAreaState();
      this.syncHudHpWithPlayer();
      this.checkHealItemPickup();
      this.checkCollectiblePickup();

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

  spawnFrostWabble(spawn: EnemySpawn, options: WabbleBeeOptions = {}) {
    return this.enemyManager?.spawnFrostWabble(spawn, options);
  }

  spawnDrontoDurt(spawn: EnemySpawn, options: DrontoDurtOptions = {}) {
    return this.enemyManager?.spawnDrontoDurt(spawn, options);
  }

  spawnGlacioDurt(spawn: EnemySpawn, options: DrontoDurtOptions = {}) {
    return this.enemyManager?.spawnGlacioDurt(spawn, options);
  }

  spawnVineHopper(spawn: EnemySpawn) {
    return this.enemyManager?.spawnVineHopper(spawn);
  }

  spawnThornRoller(spawn: EnemySpawn) {
    return this.enemyManager?.spawnThornRoller(spawn);
  }

  spawnSapSpitter(spawn: EnemySpawn) {
    return this.enemyManager?.spawnSapSpitter(spawn);
  }

  spawnChillWisp(spawn: EnemySpawn) {
    return this.enemyManager?.spawnChillWisp(spawn);
  }

  spawnGlacierGolem(spawn: EnemySpawn) {
    return this.enemyManager?.spawnGlacierGolem(spawn);
  }

  spawnFrostArcher(spawn: EnemySpawn) {
    return this.enemyManager?.spawnFrostArcher(spawn);
  }

  spawnEmberImp(spawn: EnemySpawn) {
    return this.enemyManager?.spawnEmberImp(spawn);
  }

  spawnMagmaCrab(spawn: EnemySpawn) {
    return this.enemyManager?.spawnMagmaCrab(spawn);
  }

  spawnBlazeStrider(spawn: EnemySpawn) {
    return this.enemyManager?.spawnBlazeStrider(spawn);
  }

  spawnStoneSentinel(spawn: EnemySpawn) {
    return this.enemyManager?.spawnStoneSentinel(spawn);
  }

  spawnCurseBat(spawn: EnemySpawn) {
    return this.enemyManager?.spawnCurseBat(spawn);
  }

  spawnRelicThief(spawn: EnemySpawn) {
    return this.enemyManager?.spawnRelicThief(spawn);
  }

  spawnGaleKite(spawn: EnemySpawn) {
    return this.enemyManager?.spawnGaleKite(spawn);
  }

  spawnNimbusKnight(spawn: EnemySpawn) {
    return this.enemyManager?.spawnNimbusKnight(spawn);
  }

  spawnPrismWraith(spawn: EnemySpawn) {
    return this.enemyManager?.spawnPrismWraith(spawn);
  }

  private initializeEnemyManager() {
    if (!this.inhaleSystem || !this.physicsSystem) {
      return;
    }

    const areaState = this.areaManager?.getCurrentAreaState();
    this.enemySpawnPlan = this.buildEnemySpawnPlan(areaState?.definition?.enemySpawns);
    this.nextEnemyTypeIndex = 0;

    // 中央ハブやゴールサンクタムなど、敵スポーン設定がない/無効なエリアでは自動スポーンを止める
    const shouldAutoSpawn =
      !!this.enemySpawnPlan && this.enemySpawnPlan.baseline > 0 && this.enemySpawnPlan.entries.length > 0;
    this.enemyAutoSpawnEnabled = shouldAutoSpawn;

    if (!shouldAutoSpawn) {
      this.enemyBaselinePopulation = 0;
      this.enemySpawnPoints = [];
      this.enemyManager?.destroy();
      this.enemyManager = undefined;
      return;
    }

    this.enemyManagerConfig = this.createEnemyManagerConfig(this.enemySpawnPlan);

    this.enemyManager = new EnemyManager({
      scene: this,
      inhaleSystem: this.inhaleSystem,
      physicsSystem: this.physicsSystem,
      getPlayerPosition: () => this.getPlayerPosition(),
      getCullingBounds: () => this.getCullingBounds(),
      config: this.enemyManagerConfig,
    });

    this.enemyManager.resetSpawnCooldown();
    this.enemySpawnPoints = this.collectInitialEnemySpawns();
    const spawnCapacity = this.enemySpawnPoints.length;
    const plannedBaseline = this.enemySpawnPlan?.baseline ?? this.enemyManagerConfig.maxActiveEnemies;
    this.enemyBaselinePopulation = Math.min(
      this.enemyManagerConfig.maxActiveEnemies,
      spawnCapacity,
      plannedBaseline,
    );
    this.nextEnemySpawnIndex = 0;
    this.enemyAutoSpawnTimer = 0;
  }

  private collectInitialEnemySpawns(): EnemySpawn[] {
    const areaState = this.areaManager?.getCurrentAreaState();
    const tileMap = areaState?.tileMap as Partial<{
      tileSize: number;
      columns: number;
      rows: number;
      getTileAt: (column: number, row: number) => string | undefined;
    }>;

    const tileSize = Number.isFinite(tileMap?.tileSize) ? (tileMap!.tileSize as number) : 32;
    const columns = Number.isFinite(tileMap?.columns) ? (tileMap!.columns as number) : 0;
    const rows = Number.isFinite(tileMap?.rows) ? (tileMap!.rows as number) : 0;
    const getTileAt =
      typeof tileMap?.getTileAt === 'function' ? tileMap!.getTileAt!.bind(tileMap) : undefined;

    if (!getTileAt || tileSize <= 0 || columns <= 0 || rows <= 0) {
      return [];
    }

    const reference = areaState?.playerSpawnPosition ?? GameScene.PLAYER_SPAWN;
    const referencePosition = {
      x: Number.isFinite(reference?.x) ? (reference!.x as number) : GameScene.PLAYER_SPAWN.x,
      y: Number.isFinite(reference?.y) ? (reference!.y as number) : GameScene.PLAYER_SPAWN.y,
    };

    const safetyRadius = this.enemyManagerConfig.enemySafetyRadius;
    const safetyRadiusSq = safetyRadius * safetyRadius;
    const minSeparationSq = Math.max(1, Math.floor(safetyRadiusSq / 2));

    const neighborOffsets = [
      { dx: 0, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ] as const;

    const isWalkableTile = (tile: string | undefined) => tile === 'floor' || tile === 'door';

    const candidates: Array<{ spawn: EnemySpawn; distanceSq: number }> = [];

    for (let row = 1; row < rows - 1; row += 1) {
      for (let column = 1; column < columns - 1; column += 1) {
        const tile = getTileAt(column, row);
        if (tile !== 'floor') {
          continue;
        }

        const hasBlockingNeighbor = neighborOffsets.some(({ dx, dy }) => {
          const neighbor = getTileAt(column + dx, row + dy);
          return !isWalkableTile(neighbor);
        });

        if (hasBlockingNeighbor) {
          continue;
        }

        const spawnX = column * tileSize + tileSize / 2;
        const spawnY = row * tileSize + tileSize / 2;
        const dx = spawnX - referencePosition.x;
        const dy = spawnY - referencePosition.y;
        const distanceSq = dx * dx + dy * dy;

        if (distanceSq < safetyRadiusSq) {
          continue;
        }

        candidates.push({
          spawn: { x: spawnX, y: spawnY },
          distanceSq,
        });
      }
    }

    if (candidates.length === 0) {
      return [];
    }

    candidates.sort((a, b) => b.distanceSq - a.distanceSq);

    const spawns: EnemySpawn[] = [];

    candidates.forEach(({ spawn }) => {
      const overlaps = spawns.some((existing) => {
        const dx = existing.x - spawn.x;
        const dy = existing.y - spawn.y;
        return dx * dx + dy * dy < minSeparationSq;
      });

      if (overlaps) {
        return;
      }

      spawns.push(spawn);
    });

    const filtered = this.filterDoorUnsafeSpawns(spawns, tileSize, areaState?.definition?.id);
    return filtered.slice(0, this.enemyManagerConfig.maxActiveEnemies);
  }

  private scatterDeadEndHeals() {
    const areaId = this.areaManager?.getCurrentAreaState()?.definition.id;
    if (!areaId) {
      this.clearHealSprites();
      this.clearCollectibleSprites();
      return;
    }

    this.mapSystem.scatterDeadEndHeals(areaId);
    this.syncHealItemsWithScene(areaId);

    this.mapSystem.registerCollectibles(areaId, (itemId) => this.areaManager?.hasCollectedItem(itemId) ?? false);
    this.syncCollectiblesWithScene(areaId);
  }

  private filterDoorUnsafeSpawns(spawns: EnemySpawn[], tileSize: number, areaId?: AreaId | null): EnemySpawn[] {
    if (!areaId || spawns.length === 0) {
      return spawns;
    }

    const spawnTiles: SpawnTile[] = spawns.map((spawn) => ({
      column: Math.max(0, Math.floor(spawn.x / tileSize)),
      row: Math.max(0, Math.floor(spawn.y / tileSize)),
      x: spawn.x,
      y: spawn.y,
    }));

    const constrained = this.mapSystem.enforceDoorSpawnConstraints(areaId, spawnTiles);
    if (constrained.length === spawns.length) {
      return spawns;
    }

    return constrained.map(({ x, y }) => ({ x, y } satisfies EnemySpawn));
  }

  private syncHealItemsWithScene(areaId?: AreaId | null) {
    const targetAreaId = areaId ?? this.areaManager?.getCurrentAreaState()?.definition.id;
    if (!targetAreaId) {
      this.clearHealSprites();
      return;
    }

    const activeHeals = this.mapSystem.getActiveHealItems(targetAreaId);
    const activeIds = new Set(activeHeals.map((heal) => heal.id));

    this.healSprites.forEach((sprite, healId) => {
      if (!activeIds.has(healId)) {
        sprite.destroy?.();
        this.healSprites.delete(healId);
      }
    });

    activeHeals.forEach((heal) => {
      if (this.healSprites.has(heal.id)) {
        return;
      }

      const sprite = this.add?.sprite?.(heal.position.x, heal.position.y, 'heal-orb');
      sprite?.setDepth?.(900);
      sprite?.setScrollFactor?.(1, 1);
      sprite?.setOrigin?.(0.5);
      sprite?.setData?.('heal-id', heal.id);

      if (sprite) {
        this.healSprites.set(heal.id, sprite as Phaser.GameObjects.Sprite);
      }
    });
  }

  private clearHealSprites() {
    this.healSprites.forEach((sprite) => sprite.destroy?.());
    this.healSprites.clear();
  }

  private syncCollectiblesWithScene(areaId?: AreaId | null) {
    const targetAreaId = areaId ?? this.areaManager?.getCurrentAreaState()?.definition.id;
    if (!targetAreaId) {
      this.clearCollectibleSprites();
      return;
    }

    const activeCollectibles = this.mapSystem.getActiveCollectibles(targetAreaId);
    const activeIds = new Set(activeCollectibles.map((item) => item.id));

    this.collectibleSprites.forEach((sprite, collectibleId) => {
      if (!activeIds.has(collectibleId)) {
        sprite.destroy?.();
        this.collectibleSprites.delete(collectibleId);
      }
    });

    activeCollectibles.forEach((collectible) => {
      if (this.collectibleSprites.has(collectible.id)) {
        return;
      }

      const textureKey = resolveCollectibleTextureKey(collectible.itemId);
      const sprite = this.add?.sprite?.(collectible.position.x, collectible.position.y, textureKey);
      sprite?.setDepth?.(950);
      sprite?.setScrollFactor?.(1, 1);
      sprite?.setOrigin?.(0.5);
      sprite?.setData?.('collectible-id', collectible.id);

      if (sprite) {
        this.collectibleSprites.set(collectible.id, sprite as Phaser.GameObjects.Sprite);
      }
    });
  }

  private clearCollectibleSprites() {
    this.collectibleSprites.forEach((sprite) => sprite.destroy?.());
    this.collectibleSprites.clear();
  }

  private checkHealItemPickup() {
    const kirdy = this.kirdy;
    if (!kirdy) {
      return;
    }

    const areaId = this.areaManager?.getCurrentAreaState()?.definition.id;
    if (!areaId) {
      return;
    }

    const playerPosition = this.getPlayerPosition();
    if (!playerPosition) {
      return;
    }

    const tileSize = this.areaManager?.getCurrentAreaState()?.definition.tileSize ?? 32;
    const pickupRadius = tileSize * 0.6;
    const pickupRadiusSq = pickupRadius * pickupRadius;

    this.healSprites.forEach((sprite, healId) => {
      if (!sprite) {
        return;
      }

      const dx = (sprite.x ?? 0) - playerPosition.x;
      const dy = (sprite.y ?? 0) - playerPosition.y;
      if (dx * dx + dy * dy > pickupRadiusSq) {
        return;
      }

      const consumed = this.mapSystem.consumeHeal(areaId, healId);
      if (!consumed) {
        return;
      }

      sprite.destroy?.();
      this.healSprites.delete(healId);

      const previousHp = kirdy.getHP();
      const currentHp = kirdy.heal(1);
      if (currentHp !== previousHp) {
        this.applyHudHp({ current: currentHp, max: kirdy.getMaxHP() });
      }
    });
  }

  private checkCollectiblePickup() {
    const kirdy = this.kirdy;
    if (!kirdy) {
      return;
    }

    const areaId = this.areaManager?.getCurrentAreaState()?.definition.id;
    if (!areaId) {
      return;
    }

    const playerPosition = this.getPlayerPosition();
    if (!playerPosition) {
      return;
    }

    const tileSize = this.areaManager?.getCurrentAreaState()?.definition.tileSize ?? 32;
    const pickupRadius = tileSize * 0.6;
    const pickupRadiusSq = pickupRadius * pickupRadius;

    this.collectibleSprites.forEach((sprite, collectibleId) => {
      if (!sprite) {
        return;
      }

      const dx = (sprite.x ?? 0) - playerPosition.x;
      const dy = (sprite.y ?? 0) - playerPosition.y;
      if (dx * dx + dy * dy > pickupRadiusSq) {
        return;
      }

      const collected = this.mapSystem.collectCollectible(areaId, collectibleId);
      if (!collected) {
        return;
      }

      sprite.destroy?.();
      this.collectibleSprites.delete(collectibleId);
      this.areaManager?.recordCollectibleItem(collected.itemId);
      this.applyHudRelics();
      this.requestSave();
    });
  }

  private buildEnemySpawnPlan(config?: AreaEnemySpawnConfig | null): StageEnemySpawnPlan | undefined {
    if (!config) {
      return undefined;
    }

    const entries = (config.entries ?? [])
      .map((entry) => ({
        type: entry.type,
        limit: Math.max(0, Math.floor(entry.limit ?? 0)),
      }))
      .filter((entry) => entry.limit > 0);

    if (entries.length === 0) {
      return undefined;
    }

    const totalLimit = entries.reduce((sum, entry) => sum + entry.limit, 0);
    if (totalLimit <= 0) {
      return undefined;
    }

    const requestedBaseline = Math.max(0, Math.floor(config.baseline ?? 0));
    const requestedMaxActive = Math.max(0, Math.floor(config.maxActive ?? requestedBaseline));
    if (requestedBaseline <= 0 || requestedMaxActive <= 0) {
      return undefined;
    }

    const sanitizedMaxActive = Math.max(1, Math.min(totalLimit, requestedMaxActive));
    const sanitizedBaseline = Math.max(1, Math.min(totalLimit, Math.min(requestedBaseline, sanitizedMaxActive)));

    return {
      baseline: sanitizedBaseline,
      maxActive: sanitizedMaxActive,
      entries,
    };
  }

  private createEnemyManagerConfig(plan?: StageEnemySpawnPlan) {
    const maxActive = Math.max(1, plan?.maxActive ?? this.defaultEnemyManagerConfig.maxActiveEnemies);
    const clusterLimit = Math.min(this.defaultEnemyManagerConfig.enemyClusterLimit, maxActive);
    return {
      ...this.defaultEnemyManagerConfig,
      maxActiveEnemies: maxActive,
      enemyClusterLimit: clusterLimit,
    };
  }

  private spawnEnemyAccordingToPlan(spawn: EnemySpawn) {
    if (!this.enemySpawnPlan || this.enemySpawnPlan.entries.length === 0) {
      return this.spawnWabbleBee(spawn);
    }

    if (!this.enemyManager) {
      return undefined;
    }

    const totalTypes = this.enemySpawnPlan.entries.length;
    for (let offset = 0; offset < totalTypes; offset += 1) {
      const index = (this.nextEnemyTypeIndex + offset) % totalTypes;
      const entry = this.enemySpawnPlan.entries[index];
      const activeCount = this.enemyManager.getActiveEnemyCountByType(entry.type);
      if (activeCount >= entry.limit) {
        continue;
      }

      const enemy = this.spawnEnemyByType(entry.type, spawn);
      if (enemy) {
        this.nextEnemyTypeIndex = index + 1;
        return enemy;
      }
    }

    return undefined;
  }

  private spawnEnemyByType(type: EnemyType, spawn: EnemySpawn) {
    switch (type) {
      case 'frost-wabble':
        return this.spawnFrostWabble(spawn);
      case 'glacio-durt':
        return this.spawnGlacioDurt(spawn);
      case 'dronto-durt':
        return this.spawnDrontoDurt(spawn);
      case 'vine-hopper':
        return this.spawnVineHopper(spawn);
      case 'thorn-roller':
        return this.spawnThornRoller(spawn);
      case 'sap-spitter':
        return this.spawnSapSpitter(spawn);
      case 'chill-wisp':
        return this.spawnChillWisp(spawn);
      case 'glacier-golem':
        return this.spawnGlacierGolem(spawn);
      case 'frost-archer':
        return this.spawnFrostArcher(spawn);
      case 'ember-imp':
        return this.spawnEmberImp(spawn);
      case 'magma-crab':
        return this.spawnMagmaCrab(spawn);
      case 'blaze-strider':
        return this.spawnBlazeStrider(spawn);
      case 'stone-sentinel':
        return this.spawnStoneSentinel(spawn);
      case 'curse-bat':
        return this.spawnCurseBat(spawn);
      case 'relic-thief':
        return this.spawnRelicThief(spawn);
      case 'gale-kite':
        return this.spawnGaleKite(spawn);
      case 'nimbus-knight':
        return this.spawnNimbusKnight(spawn);
      case 'prism-wraith':
        return this.spawnPrismWraith(spawn);
      case 'wabble-bee':
      default:
        return this.spawnWabbleBee(spawn);
    }
  }

  private maintainEnemyPopulation(delta: number) {
    if (!this.enemyManager || !this.enemyAutoSpawnEnabled) {
      return;
    }

    if (Number.isFinite(delta) && delta > 0) {
      this.enemyAutoSpawnTimer = Math.max(0, this.enemyAutoSpawnTimer - delta);
    }

    if (this.enemySpawnPoints.length === 0) {
      return;
    }

    const baseline = this.enemyBaselinePopulation;
    if (baseline <= 0) {
      return;
    }

    let activeCount = this.enemyManager.getActiveEnemyCount();
    if (activeCount >= baseline) {
      return;
    }

    if (this.enemyAutoSpawnTimer > 0) {
      return;
    }

    let spawned = 0;

    while (activeCount < baseline) {
      const spawn = this.selectNextEnemySpawn();
      if (!spawn) {
        break;
      }

      const enemy = this.spawnEnemyAccordingToPlan(spawn);
      if (!enemy) {
        break;
      }

      spawned += 1;
      activeCount += 1;
      this.enemyManager.resetSpawnCooldown();
    }

    if (spawned > 0) {
      const needsMore = activeCount < baseline;
      this.enemyAutoSpawnTimer = needsMore
        ? Math.max(200, Math.floor(this.enemyManagerConfig.enemySpawnCooldownMs / 3))
        : this.enemyManagerConfig.enemySpawnCooldownMs;
      return;
    }

    const retryDelay = Math.max(200, Math.floor(this.enemyManagerConfig.enemySpawnCooldownMs / 3));
    this.enemyAutoSpawnTimer = retryDelay;
  }

  private selectNextEnemySpawn(): EnemySpawn | undefined {
    if (this.enemySpawnPoints.length === 0) {
      return undefined;
    }

    const startIndex = this.nextEnemySpawnIndex % this.enemySpawnPoints.length;

    for (let offset = 0; offset < this.enemySpawnPoints.length; offset += 1) {
      const index = (startIndex + offset) % this.enemySpawnPoints.length;
      const spawn = this.enemySpawnPoints[index];
      this.nextEnemySpawnIndex = index + 1;
      return spawn;
    }

    return undefined;
  }

  setEnemyAutoSpawnEnabled(enabled: boolean) {
    this.enemyAutoSpawnEnabled = Boolean(enabled);
    if (this.enemyAutoSpawnEnabled && this.enemyAutoSpawnTimer > this.enemyManagerConfig.enemySpawnCooldownMs) {
      this.enemyAutoSpawnTimer = this.enemyManagerConfig.enemySpawnCooldownMs;
    }
  }

  private updateAreaState() {
    if (!this.areaManager || !this.kirdy) {
      return;
    }

    const playerPosition = this.getPlayerPosition();
    if (!playerPosition) {
      return;
    }

    this.recordSafePlayerPosition(playerPosition);

    const result = this.areaManager.updatePlayerPosition(playerPosition);

    if (result.areaChanged && result.transition) {
      const { entryPosition } = result.transition;
      this.kirdy.sprite.setPosition?.(entryPosition.x, entryPosition.y);
      this.kirdy.sprite.setVelocity?.(0, 0);
      if (this.kirdy.sprite.body) {
        const body = this.kirdy.sprite.body as { position?: { x?: number; y?: number }; velocity?: { x?: number; y?: number } };
        if (body.position) {
          body.position.x = entryPosition.x;
          body.position.y = entryPosition.y;
        }
        if (body.velocity) {
          body.velocity.x = 0;
          body.velocity.y = 0;
        }
      }
      this.lastSafePlayerPosition = { x: entryPosition.x, y: entryPosition.y };
    }

    if (result.areaChanged) {
      this.rebuildTerrainColliders();
      this.buildTerrainVisuals();
      this.scatterDeadEndHeals();
      this.configureCamera();
      this.initializeEnemyManager();
      this.goalDoorController?.handleAreaChanged();
      this.updateHudAreaLabel();
    }

    this.trackExplorationProgress(result.areaChanged);

    if (!result.areaChanged) {
      this.enforceWalkablePlayerPosition();
    }

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

  private collectDoorTiles(): TerrainTilePlacement[] {
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

    const doorMetadata = new Map<
      string,
      { type: 'standard' | 'goal'; direction?: AreaTransitionDirection; target?: AreaId }
    >();
    const definitionDoors = areaState?.definition?.doors ?? [];
    definitionDoors.forEach((door) => {
      const key = `${door.tile.column},${door.tile.row}`;
      doorMetadata.set(key, { type: door.type, direction: door.direction, target: door.target });
    });

    const placements: TerrainTilePlacement[] = [];
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const tile = getTileAt(column, row);
        if (tile !== 'door') {
          continue;
        }

        const centerX = column * tileSize + tileSize / 2;
        const centerY = row * tileSize + tileSize / 2;
        const key = `${column},${row}`;
        const metadata = doorMetadata.get(key);
        placements.push({
          column,
          row,
          centerX,
          centerY,
          tileSize,
          doorType: metadata?.type,
          doorTargetId: metadata?.target,
          doorDirection: metadata?.direction,
        });
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

    const wallPlacements = this.collectWallTiles();
    const doorPlacements = this.collectDoorTiles();
    const areaState = this.areaManager?.getCurrentAreaState();

    const textureManager = this.textures as TextureManagerLike;
    const areaCluster = areaState?.definition?.metadata?.cluster;
    const resolvedWallTextureKey = selectWallTextureForArea(textureManager, areaCluster);
    const doorTextureAvailable = Boolean(textureManager?.exists?.(DOOR_TEXTURE_KEY));
    const goalDoorTextureAvailable = Boolean(textureManager?.exists?.(GOAL_DOOR_TEXTURE_KEY));
    const lockedDoorTextureAvailable = Boolean(textureManager?.exists?.(LOCKED_DOOR_TEXTURE_KEY));
    const currentAreaId = areaState?.definition?.id;
    const hasAllBranchRelics = this.areaManager?.hasCollectedAllBranchRelics?.();

    wallPlacements.forEach(({ centerX, centerY, tileSize }) => {
      let visual: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle | undefined = undefined;

      if (resolvedWallTextureKey) {
        try {
          visual = displayFactory.image?.(
            centerX,
            centerY,
            resolvedWallTextureKey,
          ) as Phaser.GameObjects.Image | undefined;
        } catch (_error) {
          visual = undefined;
        }
      }

      if (!visual && displayFactory.rectangle) {
        visual = displayFactory.rectangle(centerX, centerY, tileSize, tileSize, 0x4a4a4a, 1) as
          | Phaser.GameObjects.Rectangle
          | undefined;
      }

      if (!visual) {
        return;
      }

      visual.setOrigin?.(0.5, 0.5);
      visual.setDepth?.(TERRAIN_VISUAL_DEPTH);
      visual.setDisplaySize?.(tileSize, tileSize);
      visual.setVisible?.(true);

      this.terrainTiles.push(visual as Phaser.GameObjects.GameObject & { destroy?: () => void });
    });

    doorPlacements.forEach(({ centerX, centerY, tileSize, doorType, doorDirection, doorTargetId }) => {
      let marker: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image | undefined;
      let usedDoorTexture = false;

      const isLockedDoor =
        hasAllBranchRelics === false &&
        ((currentAreaId === AREA_IDS.CentralHub &&
          doorDirection === 'north' &&
          doorTargetId === AREA_IDS.MirrorCorridor) ||
          (currentAreaId === AREA_IDS.GoalSanctum &&
            doorDirection === 'north' &&
            doorTargetId === AREA_IDS.SkySanctum));

      const shouldUseLockedTexture = isLockedDoor;
      const shouldUseGoalTexture = !shouldUseLockedTexture && doorType === 'goal' && goalDoorTextureAvailable;
      const textureKey = shouldUseLockedTexture
        ? LOCKED_DOOR_TEXTURE_KEY
        : shouldUseGoalTexture
          ? GOAL_DOOR_TEXTURE_KEY
          : DOOR_TEXTURE_KEY;
      const textureAvailable = shouldUseLockedTexture
        ? lockedDoorTextureAvailable
        : shouldUseGoalTexture
          ? goalDoorTextureAvailable
          : doorTextureAvailable;
      if (textureAvailable) {
        try {
          marker = displayFactory.image?.(
            centerX,
            centerY,
            textureKey,
          ) as Phaser.GameObjects.Image | undefined;
          usedDoorTexture = Boolean(marker);
        } catch (_error) {
          marker = undefined;
          usedDoorTexture = false;
        }
      }

      if (!marker) {
        try {
          const fillColor =
            doorType === 'goal'
              ? GOAL_DOOR_MARKER_COLOR
              : shouldUseLockedTexture
                ? LOCKED_DOOR_MARKER_COLOR
                : DOOR_MARKER_COLOR;
          const fillAlpha =
            doorType === 'goal' ? 0.95 : shouldUseLockedTexture ? 1 : DOOR_MARKER_ALPHA;
          marker = displayFactory.rectangle?.(
            centerX,
            centerY,
            tileSize,
            tileSize,
            fillColor,
            fillAlpha,
          ) as Phaser.GameObjects.Rectangle | undefined;
        } catch (_error) {
          marker = undefined;
        }
      }

      if (!marker) {
        return;
      }

      marker.setOrigin?.(0.5, 0.5);
      marker.setDepth?.(DOOR_MARKER_DEPTH);
      marker.setDisplaySize?.(tileSize, tileSize);
      marker.setVisible?.(true);
      marker.setActive?.(true);

      if (!usedDoorTexture) {
        const alpha = doorType === 'goal' ? 0.95 : shouldUseLockedTexture ? 1 : DOOR_MARKER_ALPHA;
        marker.setAlpha?.(alpha);
      }

      this.terrainTransitionMarkers.push(
        marker as Phaser.GameObjects.GameObject & { destroy?: () => void },
      );
    });
  }

  private destroyTerrainVisuals() {
    this.terrainTiles.forEach((tile) => {
      tile.destroy?.();
    });
    this.terrainTiles = [];
    this.terrainTransitionMarkers.forEach((marker) => {
      marker.destroy?.();
    });
    this.terrainTransitionMarkers = [];
  }

  private rebuildTerrainColliders() {
    this.destroyTerrainColliders();

    if (!this.physicsSystem) {
      return;
    }

    const areaState = this.areaManager?.getCurrentAreaState();
    const displayFactory = this.add;
    const matterFactory = this.matter?.add;
    if (!areaState || !displayFactory?.rectangle || !matterFactory) {
      return;
    }

    const matterMethods = matterFactory as unknown as {
      gameObject?: (
        displayObject: Phaser.GameObjects.GameObject,
        options?: Phaser.Types.Physics.Matter.MatterBodyConfig,
      ) => Phaser.GameObjects.GameObject;
      existing?: (
        displayObject: Phaser.GameObjects.GameObject,
        options?: Phaser.Types.Physics.Matter.MatterBodyConfig,
      ) => Phaser.GameObjects.GameObject;
    };

    if (!matterMethods.gameObject && !matterMethods.existing) {
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

      const rawMatterObject =
        matterMethods.gameObject?.call(matterFactory, rectangle, { isStatic: true }) ??
        matterMethods.existing?.call(matterFactory, rectangle, { isStatic: true });

      const matterObject = rawMatterObject as
        | (Phaser.Physics.Matter.Image & { body?: { gameObject?: any } })
        | (Phaser.Physics.Matter.Sprite & { body?: { gameObject?: any } })
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

      const terrainCollider = matterObject as Phaser.Physics.Matter.Image | Phaser.Physics.Matter.Sprite;

      terrainCollider.setStatic?.(true);
      terrainCollider.setIgnoreGravity?.(true);
      terrainCollider.setDepth?.(0);
      terrainCollider.setName?.('Terrain');

      this.physicsSystem!.registerTerrain(terrainCollider as any);
      this.terrainColliders.push(terrainCollider);
    });
  }

  private destroyTerrainColliders() {
    this.destroyTerrainVisuals();
    this.terrainColliders.forEach((collider) => {
      collider.destroy?.();
    });
    this.terrainColliders = [];
    this.physicsSystem?.clearTerrain();
  }

  private configureCamera() {
    const camera = this.cameras?.main as Partial<Phaser.Cameras.Scene2D.Camera> | undefined;
    const sprite = this.kirdy?.sprite;
    if (!camera || !sprite) {
      return;
    }

    const width = this.scale?.width ?? 800;
    const height = this.scale?.height ?? 600;
    camera.setViewport?.(0, 0, width, height);

    if (!this.cameraFollowConfigured) {
      const followOffsetY = -(HUD_SAFE_AREA_HEIGHT + HUD_WORLD_MARGIN);
      camera.startFollow?.(sprite, true, 0.1, 0.1, 0, followOffsetY);
      this.cameraFollowConfigured = true;
    }

    const bounds = this.areaManager?.getCurrentAreaState()?.pixelBounds;
    if (Number.isFinite(bounds?.width) && Number.isFinite(bounds?.height)) {
      const safeMargin = HUD_SAFE_AREA_HEIGHT + HUD_WORLD_MARGIN;
      camera.setBounds?.(0, -safeMargin, bounds!.width as number, (bounds!.height as number) + safeMargin);
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

  private recordSafePlayerPosition(position: Vector2) {
    const tile = this.getTerrainTileAt(position);
    if (tile === 'floor' || tile === 'door') {
      this.lastSafePlayerPosition = { x: position.x, y: position.y };
    }
  }

  private enforceWalkablePlayerPosition(): Vector2 | undefined {
    if (!this.kirdy) {
      return undefined;
    }

    const currentPosition = this.getPlayerPosition();
    if (!currentPosition) {
      return undefined;
    }

    const tile = this.getTerrainTileAt(currentPosition);
    if (tile === 'floor' || tile === 'door') {
      this.lastSafePlayerPosition = { x: currentPosition.x, y: currentPosition.y };
      return currentPosition;
    }

    const fallback =
      this.lastSafePlayerPosition ??
      this.areaManager?.getCurrentAreaState()?.playerSpawnPosition ??
      currentPosition;

    this.kirdy.sprite.setPosition?.(fallback.x, fallback.y);
    this.kirdy.sprite.setVelocity?.(0, 0);

    const body = this.kirdy.sprite.body as
      | {
          position?: { x?: number; y?: number };
          velocity?: { x?: number; y?: number };
        }
      | undefined;

    if (body?.position) {
      body.position.x = fallback.x;
      body.position.y = fallback.y;
    }

    if (body?.velocity) {
      body.velocity.x = 0;
      body.velocity.y = 0;
    }

    this.lastSafePlayerPosition = { x: fallback.x, y: fallback.y };
    return { x: fallback.x, y: fallback.y };
  }

  private getTerrainTileAt(position: Vector2): string | undefined {
    const areaState = this.areaManager?.getCurrentAreaState();
    const tileMap = areaState?.tileMap as Partial<{
      getTileAtWorldPosition: (point: Vector2) => string | undefined;
      getTileAt: (column: number, row: number) => string | undefined;
      tileSize: number;
    }>;

    if (!tileMap) {
      return undefined;
    }

    if (typeof tileMap.getTileAtWorldPosition === 'function') {
      return tileMap.getTileAtWorldPosition(position);
    }

    if (typeof tileMap.getTileAt === 'function' && Number.isFinite(tileMap.tileSize)) {
      const tileSize = tileMap.tileSize as number;
      if (tileSize <= 0) {
        return undefined;
      }
      const column = Math.floor(position.x / tileSize);
      const row = Math.floor(position.y / tileSize);
      return tileMap.getTileAt(column, row);
    }

    return undefined;
  }

  private initializeSaveManager(): GameProgressSnapshot | undefined {
    this.saveManager = new SaveManager();
    const snapshot = this.saveManager.load();
    if (!snapshot?.settings) {
      this.currentSettings = { ...DEFAULT_SETTINGS };
    } else {
      this.currentSettings = { ...snapshot.settings };
    }
    if (!snapshot) {
      this.currentSettings = { ...DEFAULT_SETTINGS };
      return undefined;
    }

    const maxHP = Number.isFinite(snapshot.player?.maxHP)
      ? Math.max(0, Math.floor(snapshot.player!.maxHP))
      : 0;
    const currentHP = Number.isFinite(snapshot.player?.hp)
      ? Math.max(0, Math.floor(snapshot.player!.hp))
      : 0;

    if (maxHP <= 0 || currentHP <= 0) {
      this.saveManager.clear();
      this.currentSettings = { ...DEFAULT_SETTINGS };
      return undefined;
    }

    return snapshot;
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
    const normalizedVolume = Number.isFinite(volume)
      ? Math.min(1, Math.max(0, volume as number))
      : this.currentSettings.volume;

    return {
      volume: normalizedVolume,
      controls: this.currentSettings.controls,
      difficulty: this.currentSettings.difficulty,
    } satisfies GameSettingsSnapshot;
  }

  private applySettings(settings: GameSettingsSnapshot) {
    const clampedVolume = Number.isFinite(settings.volume)
      ? Math.min(1, Math.max(0, settings.volume as number))
      : DEFAULT_SETTINGS.volume;
    const controls = settings.controls ?? DEFAULT_SETTINGS.controls;
    const difficulty = settings.difficulty ?? DEFAULT_SETTINGS.difficulty;

    const previous = this.currentSettings;
    const changed =
      previous.volume !== clampedVolume ||
      previous.controls !== controls ||
      previous.difficulty !== difficulty;

    this.currentSettings = {
      volume: clampedVolume,
      controls,
      difficulty,
    };

    this.audioManager?.setMasterVolume(clampedVolume);
    this.playerInput?.setControlScheme?.(controls);

    if (changed) {
      this.requestSave();
    }
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
  private readonly saveManager = new SaveManager();
  private readonly escapeHandler = () => {
    this.resumeGame();
  };
  private menuElements: Array<Phaser.GameObjects.GameObject & { setVisible?: (visible: boolean) => unknown }> = [];
  private openSettingsHotkey?: () => void;

  constructor() {
    super(buildConfig(SceneKeys.Pause));
  }

  private resolveGameScene(): GameScene | undefined {
    try {
      return this.scene.get?.(SceneKeys.Game) as GameScene | undefined;
    } catch {
      return undefined;
    }
  }

  create() {
    this.menuElements = [];
    const resumeHandler = () => this.resumeGame();
    const restartHandler = () => this.restartGame();
    const quitHandler = () => this.quitToMenu();

    this.bindEscapeHandler();
    this.input?.keyboard?.once?.('keydown-R', restartHandler);
    this.input?.keyboard?.once?.('keydown-Q', quitHandler);
    this.registerSettingsShortcut();
    this.input?.once?.('pointerdown', resumeHandler);

    this.events?.once?.('shutdown', () => {
      this.unbindEscapeHandler();
      this.unregisterSettingsShortcut();
    });

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

      const width = typeof this.scale?.width === 'number' ? this.scale.width : 0;
      const height = typeof this.scale?.height === 'number' ? this.scale.height : 0;
      const centerX = width / 2;
      const centerY = height / 2;

      const trackElement = <T extends Phaser.GameObjects.GameObject>(element: T) => {
        this.menuElements.push(element);
        return element;
      };

      const title = trackElement(this.add.text(centerX, centerY - 60, 'Game Paused', style));
      title.setOrigin?.(0.5, 0.5);
      title.setScrollFactor?.(0, 0);
      title.setDepth?.(2000);

      const resumeOption = trackElement(this.add.text(centerX, centerY - 10, 'Resume (ESC)', submenuStyle));
      resumeOption.setOrigin?.(0.5, 0.5);
      resumeOption.setScrollFactor?.(0, 0);
      resumeOption.setDepth?.(2000);
      resumeOption.setInteractive?.({ useHandCursor: true });
      resumeOption.on?.('pointerdown', resumeHandler);

      const restartOption = trackElement(this.add.text(centerX, centerY + 30, 'Restart (R)', submenuStyle));
      restartOption.setOrigin?.(0.5, 0.5);
      restartOption.setScrollFactor?.(0, 0);
      restartOption.setDepth?.(2000);
      restartOption.setInteractive?.({ useHandCursor: true });
      restartOption.on?.('pointerdown', restartHandler);

      const quitOption = trackElement(this.add.text(centerX, centerY + 70, 'Quit to Menu (Q)', submenuStyle));
      quitOption.setOrigin?.(0.5, 0.5);
      quitOption.setScrollFactor?.(0, 0);
      quitOption.setDepth?.(2000);
      quitOption.setInteractive?.({ useHandCursor: true });
      quitOption.on?.('pointerdown', quitHandler);

      const settingsOption = trackElement(this.add.text(centerX, centerY + 110, 'Settings (O)', submenuStyle));
      settingsOption.setOrigin?.(0.5, 0.5);
      settingsOption.setScrollFactor?.(0, 0);
      settingsOption.setDepth?.(2000);
      settingsOption.setInteractive?.({ useHandCursor: true });
      settingsOption.on?.('pointerdown', () => this.openSettings());
    }
  }

  private registerSettingsShortcut() {
    const keyboard = this.input?.keyboard;
    if (!keyboard) {
      return;
    }

    this.unregisterSettingsShortcut();
    const handler = () => {
      this.openSettingsHotkey = undefined;
      this.openSettings();
    };

    this.openSettingsHotkey = handler;
    keyboard.once('keydown-O', handler);
  }

  private unregisterSettingsShortcut() {
    if (!this.openSettingsHotkey) {
      return;
    }

    this.input?.keyboard?.off?.('keydown-O', this.openSettingsHotkey);
    this.openSettingsHotkey = undefined;
  }

  resumeGame() {
    this.unbindEscapeHandler();
    this.unregisterSettingsShortcut();
    this.resolveGameScene()?.deactivateMenuOverlay?.();
    this.scene.stop(SceneKeys.Pause);
    this.scene.resume(SceneKeys.Game);
  }

  restartGame() {
    this.unbindEscapeHandler();
    this.unregisterSettingsShortcut();
    this.saveManager.resetPlayerPosition();
    this.resolveGameScene()?.deactivateMenuOverlay?.({ force: true });
    this.scene.stop(SceneKeys.Pause);
    this.scene.stop(SceneKeys.Game);
    this.scene.start(SceneKeys.Game);
  }

  quitToMenu() {
    this.unbindEscapeHandler();
    this.unregisterSettingsShortcut();
    this.resolveGameScene()?.deactivateMenuOverlay?.({ force: true });
    this.scene.stop(SceneKeys.Pause);
    this.scene.stop(SceneKeys.Game);
    this.scene.start(SceneKeys.Menu);
  }

  private openSettings() {
    const gameScene = this.resolveGameScene();
    const overlayManagedByParent = Boolean(gameScene);

    const scenePlugin = this.scene as
      | (Phaser.Scenes.ScenePlugin & {
          isActive?: (key: SceneKey) => boolean;
          isPaused?: (key: SceneKey) => boolean;
        })
      | undefined;
    const gameIsInactive = scenePlugin?.isActive?.(SceneKeys.Game) === false;
    const gameAlreadyPaused = scenePlugin?.isPaused?.(SceneKeys.Game) === true;

    if (!gameIsInactive && !gameAlreadyPaused) {
      try {
        scenePlugin?.pause?.(SceneKeys.Game);
      } catch {
        // ignore when the game scene is not active
      }
    }

    if (overlayManagedByParent) {
      gameScene?.activateMenuOverlay?.();
    }

    this.unregisterSettingsShortcut();
    this.unbindEscapeHandler();
    this.setMenuElementsVisible(false);
    let cleanupTriggered = false;
    const handleSettingsClosed = () => {
      if (cleanupTriggered) {
        return;
      }
      cleanupTriggered = true;
      this.bindEscapeHandler();
      this.registerSettingsShortcut();
      this.setMenuElementsVisible(true);
      try {
        this.scene.bringToTop(SceneKeys.Pause);
      } catch {
        // ignore when scene manager is not available
      }
    };

    const attachShutdownListener = () => {
      try {
        const settingsSceneInstance = this.scene.get?.(SceneKeys.Settings) as Phaser.Scene | undefined;
        const shutdownEvents = settingsSceneInstance?.events;
        if (shutdownEvents?.once) {
          shutdownEvents.once('shutdown', handleSettingsClosed);
          return true;
        }
      } catch {
        return false;
      }
      return false;
    };

    this.events?.once?.('settings-overlay-closed', handleSettingsClosed);

    this.scene.launch(SceneKeys.Settings, {
      returnTo: SceneKeys.Pause,
      overlayManagedByParent,
    });

    if (!attachShutdownListener()) {
      this.time?.delayedCall?.(0, () => {
        attachShutdownListener();
      });
    }
  }

  private bindEscapeHandler() {
    this.unbindEscapeHandler();
    this.input?.keyboard?.on?.('keydown-ESC', this.escapeHandler);
  }

  private unbindEscapeHandler() {
    this.input?.keyboard?.off?.('keydown-ESC', this.escapeHandler);
  }

  private setMenuElementsVisible(visible: boolean) {
    this.menuElements.forEach((element) => element.setVisible?.(visible));
  }
}

interface SettingsSceneData {
  returnTo?: SceneKey;
  overlayManagedByParent?: boolean;
}

export class SettingsScene extends Phaser.Scene {
  public static readonly KEY = SceneKeys.Settings;
  private readonly saveManager = new SaveManager();
  private currentSettings: GameSettingsSnapshot = { ...DEFAULT_SETTINGS };
  private summaryText?: Phaser.GameObjects.Text;
  private instructionsText?: Phaser.GameObjects.Text;
  private returnToScene: SceneKey = SceneKeys.Menu;
  private overlayManagedByParent = false;

  constructor() {
    super(buildConfig(SceneKeys.Settings));
  }

  private resolveGameScene(): GameScene | undefined {
    try {
      return this.scene.get?.(SceneKeys.Game) as GameScene | undefined;
    } catch {
      return undefined;
    }
  }

  create(data?: SettingsSceneData) {
    this.returnToScene = data?.returnTo ?? SceneKeys.Menu;
    this.overlayManagedByParent = Boolean(data?.overlayManagedByParent);
    const snapshot = this.saveManager.load();
    if (snapshot?.settings) {
      this.currentSettings = { ...snapshot.settings };
    } else {
      this.currentSettings = { ...DEFAULT_SETTINGS };
    }

    const width = this.scale?.width ?? 800;
    const height = this.scale?.height ?? 600;
    const centerX = width / 2;
    const centerY = height / 2;

    const summaryStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: '22px',
      color: '#ffffff',
      align: 'center',
    };
    this.summaryText = this.add?.text?.(centerX, centerY - 60, '', summaryStyle);
    this.summaryText?.setOrigin?.(0.5, 0.5);
    this.summaryText?.setScrollFactor?.(0, 0);
    this.summaryText?.setDepth?.(2200);

    const instructionsStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: '16px',
      color: '#ffd6ff',
      align: 'center',
    };
    const instructionsLines = [
      'LEFT / RIGHT : Adjust volume',
      'UP / DOWN     : Cycle difficulty',
      'C             : Cycle control scheme',
      'ESC           : Back',
    ];
    this.instructionsText = this.add?.text?.(centerX, centerY + 40, instructionsLines.join('\n'), instructionsStyle);
    this.instructionsText?.setOrigin?.(0.5, 0.5);
    this.instructionsText?.setScrollFactor?.(0, 0);
    this.instructionsText?.setDepth?.(2200);
    this.instructionsText?.setLineSpacing?.(4);

    this.refreshSummaryText();

    const gameScene = this.resolveGameScene();
    if (gameScene) {
      if (!this.overlayManagedByParent) {
        gameScene.activateMenuOverlay();
      }
      const scenePlugin = this.scene as
        | (Phaser.Scenes.ScenePlugin & {
            isActive?: (key: SceneKey) => boolean;
            isPaused?: (key: SceneKey) => boolean;
          })
        | undefined;
      const gameIsInactive = scenePlugin?.isActive?.(SceneKeys.Game) === false;
      const gameAlreadyPaused = scenePlugin?.isPaused?.(SceneKeys.Game) === true;

      if (!gameIsInactive && !gameAlreadyPaused) {
        try {
          scenePlugin?.pause?.(SceneKeys.Game);
        } catch {
          // ignore when the game scene is not active
        }
      }
    }

    const keyboard = this.input?.keyboard;
    const handleLeft = () => this.adjustVolume(-0.1);
    const handleRight = () => this.adjustVolume(0.1);
    const handleUp = () => this.cycleDifficulty(1);
    const handleDown = () => this.cycleDifficulty(-1);
    const handleControl = () => this.cycleControlScheme(1);
    const handleEscape = () => this.close();

    keyboard?.on?.('keydown-LEFT', handleLeft);
    keyboard?.on?.('keydown-RIGHT', handleRight);
    keyboard?.on?.('keydown-UP', handleUp);
    keyboard?.on?.('keydown-DOWN', handleDown);
    keyboard?.on?.('keydown-C', handleControl);
    keyboard?.once?.('keydown-ESC', handleEscape);

    this.events?.once?.('shutdown', () => {
      keyboard?.off?.('keydown-LEFT', handleLeft);
      keyboard?.off?.('keydown-RIGHT', handleRight);
      keyboard?.off?.('keydown-UP', handleUp);
      keyboard?.off?.('keydown-DOWN', handleDown);
      keyboard?.off?.('keydown-C', handleControl);
      keyboard?.off?.('keydown-ESC', handleEscape);
    });
  }

  private adjustVolume(delta: number) {
    const current = this.currentSettings.volume ?? DEFAULT_SETTINGS.volume;
    const nextRaw = current + delta;
    const next = Math.min(1, Math.max(0, Math.round(nextRaw * 100) / 100));
    if (next === current) {
      return;
    }
    this.applySettingChanges({ volume: next });
  }

  private cycleControlScheme(direction: 1 | -1) {
    const current = this.currentSettings.controls ?? DEFAULT_SETTINGS.controls;
    const index = CONTROL_SCHEME_SEQUENCE.indexOf(current);
    const nextIndex =
      (index + direction + CONTROL_SCHEME_SEQUENCE.length) % CONTROL_SCHEME_SEQUENCE.length;
    const next = CONTROL_SCHEME_SEQUENCE[nextIndex];
    if (next === current) {
      return;
    }
    this.applySettingChanges({ controls: next });
  }

  private cycleDifficulty(direction: 1 | -1) {
    const current = this.currentSettings.difficulty ?? DEFAULT_SETTINGS.difficulty;
    const index = DIFFICULTY_SEQUENCE.indexOf(current);
    const nextIndex = (index + direction + DIFFICULTY_SEQUENCE.length) % DIFFICULTY_SEQUENCE.length;
    const next = DIFFICULTY_SEQUENCE[nextIndex];
    if (next === current) {
      return;
    }
    this.applySettingChanges({ difficulty: next });
  }

  private applySettingChanges(partial: Partial<GameSettingsSnapshot>) {
    const updated = this.saveManager.updateSettings(partial);
    this.currentSettings = { ...updated };
    this.refreshSummaryText();
    this.game?.events?.emit?.('settings-updated', updated);
  }

  private refreshSummaryText() {
    const volumePercent = Math.round((this.currentSettings.volume ?? 0) * 100);
    const controlLabel = this.currentSettings.controls ?? DEFAULT_SETTINGS.controls;
    const difficultyLabel = this.currentSettings.difficulty ?? DEFAULT_SETTINGS.difficulty;
    const lines = [
      `Volume: ${volumePercent}%`,
      `Controls: ${controlLabel}`,
      `Difficulty: ${difficultyLabel}`,
    ];
    this.summaryText?.setText?.(lines.join('\n'));
  }

  private close() {
    const gameScene = this.resolveGameScene();
    const shouldForceClear = this.returnToScene !== SceneKeys.Pause;
    if (this.overlayManagedByParent) {
      gameScene?.deactivateMenuOverlay?.();
    } else {
      gameScene?.deactivateMenuOverlay?.({ force: shouldForceClear });
    }

    const scenePlugin = this.scene as
      | (Phaser.Scenes.ScenePlugin & {
          isPaused?: (key: SceneKey) => boolean;
        })
      | undefined;
    const returningToPause = this.returnToScene === SceneKeys.Pause;
    const targetWasPaused = scenePlugin?.isPaused?.(this.returnToScene) === true;

    if (returningToPause) {
      try {
        const pauseScene = this.scene.get?.(SceneKeys.Pause) as Phaser.Scene | undefined;
        pauseScene?.events?.emit?.('settings-overlay-closed');
      } catch {
        // ignore when pause scene is not available
      }
    }

    if (!returningToPause || !this.overlayManagedByParent || targetWasPaused) {
      try {
        this.scene.resume(this.returnToScene);
      } catch {
        // ignore when the scene manager is not available
      }
    }

    try {
      this.scene.bringToTop(this.returnToScene);
    } catch {
      // ignore when the scene manager is not available
    }
    this.scene.stop(SceneKeys.Settings);
    this.game?.events?.emit?.('settings-updated', this.currentSettings);
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

  private resolveGameScene(): GameScene | undefined {
    try {
      return this.scene.get?.(SceneKeys.Game) as GameScene | undefined;
    } catch {
      return undefined;
    }
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

      const width = typeof this.scale?.width === 'number' ? this.scale.width : 0;
      const height = typeof this.scale?.height === 'number' ? this.scale.height : 0;
      const centerX = width / 2;
      const centerY = height / 2;

      const title = this.add.text(centerX, centerY - 80, 'Game Over', style);
      title.setOrigin?.(0.5, 0.5);
      title.setScrollFactor?.(0, 0);
      title.setDepth?.(2000);

      const abilityLabel = this.finalAbility ? this.finalAbility.toUpperCase() : 'None';
      const scoreText = `Final Score: ${this.finalScore.toString().padStart(6, '0')}`;
      const abilityText = `Ability Carried: ${abilityLabel}`;

      const scoreLine = this.add.text(centerX, centerY - 20, scoreText, infoStyle);
      scoreLine.setOrigin?.(0.5, 0.5);
      scoreLine.setScrollFactor?.(0, 0);
      scoreLine.setDepth?.(2000);

      const abilityLine = this.add.text(centerX, centerY + 20, abilityText, infoStyle);
      abilityLine.setOrigin?.(0.5, 0.5);
      abilityLine.setScrollFactor?.(0, 0);
      abilityLine.setDepth?.(2000);

      const restartLine = this.add.text(centerX, centerY + 70, 'Restart (R)', infoStyle);
      restartLine.setOrigin?.(0.5, 0.5);
      restartLine.setScrollFactor?.(0, 0);
      restartLine.setDepth?.(2000);
      restartLine.setInteractive?.({ useHandCursor: true });
      restartLine.on?.('pointerdown', restartHandler);

      const menuLine = this.add.text(centerX, centerY + 110, 'Return to Menu (M)', infoStyle);
      menuLine.setOrigin?.(0.5, 0.5);
      menuLine.setScrollFactor?.(0, 0);
      menuLine.setDepth?.(2000);
      menuLine.setInteractive?.({ useHandCursor: true });
      menuLine.on?.('pointerdown', menuHandler);
    }
  }

  restartGame() {
    this.resolveGameScene()?.deactivateMenuOverlay?.({ force: true });
    this.scene.stop(SceneKeys.GameOver);
    this.scene.stop(SceneKeys.Game);
    this.scene.start(SceneKeys.Game);
  }

  returnToMenu() {
    this.resolveGameScene()?.deactivateMenuOverlay?.({ force: true });
    this.scene.stop(SceneKeys.GameOver);
    this.scene.stop(SceneKeys.Game);
    this.scene.start(SceneKeys.Menu);
  }
}

export class ResultsScene extends Phaser.Scene {
  public static readonly KEY = SceneKeys.Results;

  constructor() {
    super(buildConfig(SceneKeys.Results));
  }

  create(data?: GoalResultPayload) {
    const score = data?.score ?? 0;
    const timeMs = data?.timeMs ?? 0;
    const width = this.scale?.width ?? 800;
    const height = this.scale?.height ?? 600;
    const formattedTime = this.formatTime(timeMs);

    const title = this.add.text(width / 2, height * 0.25, 'Results', {
      fontSize: '36px',
      color: '#ffffff',
    });
    title.setOrigin(0.5);

    const scoreText = this.add.text(width / 2, height * 0.4, `Score: ${score.toLocaleString()}`, {
      fontSize: '26px',
      color: '#f8e16c',
    });
    scoreText.setOrigin(0.5);

    const timeText = this.add.text(width / 2, height * 0.48, `Time: ${formattedTime}`, {
      fontSize: '24px',
      color: '#a0d8ff',
    });
    timeText.setOrigin(0.5);

    const hint = this.add.text(width / 2, height * 0.7, 'Press ENTER to return to menu', {
      fontSize: '20px',
      color: '#ffffff',
    });
    hint.setOrigin(0.5);

    this.input?.keyboard?.once?.('keydown-ENTER', () => this.scene.start(SceneKeys.Menu));
    this.input?.keyboard?.once?.('keydown-ESC', () => this.scene.start(SceneKeys.Menu));
  }

  private formatTime(timeMs: number) {
    if (!Number.isFinite(timeMs) || timeMs < 0) {
      return '0:00.0';
    }

    const totalSeconds = Math.floor(timeMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const tenths = Math.floor((timeMs % 1000) / 100);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${tenths}`;
  }
}

export const coreScenes = [
  BootScene,
  MenuScene,
  GameScene,
  PauseScene,
  SettingsScene,
  GameOverScene,
  ResultsScene,
];
