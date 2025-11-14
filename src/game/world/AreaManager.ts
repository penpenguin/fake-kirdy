import type { EnemyType } from '../enemies';
import { STAGE_DEFINITIONS, cloneStageDefinition } from './stages';

export const AREA_IDS = {
  CentralHub: 'central-hub',
  MirrorCorridor: 'mirror-corridor',
  IceArea: 'ice-area',
  FireArea: 'fire-area',
  ForestArea: 'forest-area',
  CaveArea: 'cave-area',
  GoalSanctum: 'goal-sanctum',
  SkySanctum: 'sky-sanctum',
  AuroraSpire: 'aurora-spire',
  StarlitKeep: 'starlit-keep',
} as const;
type ProceduralAreaId = `labyrinth-${number}`;
export type AreaId = (typeof AREA_IDS)[keyof typeof AREA_IDS] | ProceduralAreaId;
export type AreaTransitionDirection = 'north' | 'south' | 'east' | 'west';

export type TileCode = 'wall' | 'floor' | 'door' | 'void';

const TILE_KEY_PATTERN = /^\d+,\d+$/;

export interface Vector2 {
  x: number;
  y: number;
}

export interface AreaEnemySpawnEntry {
  type: EnemyType;
  limit: number;
}

export interface AreaEnemySpawnConfig {
  baseline: number;
  maxActive?: number;
  entries: AreaEnemySpawnEntry[];
}

export type HealRewardType = 'health' | 'max-health' | 'revive';

export interface AreaDefinitionMetadata {
  cluster: 'hub' | 'forest' | 'ice' | 'fire' | 'ruins' | 'sky' | 'void';
  index: number;
  difficulty?: number;
}

export interface AreaDoorDefinition {
  id: string;
  direction: AreaTransitionDirection;
  tile: { column: number; row: number };
  position: Vector2;
  safeRadius: number;
  type: 'standard' | 'goal';
  target?: AreaId;
}

export interface DeadEndDefinition {
  id: string;
  tile: { column: number; row: number };
  position: Vector2;
  reward: HealRewardType;
}

export interface AreaGoalMetadata {
  doorId: string;
  texture?: string;
  resultOverlayKey?: string;
  scoreBonus?: number;
}

export interface AreaUpdateResult {
  areaChanged: boolean;
  transition?: {
    from: AreaId;
    to: AreaId;
    via: AreaTransitionDirection;
    entryPosition: Vector2;
  };
}

export interface AreaExplorationState {
  visitedTiles: number;
  totalTiles: number;
  completion: number; // 0.0 - 1.0
}

export interface AreaMetadata {
  id: AreaId;
  name: string;
}

export interface AreaManagerSnapshot {
  currentAreaId: AreaId;
  discoveredAreas: AreaId[];
  exploredTiles: Record<AreaId, string[]>;
  lastKnownPlayerPosition: Vector2;
  completedAreas?: AreaId[];
  collectedItems?: string[];
}

interface AreaEntryPoint {
  position: Vector2;
  facing?: AreaTransitionDirection;
}

export interface AreaDefinition {
  id: AreaId;
  name: string;
  tileSize: number;
  layout: string[];
  neighbors: Partial<Record<AreaTransitionDirection, AreaId>>;
  entryPoints: { default: AreaEntryPoint } & Partial<Record<AreaTransitionDirection, AreaEntryPoint>>;
  metadata?: AreaDefinitionMetadata;
  doorBuffer?: number;
  doors?: AreaDoorDefinition[];
  deadEnds?: DeadEndDefinition[];
  goal?: AreaGoalMetadata | null;
  enemySpawns?: AreaEnemySpawnConfig;
}

interface AreaDerivedData {
  tileMap: TileMap;
  pixelBounds: { width: number; height: number };
  totalWalkableTiles: number;
  doorDirections: Map<string, AreaTransitionDirection>;
}

export interface LoadedArea {
  definition: AreaDefinition;
  tileMap: TileMap;
  pixelBounds: { width: number; height: number };
  playerSpawnPosition: Vector2;
}

