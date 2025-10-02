export const AREA_IDS = {
  CentralHub: 'central-hub',
  MirrorCorridor: 'mirror-corridor',
  IceArea: 'ice-area',
  FireArea: 'fire-area',
  ForestArea: 'forest-area',
  CaveArea: 'cave-area',
} as const;

export type AreaId = (typeof AREA_IDS)[keyof typeof AREA_IDS];
export type AreaTransitionDirection = 'north' | 'south' | 'east' | 'west';

export type TileCode = 'wall' | 'floor' | 'door' | 'void';

const TILE_KEY_PATTERN = /^\d+,\d+$/;

export interface Vector2 {
  x: number;
  y: number;
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
}

interface AreaEntryPoint {
  position: Vector2;
  facing?: AreaTransitionDirection;
}

interface AreaDefinition {
  id: AreaId;
  name: string;
  tileSize: number;
  layout: string[];
  neighbors: Partial<Record<AreaTransitionDirection, AreaId>>;
  entryPoints: { default: AreaEntryPoint } & Partial<Record<AreaTransitionDirection, AreaEntryPoint>>;
}

interface AreaDerivedData {
  tileMap: TileMap;
  pixelBounds: { width: number; height: number };
  totalWalkableTiles: number;
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

    const transitionDirection = this.detectBoundaryCross(position);
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
    const derived: AreaDerivedData = {
      tileMap,
      pixelBounds: { width: tileMap.getPixelWidth(), height: tileMap.getPixelHeight() },
      totalWalkableTiles: tileMap.totalWalkableTiles,
    };

    this.areaCache.set(areaId, derived);
    return derived;
  }
}

function clampToBounds(position: Vector2, bounds: { width: number; height: number }): Vector2 {
  const x = Number.isFinite(position?.x) ? position.x : 0;
  const y = Number.isFinite(position?.y) ? position.y : 0;

  const clampedX = Math.min(Math.max(0, x), Math.max(0, bounds.width - 1));
  const clampedY = Math.min(Math.max(0, y), Math.max(0, bounds.height - 1));

  return { x: clampedX, y: clampedY } satisfies Vector2;
}

