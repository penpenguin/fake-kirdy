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
}

export interface GameProgressSnapshot {
  player: PlayerProgressSnapshot;
  area: AreaProgressSnapshot;
}

export interface SaveManagerOptions {
  key?: string;
  storage?: Storage;
  now?: () => number;
  migrations?: Map<number, (data: unknown) => GameProgressSnapshot | undefined>;
}

const DEFAULT_KEY = 'kirdy-progress';
const CURRENT_VERSION = 1;
const abilitySet = new Set<AbilityType>(ABILITY_TYPES);
const areaSet = new Set<AreaId>(Object.values(AREA_IDS));
const TILE_KEY_PATTERN = /^\d+,\d+$/;

const DEFAULT_PLAYER: PlayerProgressSnapshot = {
  hp: 6,
  maxHP: 6,
  score: 0,
  position: { x: 0, y: 0 },
};

const DEFAULT_AREA: AreaProgressSnapshot = {
  currentAreaId: AREA_IDS.CentralHub,
  discoveredAreas: [],
  exploredTiles: {},
  lastKnownPlayerPosition: { x: 0, y: 0 },
};

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
  private readonly now: () => number;
  private readonly migrations: Map<number, MigrationFn>;

  constructor(options: SaveManagerOptions = {}) {
    this.key = options.key ?? DEFAULT_KEY;
    this.storage = options.storage ?? getGlobalStorage();
    this.now = options.now ?? (() => Date.now());
    this.migrations = options.migrations ?? new Map();
  }

  save(snapshot: GameProgressSnapshot) {
    const storage = this.storage;
    if (!storage?.setItem) {
      return;
    }

    const sanitized = sanitizeSnapshot(snapshot);
    const payload: SavePayloadV1 = {
      version: CURRENT_VERSION,
      savedAt: this.now(),
      data: sanitized,
    };

    try {
      storage.setItem(this.key, JSON.stringify(payload));
    } catch (error) {
      console.warn('[SaveManager] failed to save progress', error);
    }
  }

  load(): GameProgressSnapshot | undefined {
    const storage = this.storage;
    if (!storage?.getItem) {
      return undefined;
    }

    let raw: string | null = null;
    try {
      raw = storage.getItem(this.key);
    } catch (error) {
      console.warn('[SaveManager] failed to access storage', error);
      return undefined;
    }

    if (!raw) {
      return undefined;
    }

    let parsed: SavePayload;
    try {
      parsed = JSON.parse(raw) as SavePayload;
    } catch (error) {
      console.warn('[SaveManager] failed to parse save payload', error);
      this.safeRemove();
      return undefined;
    }

    if (parsed.version === CURRENT_VERSION && parsed.data) {
      return sanitizeSnapshot(parsed.data as GameProgressSnapshot);
    }

    const migration = this.migrations.get(parsed.version);
    if (!migration) {
      console.warn('[SaveManager] unsupported save version', parsed.version);
      this.safeRemove();
      return undefined;
    }

    try {
      const migrated = migration(parsed.data);
      if (!migrated) {
        console.warn('[SaveManager] migration did not return data');
        this.safeRemove();
        return undefined;
      }

      const sanitized = sanitizeSnapshot(migrated);
      this.save(sanitized);
      return sanitized;
    } catch (error) {
      console.warn('[SaveManager] migration failed', error);
      this.safeRemove();
      return undefined;
    }
  }

  clear() {
    this.safeRemove();
  }

  private safeRemove() {
    const storage = this.storage;
    if (!storage?.removeItem) {
      return;
    }

    try {
      storage.removeItem(this.key);
    } catch (error) {
      console.warn('[SaveManager] failed to remove corrupt save', error);
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

  return {
    player,
    area,
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
  const base = { ...DEFAULT_AREA };
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

  return {
    currentAreaId,
    discoveredAreas,
    exploredTiles,
    lastKnownPlayerPosition,
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