function getOppositeDirection(direction: AreaTransitionDirection): AreaTransitionDirection {
  switch (direction) {
    case 'north':
      return 'south';
    case 'south':
      return 'north';
    case 'east':
      return 'west';
    case 'west':
      return 'east';
    default: {
      const _never: never = direction;
      return _never;
    }
  }
}

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

class TileMap {
  public readonly columns: number;
  public readonly rows: number;
  public readonly tileSize: number;
  private readonly tiles: TileCode[][];
  public readonly totalWalkableTiles: number;

  constructor(layout: string[], tileSize: number) {
    invariant(layout.length > 0, 'layout must have rows');
    const rowLength = layout[0].length;
    invariant(rowLength > 0, 'layout must have columns');

    this.tileSize = tileSize;
    this.rows = layout.length;
    this.columns = rowLength;
    this.tiles = layout.map((row) => this.parseRow(row, rowLength));

    this.totalWalkableTiles = this.tiles.reduce(
      (acc, row) => acc + row.filter((tile) => this.isWalkable(tile)).length,
      0,
    );
  }

  private parseRow(row: string, expectedLength: number) {
    invariant(row.length === expectedLength, 'layout rows must have equal length');
    return Array.from(row).map((char) => this.symbolToTile(char));
  }

  private symbolToTile(symbol: string): TileCode {
    switch (symbol) {
      case '#':
        return 'wall';
      case '.':
        return 'floor';
      case 'D':
        return 'door';
      case ' ':
        return 'void';
      default:
        return 'floor';
    }
  }

  private isWalkable(tile: TileCode) {
    return tile === 'floor' || tile === 'door';
  }

  getTileAt(column: number, row: number): TileCode | undefined {
    if (!this.isInBounds(column, row)) {
      return undefined;
    }

    return this.tiles[row][column];
  }

  getTileAtWorldPosition(position: Vector2): TileCode | undefined {
    const column = Math.floor(position.x / this.tileSize);
    const row = Math.floor(position.y / this.tileSize);

    if (!this.isInBounds(column, row)) {
      return undefined;
    }

    return this.tiles[row][column];
  }

  isInBounds(column: number, row: number) {
    return column >= 0 && column < this.columns && row >= 0 && row < this.rows;
  }

  getPixelWidth() {
    return this.columns * this.tileSize;
  }

  getPixelHeight() {
    return this.rows * this.tileSize;
  }

  getClampedTileCoordinate(position: Vector2): { column: number; row: number } | undefined {
    const column = Math.floor(position.x / this.tileSize);
    const row = Math.floor(position.y / this.tileSize);

    if (!this.isInBounds(column, row)) {
      return undefined;
    }

    return { column, row };
  }
}

export class AreaManager {
  private readonly definitions: Map<AreaId, AreaDefinition>;
  private readonly areaCache = new Map<AreaId, AreaDerivedData>();
  private readonly discoveredAreas = new Set<AreaId>();
  private readonly exploration = new Map<AreaId, Set<string>>();
  private currentArea: LoadedArea;
  private lastKnownPlayerPosition: Vector2;

  constructor(
    startingAreaId: AreaId = AREA_IDS.CentralHub,
    definitions = createDefaultAreaDefinitions(),
    snapshot?: AreaManagerSnapshot,
  ) {
    this.definitions = new Map(definitions.map((def) => [def.id, def] as const));
    this.currentArea = this.loadArea(startingAreaId);
    this.lastKnownPlayerPosition = this.currentArea.playerSpawnPosition;

    if (snapshot) {
      this.restoreFromSnapshot(snapshot);
    }
  }

  getCurrentAreaState(): LoadedArea {
    return this.currentArea;
  }

  getTileAtWorldPosition(position: Vector2): TileCode | undefined {
    return this.currentArea.tileMap.getTileAtWorldPosition(position);
  }

  getExplorationState(areaId: AreaId): AreaExplorationState {
    const exploredTiles = this.exploration.get(areaId);
    const visitedTiles = exploredTiles?.size ?? 0;
    const { totalWalkableTiles } = this.getAreaDerivedData(areaId);

    const clampedVisited = Math.min(visitedTiles, totalWalkableTiles);
    const total = totalWalkableTiles || 1;
    const completion = totalWalkableTiles === 0 ? 0 : clampedVisited / total;

    return {
      visitedTiles: clampedVisited,
      totalTiles: total,
      completion,
    };
  }

