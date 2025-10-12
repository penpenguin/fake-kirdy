import { ABILITY_TYPES, type AbilityType } from '../mechanics/AbilitySystem';
import { AREA_IDS, type AreaId, type Vector2 } from '../world/AreaManager';

export interface PlayerProgressSnapshot {
  hp: number;
  maxHP: number;
  score: number;
  ability?: AbilityType;
  position: Vector2;
}

export interface AreaProgressSnapshot {
  currentAreaId: AreaId;
  discoveredAreas: AreaId[];
  exploredTiles: Record<AreaId, string[]>;
  lastKnownPlayerPosition: Vector2;
  completedAreas: AreaId[];
  collectedItems: string[];
}

export interface GameProgressSnapshot {
  player: PlayerProgressSnapshot;
  area: AreaProgressSnapshot;
  settings: GameSettingsSnapshot;
}

export type ControlScheme = 'keyboard' | 'touch' | 'controller';
export type DifficultyLevel = 'easy' | 'normal' | 'hard';

export interface GameSettingsSnapshot {
  volume: number;
  controls: ControlScheme;
  difficulty: DifficultyLevel;
}

export interface SaveManagerOptions {
  key?: string;
  storage?: Storage;
  fallbackStorage?: Storage;
  now?: () => number;
  migrations?: Map<number, (data: unknown) => GameProgressSnapshot | undefined>;
}

const DEFAULT_KEY = 'kirdy-progress';
const CURRENT_VERSION = 1;
const FALLBACK_SUFFIX = ':fallback';
const abilitySet = new Set<AbilityType>(ABILITY_TYPES);
const areaSet = new Set<AreaId>(Object.values(AREA_IDS));
const TILE_KEY_PATTERN = /^\d+,\d+$/;
const CONTROL_SCHEMES: ControlScheme[] = ['keyboard', 'touch', 'controller'];
const DIFFICULTY_LEVELS: DifficultyLevel[] = ['easy', 'normal', 'hard'];
const controlSchemeSet = new Set<ControlScheme>(CONTROL_SCHEMES);
const difficultySet = new Set<DifficultyLevel>(DIFFICULTY_LEVELS);

const DEFAULT_PLAYER: PlayerProgressSnapshot = {
  hp: 6,
  maxHP: 6,
  score: 0,
  position: { x: 0, y: 0 },
};

const DEFAULT_AREA: AreaProgressSnapshot = {
  currentAreaId: AREA_IDS.CentralHub,
  discoveredAreas: [],
  exploredTiles: {
    [AREA_IDS.CentralHub]: [],
    [AREA_IDS.MirrorCorridor]: [],
    [AREA_IDS.IceArea]: [],
    [AREA_IDS.FireArea]: [],
    [AREA_IDS.ForestArea]: [],
    [AREA_IDS.CaveArea]: [],
    [AREA_IDS.GoalSanctum]: [],
  },
  lastKnownPlayerPosition: { x: 0, y: 0 },
  completedAreas: [],
  collectedItems: [],
};

export const DEFAULT_SETTINGS: GameSettingsSnapshot = {
  volume: 0.8,
  controls: 'keyboard',
  difficulty: 'normal',
} as const satisfies GameSettingsSnapshot;

type MigrationFn = (data: unknown) => GameProgressSnapshot | undefined;

interface SavePayloadV1 {
  version: typeof CURRENT_VERSION;
  savedAt: number;
  data: GameProgressSnapshot;
}

type SavePayload = SavePayloadV1 | { version: number; savedAt?: number; data?: unknown };

export class SaveManager {
  private readonly key: string;
  private readonly storage?: Storage;
  private readonly fallbackStorage?: Storage;
  private readonly fallbackKey: string;
  private readonly now: () => number;
  private readonly migrations: Map<number, MigrationFn>;

  constructor(options: SaveManagerOptions = {}) {
    this.key = options.key ?? DEFAULT_KEY;
    this.storage = options.storage ?? getGlobalStorage();
    this.fallbackStorage = options.fallbackStorage ?? getGlobalFallbackStorage();
    this.fallbackKey = `${this.key}${FALLBACK_SUFFIX}`;
    this.now = options.now ?? (() => Date.now());
    this.migrations = options.migrations ?? new Map();
  }