function createDefaultAreaDefinitions(): AreaDefinition[] {
  const centralHubLayout = [
    '####################',
    '#..................#',
    '#..................#',
    '#....####..####....#',
    '#..................#',
    '#..................#',
    '#....####..####....#',
    '#..................#',
    '#..................#',
    '####################',
  ];

  const mirrorCorridorLayout = [
    '####################',
    '#..................#',
    '#..................#',
    '#..................#',
    '####################',
  ];

  const tileSize = 32;
  const centralHubWidth = centralHubLayout[0].length * tileSize;
  const centralHubHeight = centralHubLayout.length * tileSize;
  const mirrorCorridorWidth = mirrorCorridorLayout[0].length * tileSize;
  const mirrorCorridorHeight = mirrorCorridorLayout.length * tileSize;

  const iceAreaLayout = [
    '####################',
    '#....##......##....#',
    '#....##......##....#',
    '#..................#',
    '#..####......####..#',
    '#..................#',
    '####################',
  ];
  const iceAreaWidth = iceAreaLayout[0].length * tileSize;
  const iceAreaHeight = iceAreaLayout.length * tileSize;

  const forestAreaLayout = [
    '########################',
    '#......................#',
    '#..####..######..####..#',
    '#......................#',
    '#..####..######..####..#',
    '#......................#',
    '########################',
  ];
  const forestAreaWidth = forestAreaLayout[0].length * tileSize;
  const forestAreaHeight = forestAreaLayout.length * tileSize;

  const caveAreaLayout = [
    '####################',
    '#..................#',
    '#..######..######..#',
    '#..................#',
    '#..######..######..#',
    '#..................#',
    '####################',
  ];
  const caveAreaWidth = caveAreaLayout[0].length * tileSize;
  const caveAreaHeight = caveAreaLayout.length * tileSize;

  const fireAreaLayout = [
    '########################',
    '#......................#',
    '#..####..######..####..#',
    '#......................#',
    '#..####..######..####..#',
    '#......................#',
    '########################',
  ];
  const fireAreaWidth = fireAreaLayout[0].length * tileSize;
  const fireAreaHeight = fireAreaLayout.length * tileSize;

  const centralHub: AreaDefinition = {
    id: AREA_IDS.CentralHub,
    name: 'Central Hub',
    tileSize,
    layout: centralHubLayout,
    neighbors: {
      north: AREA_IDS.IceArea,
      east: AREA_IDS.MirrorCorridor,
      south: AREA_IDS.ForestArea,
      west: AREA_IDS.CaveArea,
    },
    entryPoints: {
      default: { position: { x: centralHubWidth / 2, y: centralHubHeight / 2 } },
      east: { position: { x: centralHubWidth - tileSize * 2, y: centralHubHeight / 2 } },
      west: { position: { x: tileSize * 2, y: centralHubHeight / 2 } },
      north: { position: { x: centralHubWidth / 2, y: tileSize * 2 } },
      south: { position: { x: centralHubWidth / 2, y: centralHubHeight - tileSize * 2 } },
    },
  };

  const mirrorCorridor: AreaDefinition = {
    id: AREA_IDS.MirrorCorridor,
    name: 'Mirror Corridor',
    tileSize,
    layout: mirrorCorridorLayout,
    neighbors: {
      west: AREA_IDS.CentralHub,
      east: AREA_IDS.FireArea,
    },
    entryPoints: {
      default: { position: { x: mirrorCorridorWidth / 2, y: mirrorCorridorHeight / 2 } },
      west: { position: { x: tileSize * 2, y: mirrorCorridorHeight / 2 } },
      east: { position: { x: mirrorCorridorWidth - tileSize * 2, y: mirrorCorridorHeight / 2 } },
      north: { position: { x: mirrorCorridorWidth / 2, y: tileSize } },
      south: { position: { x: mirrorCorridorWidth / 2, y: mirrorCorridorHeight - tileSize } },
    },
  };

  const iceArea: AreaDefinition = {
    id: AREA_IDS.IceArea,
    name: 'Ice Area',
    tileSize,
    layout: iceAreaLayout,
    neighbors: {
      south: AREA_IDS.CentralHub,
    },
    entryPoints: {
      default: { position: { x: iceAreaWidth / 2, y: iceAreaHeight - tileSize * 2 } },
      south: { position: { x: iceAreaWidth / 2, y: iceAreaHeight - tileSize * 2 } },
      north: { position: { x: iceAreaWidth / 2, y: tileSize * 2 } },
      east: { position: { x: iceAreaWidth - tileSize * 2, y: iceAreaHeight / 2 } },
      west: { position: { x: tileSize * 2, y: iceAreaHeight / 2 } },
    },
  };

  const forestArea: AreaDefinition = {
    id: AREA_IDS.ForestArea,
    name: 'Forest Area',
    tileSize,
    layout: forestAreaLayout,
    neighbors: {
      north: AREA_IDS.CentralHub,
    },
    entryPoints: {
      default: { position: { x: forestAreaWidth / 2, y: tileSize } },
      north: { position: { x: forestAreaWidth / 2, y: tileSize } },
      south: { position: { x: forestAreaWidth / 2, y: forestAreaHeight - tileSize * 2 } },
      east: { position: { x: forestAreaWidth - tileSize * 2, y: forestAreaHeight / 2 } },
      west: { position: { x: tileSize * 2, y: forestAreaHeight / 2 } },
    },
  };

  const caveArea: AreaDefinition = {
    id: AREA_IDS.CaveArea,
    name: 'Cave Area',
    tileSize,
    layout: caveAreaLayout,
    neighbors: {
      east: AREA_IDS.CentralHub,
    },
    entryPoints: {
      default: { position: { x: caveAreaWidth - tileSize * 2, y: caveAreaHeight / 2 } },
      east: { position: { x: caveAreaWidth - tileSize * 2, y: caveAreaHeight / 2 } },
      west: { position: { x: tileSize * 2, y: caveAreaHeight / 2 } },
      north: { position: { x: caveAreaWidth / 2, y: tileSize * 2 } },
      south: { position: { x: caveAreaWidth / 2, y: caveAreaHeight - tileSize * 2 } },
    },
  };

  const fireArea: AreaDefinition = {
    id: AREA_IDS.FireArea,
    name: 'Fire Area',
    tileSize,
    layout: fireAreaLayout,
    neighbors: {
      west: AREA_IDS.MirrorCorridor,
    },
    entryPoints: {
      default: { position: { x: tileSize * 2, y: fireAreaHeight / 2 } },
      west: { position: { x: tileSize * 2, y: fireAreaHeight / 2 } },
      east: { position: { x: fireAreaWidth - tileSize * 2, y: fireAreaHeight / 2 } },
      north: { position: { x: fireAreaWidth / 2, y: tileSize } },
      south: { position: { x: fireAreaWidth / 2, y: fireAreaHeight - tileSize * 2 } },
    },
  };

  return [centralHub, mirrorCorridor, iceArea, forestArea, caveArea, fireArea];
}