  getDiscoveredAreas(): AreaId[] {
    return Array.from(this.discoveredAreas.values());
  }

  updatePlayerPosition(position: Vector2): AreaUpdateResult {
    this.lastKnownPlayerPosition = position;

    const areaId = this.currentArea.definition.id;
    this.markExplored(areaId, position);

    const transitionDirection =
      this.detectDoorTransition(position) ?? this.detectBoundaryCross(position);
    if (!transitionDirection) {
      return { areaChanged: false };
    }

    const targetAreaId = this.currentArea.definition.neighbors[transitionDirection];
    if (!targetAreaId) {
      return { areaChanged: false };
    }

    const from = this.currentArea.definition.id;
    const entryDirection = getOppositeDirection(transitionDirection);
    const nextArea = this.loadArea(targetAreaId, entryDirection);
    this.currentArea = nextArea;
    this.lastKnownPlayerPosition = nextArea.playerSpawnPosition;
    this.markExplored(nextArea.definition.id, nextArea.playerSpawnPosition);

    return {
      areaChanged: true,
      transition: {
        from,
        to: targetAreaId,
        via: transitionDirection,
        entryPosition: nextArea.playerSpawnPosition,
      },
    };
  }

  getLastKnownPlayerPosition(): Vector2 {
    return this.lastKnownPlayerPosition;
  }

  getPersistenceSnapshot(): AreaManagerSnapshot {
    return {
      currentAreaId: this.currentArea.definition.id,
      discoveredAreas: Array.from(this.discoveredAreas.values()),
      exploredTiles: this.serializeExploredTiles(),
      lastKnownPlayerPosition: { ...this.lastKnownPlayerPosition },
      completedAreas: [],
      collectedItems: [],
    } satisfies AreaManagerSnapshot;
  }

  restoreFromSnapshot(snapshot: AreaManagerSnapshot) {
    const sanitized = this.sanitizeSnapshot(snapshot);

    this.discoveredAreas.clear();
    this.exploration.clear();

    this.currentArea = this.loadArea(sanitized.currentAreaId);
    this.lastKnownPlayerPosition = clampToBounds(
      sanitized.lastKnownPlayerPosition,
      this.currentArea.pixelBounds,
    );

    const discovered = new Set<AreaId>(sanitized.discoveredAreas);
    discovered.add(this.currentArea.definition.id);

    discovered.forEach((areaId) => {
      if (!this.definitions.has(areaId)) {
        return;
      }

      this.discoveredAreas.add(areaId);
      this.ensureExplorationArea(areaId);
    });

    Object.entries(sanitized.exploredTiles).forEach(([areaId, tiles]) => {
      const typedAreaId = areaId as AreaId;
      if (!this.definitions.has(typedAreaId)) {
        return;
      }

      const areaExploration = this.ensureExplorationArea(typedAreaId);
      tiles.forEach((tile) => {
        if (this.isValidTileKey(typedAreaId, tile)) {
          areaExploration.add(tile);
        }
      });
    });
  }

  private loadArea(areaId: AreaId, entryDirection?: AreaTransitionDirection): LoadedArea {
    const definition = this.definitions.get(areaId);
    if (!definition) {
      throw new Error(`Unknown area id: ${areaId}`);
    }

    const derived = this.getAreaDerivedData(areaId);
    const spawn = this.resolveEntryPoint(definition, entryDirection);

    const area: LoadedArea = {
      definition,
      tileMap: derived.tileMap,
      pixelBounds: derived.pixelBounds,
      playerSpawnPosition: spawn,
    };

    this.discoveredAreas.add(areaId);
    if (!this.exploration.has(areaId)) {
      this.exploration.set(areaId, new Set());
    }

    return area;
  }

  getAllAreaMetadata(): AreaMetadata[] {
    return Array.from(this.definitions.values()).map((definition) => ({
      id: definition.id,
      name: definition.name,
    }));
  }