  save(snapshot: GameProgressSnapshot) {
    const sanitized = sanitizeSnapshot(snapshot);
    const payload: SavePayloadV1 = {
      version: CURRENT_VERSION,
      savedAt: this.now(),
      data: sanitized,
    };
    const serialized = JSON.stringify(payload);

    const primaryResult = trySetItem(this.storage, this.key, serialized);
    if (primaryResult.success) {
      tryRemoveItem(this.fallbackStorage, this.fallbackKey);
      return;
    }

    if (primaryResult.error) {
      console.warn('[SaveManager] failed to save progress', primaryResult.error);
    }

    const fallbackResult = trySetItem(this.fallbackStorage, this.fallbackKey, serialized);
    if (fallbackResult.success) {
      if (primaryResult.error) {
        console.warn('[SaveManager] wrote progress to fallback storage after primary failure');
      }
      return;
    }

    if (!primaryResult.error) {
      console.warn('[SaveManager] primary storage unavailable, attempted fallback');
    }

    if (fallbackResult.error) {
      console.warn('[SaveManager] fallback storage failed to save progress', fallbackResult.error);
    }
  }

  load(): GameProgressSnapshot | undefined {
    const primary = this.loadFromStorage(this.storage, this.key, true);
    if (primary) {
      return primary;
    }

    const fallback = this.loadFromStorage(this.fallbackStorage, this.fallbackKey, false);
    if (fallback) {
      this.save(fallback);
      return fallback;
    }

    return undefined;
  }

  clear() {
    tryRemoveItem(this.storage, this.key);
    tryRemoveItem(this.fallbackStorage, this.fallbackKey);
  }

  private loadFromStorage(
    storage: Storage | undefined,
    key: string,
    isPrimary: boolean,
  ): GameProgressSnapshot | undefined {
    const readResult = tryGetItem(storage, key);
    if (!readResult.success) {
      if (readResult.error) {
        console.warn('[SaveManager] failed to access storage', readResult.error);
      }
      return undefined;
    }

    const raw = readResult.value;
    if (!raw) {
      return undefined;
    }

    let parsed: SavePayload;
    try {
      parsed = JSON.parse(raw) as SavePayload;
    } catch (error) {
      console.warn('[SaveManager] failed to parse save payload', error);
      tryRemoveItem(storage, key);
      return undefined;
    }

    if (parsed.version === CURRENT_VERSION && parsed.data) {
      return sanitizeSnapshot(parsed.data as GameProgressSnapshot);
    }

    const migration = this.migrations.get(parsed.version);
    if (!migration) {
      console.warn('[SaveManager] unsupported save version', parsed.version);
      tryRemoveItem(storage, key);
      return undefined;
    }

    try {
      const migrated = migration(parsed.data);
      if (!migrated) {
        console.warn('[SaveManager] migration did not return data');
        tryRemoveItem(storage, key);
        return undefined;
      }

      const sanitized = sanitizeSnapshot(migrated);
      if (isPrimary) {
        this.save(sanitized);
      } else {
        // re-save migrated fallback data so both stores share the upgraded payload
        this.save(sanitized);
      }
      return sanitized;
    } catch (error) {
      console.warn('[SaveManager] migration failed', error);
      tryRemoveItem(storage, key);
      return undefined;
    }
  }
}

function getGlobalStorage(): Storage | undefined {
  if (typeof globalThis === 'undefined') {
    return undefined;
  }

  const maybeStorage = (globalThis as { localStorage?: Storage }).localStorage;
  return maybeStorage;
}

function sanitizeSnapshot(snapshot: GameProgressSnapshot): GameProgressSnapshot {
  const player = sanitizePlayer(snapshot?.player);
  const area = sanitizeArea(snapshot?.area);
  const settings = sanitizeSettings(snapshot?.settings);

  return {
    player,
    area,
    settings,
  } satisfies GameProgressSnapshot;
}

function sanitizePlayer(player?: PlayerProgressSnapshot): PlayerProgressSnapshot {
  const base = { ...DEFAULT_PLAYER };
  const hp = clampToInt(player?.hp, 0, Number.POSITIVE_INFINITY, base.hp);
  const maxHP = Math.max(1, clampToInt(player?.maxHP, 1, Number.POSITIVE_INFINITY, base.maxHP));
  const clampedHp = Math.min(hp, maxHP);
  const score = clampToInt(player?.score, 0, Number.POSITIVE_INFINITY, base.score);
  const ability = abilitySet.has(player?.ability as AbilityType) ? (player?.ability as AbilityType) : undefined;
  const position = sanitizeVector(player?.position, base.position);

  return {
    hp: clampedHp,
    maxHP,
    score,
    ability,
    position,
  } satisfies PlayerProgressSnapshot;
}