  private resolveEntryPoint(definition: AreaDefinition, entryDirection?: AreaTransitionDirection): Vector2 {
    if (entryDirection) {
      const entry = definition.entryPoints[entryDirection];
      if (entry) {
        return entry.position;
      }
    }

    return definition.entryPoints.default.position;
  }

  private detectDoorTransition(position: Vector2): AreaTransitionDirection | undefined {
    const { definition } = this.currentArea;
    const derived = this.getAreaDerivedData(definition.id);
    const coordinate = derived.tileMap.getClampedTileCoordinate(position);

    if (!coordinate) {
      return undefined;
    }

    const tile = derived.tileMap.getTileAt(coordinate.column, coordinate.row);
    if (tile !== 'door') {
      return undefined;
    }

    const doorKey = `${coordinate.column},${coordinate.row}`;
    const direction =
      derived.doorDirections.get(doorKey) ??
      inferDoorDirectionForTile(
        coordinate.column,
        coordinate.row,
        derived.tileMap,
        definition.neighbors,
      );

    if (!direction) {
      return undefined;
    }

    if (!definition.neighbors[direction]) {
      return undefined;
    }

    return direction;
  }

  private detectBoundaryCross(position: Vector2): AreaTransitionDirection | undefined {
    const { pixelBounds } = this.currentArea;
    const { width, height } = pixelBounds;

    if (position.x < 0) {
      return 'west';
    }

    if (position.x >= width) {
      return 'east';
    }

    if (position.y < 0) {
      return 'north';
    }

    if (position.y >= height) {
      return 'south';
    }

    return undefined;
  }

  private markExplored(areaId: AreaId, position: Vector2) {
    const derived = this.getAreaDerivedData(areaId);
    const coordinate = derived.tileMap.getClampedTileCoordinate(position);
    if (!coordinate) {
      return;
    }

    const key = `${coordinate.column},${coordinate.row}`;
    const areaExploration = this.ensureExplorationArea(areaId);
    areaExploration.add(key);
  }

  private ensureExplorationArea(areaId: AreaId) {
    let areaExploration = this.exploration.get(areaId);
    if (!areaExploration) {
      areaExploration = new Set<string>();
      this.exploration.set(areaId, areaExploration);
    }

    return areaExploration;
  }

  private serializeExploredTiles(): Record<AreaId, string[]> {
    const record: Partial<Record<AreaId, string[]>> = {};

    this.exploration.forEach((tiles, areaId) => {
      if (tiles.size === 0 || !this.definitions.has(areaId)) {
        return;
      }

      record[areaId] = Array.from(tiles.values());
    });

    return record as Record<AreaId, string[]>;
  }

  private sanitizeSnapshot(snapshot: AreaManagerSnapshot): AreaManagerSnapshot {
    const validCurrentArea = this.definitions.has(snapshot?.currentAreaId)
      ? snapshot.currentAreaId
      : AREA_IDS.CentralHub;

    const discoveredAreas = Array.isArray(snapshot?.discoveredAreas)
      ? Array.from(
          new Set(
            snapshot.discoveredAreas.filter((areaId): areaId is AreaId => this.definitions.has(areaId as AreaId)),
          ),
        )
      : [];

    const exploredTiles = this.sanitizeExploredTiles(snapshot?.exploredTiles ?? {});
    const lastKnownPlayerPosition = this.sanitizeVector(snapshot?.lastKnownPlayerPosition);

    return {
      currentAreaId: validCurrentArea,
      discoveredAreas,
      exploredTiles,
      lastKnownPlayerPosition,
    } satisfies AreaManagerSnapshot;
  }

  private sanitizeExploredTiles(input: Record<string, string[]>): Record<AreaId, string[]> {
    const sanitized: Partial<Record<AreaId, string[]>> = {};

    Object.entries(input).forEach(([areaId, tiles]) => {
      if (!this.definitions.has(areaId as AreaId) || !Array.isArray(tiles)) {
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

  private sanitizeVector(position?: Vector2): Vector2 {
    const x = Number.isFinite(position?.x) ? (position!.x as number) : 0;
    const y = Number.isFinite(position?.y) ? (position!.y as number) : 0;

    return { x, y } satisfies Vector2;
  }

  private isValidTileKey(areaId: AreaId, tile: string) {
    if (!TILE_KEY_PATTERN.test(tile)) {
      return false;
    }

    const [columnText, rowText] = tile.split(',');
    const column = Number.parseInt(columnText, 10);
    const row = Number.parseInt(rowText, 10);

    if (!Number.isFinite(column) || !Number.isFinite(row)) {
      return false;
    }

    const derived = this.getAreaDerivedData(areaId);
    return derived.tileMap.isInBounds(column, row);
  }

  private getAreaDerivedData(areaId: AreaId): AreaDerivedData {
    const cached = this.areaCache.get(areaId);
    if (cached) {
      return cached;
    }

    const definition = this.definitions.get(areaId);
    if (!definition) {
      throw new Error(`Unknown area id: ${areaId}`);
    }

    const tileMap = new TileMap(definition.layout, definition.tileSize);
    const doorDirections = new Map<string, AreaTransitionDirection>();

    for (let row = 0; row < tileMap.rows; row += 1) {
      for (let column = 0; column < tileMap.columns; column += 1) {
        if (tileMap.getTileAt(column, row) !== 'door') {
          continue;
        }

        const direction = inferDoorDirectionForTile(column, row, tileMap, definition.neighbors);
        if (!direction) {
          continue;
        }

        doorDirections.set(`${column},${row}`, direction);
      }
    }

    const derived: AreaDerivedData = {
      tileMap,
      pixelBounds: { width: tileMap.getPixelWidth(), height: tileMap.getPixelHeight() },
      totalWalkableTiles: tileMap.totalWalkableTiles,
      doorDirections,
    };

    this.areaCache.set(areaId, derived);
    return derived;
  }
}

function inferDoorDirectionForTile(
  column: number,
  row: number,
  tileMap: TileMap,
  neighbors?: Partial<Record<AreaTransitionDirection, AreaId>>,
): AreaTransitionDirection | undefined {
  const edgeOffset = 1;
  const candidates: Array<{
    direction: AreaTransitionDirection;
    interior?: { column: number; row: number };
  }> = [];

  if (row <= edgeOffset) {
    candidates.push({ direction: 'north', interior: row + 1 < tileMap.rows ? { column, row: row + 1 } : undefined });
  }

  if (row >= tileMap.rows - 1 - edgeOffset) {
    candidates.push({ direction: 'south', interior: row - 1 >= 0 ? { column, row: row - 1 } : undefined });
  }

  if (column <= edgeOffset) {
    candidates.push({ direction: 'west', interior: column + 1 < tileMap.columns ? { column: column + 1, row } : undefined });
  }

  if (column >= tileMap.columns - 1 - edgeOffset) {
    candidates.push({ direction: 'east', interior: column - 1 >= 0 ? { column: column - 1, row } : undefined });
  }

  const isWalkableTile = (tile?: TileCode) => tile === 'floor' || tile === 'door';

  const eligibleCandidates = neighbors
    ? candidates.filter((candidate) => neighbors[candidate.direction])
    : candidates;

  for (const candidate of eligibleCandidates) {
    if (!candidate.interior) {
      continue;
    }

    const interiorTile = tileMap.getTileAt(candidate.interior.column, candidate.interior.row);
    if (isWalkableTile(interiorTile)) {
      return candidate.direction;
    }
  }

  if (eligibleCandidates.length > 0) {
    return eligibleCandidates[0]?.direction;
  }

  return candidates[0]?.direction;
}

function clampToBounds(position: Vector2, bounds: { width: number; height: number }): Vector2 {
  const x = Number.isFinite(position?.x) ? position.x : 0;
  const y = Number.isFinite(position?.y) ? position.y : 0;

  const clampedX = Math.min(Math.max(0, x), Math.max(0, bounds.width - 1));
  const clampedY = Math.min(Math.max(0, y), Math.max(0, bounds.height - 1));

  return { x: clampedX, y: clampedY } satisfies Vector2;
}

function createDefaultAreaDefinitions(): AreaDefinition[] {
  return STAGE_DEFINITIONS.map((definition) => cloneStageDefinition(definition));
}