function sanitizeArea(area?: AreaProgressSnapshot): AreaProgressSnapshot {
  const base: AreaProgressSnapshot = {
    currentAreaId: DEFAULT_AREA.currentAreaId,
    discoveredAreas: [...DEFAULT_AREA.discoveredAreas],
    exploredTiles: { ...DEFAULT_AREA.exploredTiles },
    lastKnownPlayerPosition: { ...DEFAULT_AREA.lastKnownPlayerPosition },
    completedAreas: [...DEFAULT_AREA.completedAreas],
    collectedItems: [...DEFAULT_AREA.collectedItems],
  };
  const currentAreaId = areaSet.has(area?.currentAreaId as AreaId)
    ? (area?.currentAreaId as AreaId)
    : base.currentAreaId;

  const discoveredAreas = Array.isArray(area?.discoveredAreas)
    ? Array.from(
        new Set(
          area!.discoveredAreas.filter((candidate): candidate is AreaId => areaSet.has(candidate as AreaId)),
        ),
      )
    : base.discoveredAreas.slice();

  const exploredTiles = sanitizeExploredTiles(area?.exploredTiles ?? {});
  const lastKnownPlayerPosition = sanitizeVector(area?.lastKnownPlayerPosition, base.lastKnownPlayerPosition);
  const completedAreas = Array.isArray(area?.completedAreas)
    ? Array.from(
        new Set(
          area!.completedAreas.filter((candidate): candidate is AreaId => areaSet.has(candidate as AreaId)),
        ),
      )
    : base.completedAreas.slice();

  const collectedItems = Array.isArray(area?.collectedItems)
    ? Array.from(
        new Set(
          area!.collectedItems.filter((candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0),
        ),
      )
    : base.collectedItems.slice();

  return {
    currentAreaId,
    discoveredAreas,
    exploredTiles,
    lastKnownPlayerPosition,
    completedAreas,
    collectedItems,
  } satisfies AreaProgressSnapshot;
}

function sanitizeExploredTiles(input: Record<string, string[]>): Record<AreaId, string[]> {
  const sanitized: Partial<Record<AreaId, string[]>> = {};

  Object.entries(input).forEach(([areaId, tiles]) => {
    if (!areaSet.has(areaId as AreaId) || !Array.isArray(tiles)) {
      return;
    }

    const validTiles = Array.from(
      new Set(
        tiles.filter((tile) => typeof tile === 'string' && TILE_KEY_PATTERN.test(tile)),
      ),
    );

    if (validTiles.length === 0) {
      if (tiles.length === 0) {
        sanitized[areaId as AreaId] = [];
      }
      return;
    }

    sanitized[areaId as AreaId] = validTiles;
  });

  return sanitized as Record<AreaId, string[]>;
}

function sanitizeVector(vector: Vector2 | undefined, fallback: Vector2): Vector2 {
  const x = Number.isFinite(vector?.x) ? (vector!.x as number) : fallback.x;
  const y = Number.isFinite(vector?.y) ? (vector!.y as number) : fallback.y;
  return { x, y } satisfies Vector2;
}

function sanitizeSettings(settings?: GameSettingsSnapshot): GameSettingsSnapshot {
  const base = { ...DEFAULT_SETTINGS } satisfies GameSettingsSnapshot;
  const volumeCandidate = Number(settings?.volume);
  const volume = Number.isFinite(volumeCandidate)
    ? Math.min(1, Math.max(0, volumeCandidate))
    : base.volume;

  const controls = controlSchemeSet.has(settings?.controls as ControlScheme)
    ? (settings!.controls as ControlScheme)
    : base.controls;

  const difficulty = difficultySet.has(settings?.difficulty as DifficultyLevel)
    ? (settings!.difficulty as DifficultyLevel)
    : base.difficulty;

  return {
    volume,
    controls,
    difficulty,
  } satisfies GameSettingsSnapshot;
}

function clampToInt(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  if (!Number.isFinite(value as number)) {
    return fallback;
  }

  const coerced = Math.trunc(value as number);
  return Math.min(max, Math.max(min, coerced));
}

interface StorageWriteResult {
  success: boolean;
  error?: unknown;
}

interface StorageReadResult {
  success: boolean;
  value?: string | null;
  error?: unknown;
}

function trySetItem(storage: Storage | undefined, key: string, value: string): StorageWriteResult {
  if (!storage?.setItem) {
    return { success: false };
  }

  try {
    storage.setItem(key, value);
    return { success: true };
  } catch (error) {
    return { success: false, error };
  }
}

function tryGetItem(storage: Storage | undefined, key: string): StorageReadResult {
  if (!storage?.getItem) {
    return { success: false };
  }

  try {
    const value = storage.getItem(key);
    return { success: true, value };
  } catch (error) {
    return { success: false, error };
  }
}

function tryRemoveItem(storage: Storage | undefined, key: string) {
  if (!storage?.removeItem) {
    return;
  }

  try {
    storage.removeItem(key);
  } catch (error) {
    console.warn('[SaveManager] failed to remove corrupt save', error);
  }
}

function getGlobalFallbackStorage(): Storage | undefined {
  if (typeof globalThis === 'undefined') {
    return undefined;
  }

  const maybeStorage = (globalThis as { sessionStorage?: Storage }).sessionStorage;
  return maybeStorage;
}
