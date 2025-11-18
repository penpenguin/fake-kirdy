import { beforeEach, describe, expect, it } from 'vitest';
import {
  AREA_IDS,
  AreaManager,
  type AreaDefinition,
  type AreaId,
  type AreaManagerSnapshot,
  type AreaTransitionDirection,
  type AreaUpdateResult,
  type TileCode,
} from './AreaManager';

function getOpposite(direction: AreaTransitionDirection): AreaTransitionDirection {
  const opposites: Record<AreaTransitionDirection, AreaTransitionDirection> = {
    north: 'south',
    south: 'north',
    east: 'west',
    west: 'east',
    northeast: 'southwest',
    northwest: 'southeast',
    southeast: 'northwest',
    southwest: 'northeast',
  };

  return opposites[direction];
}

function getDoorWorldPosition(
  area: ReturnType<AreaManager['getCurrentAreaState']>,
  direction: AreaTransitionDirection,
) {
  const { tileMap } = area;
  const { columns, rows, tileSize } = tileMap;

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if (tileMap.getTileAt(column, row) !== 'door') {
        continue;
      }

      if (!isDoorCoordinateForDirection(column, row, tileMap, direction)) {
        continue;
      }

      return {
        x: column * tileSize + tileSize / 2,
        y: row * tileSize + tileSize / 2,
      } as const;
    }
  }

  throw new Error(`Door for direction ${direction} not found`);
}

function isDoorCoordinateForDirection(
  column: number,
  row: number,
  tileMap: ReturnType<AreaManager['getCurrentAreaState']>['tileMap'],
  direction: AreaTransitionDirection,
) {
  const edgeOffset = 1;
  switch (direction) {
    case 'north':
      return row <= edgeOffset && column > edgeOffset && column < tileMap.columns - 1 - edgeOffset;
    case 'south':
      return row >= tileMap.rows - 1 - edgeOffset && column > edgeOffset && column < tileMap.columns - 1 - edgeOffset;
    case 'west':
      return column <= edgeOffset && row > edgeOffset && row < tileMap.rows - 1 - edgeOffset;
    case 'east':
      return column >= tileMap.columns - 1 - edgeOffset && row > edgeOffset && row < tileMap.rows - 1 - edgeOffset;
    case 'northwest':
      return row <= edgeOffset && column <= edgeOffset;
    case 'northeast':
      return row <= edgeOffset && column >= tileMap.columns - 1 - edgeOffset;
    case 'southwest':
      return row >= tileMap.rows - 1 - edgeOffset && column <= edgeOffset;
    case 'southeast':
      return row >= tileMap.rows - 1 - edgeOffset && column >= tileMap.columns - 1 - edgeOffset;
    default: {
      const _never: never = direction;
      return _never;
    }
  }
}

function countReachableWalkableTiles(
  tileMap: ReturnType<AreaManager['getCurrentAreaState']>['tileMap'],
  startColumn: number,
  startRow: number,
) {
  const deltas = [
    { column: 1, row: 0 },
    { column: -1, row: 0 },
    { column: 0, row: 1 },
    { column: 0, row: -1 },
  ];
  const visited = new Set<string>();
  const queue: Array<{ column: number; row: number }> = [{ column: startColumn, row: startRow }];
  const isWalkable = (tile?: TileCode) => tile === 'floor' || tile === 'door';

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    if (!tileMap.isInBounds(current.column, current.row)) {
      continue;
    }

    const key = `${current.column},${current.row}`;
    if (visited.has(key)) {
      continue;
    }

    const tile = tileMap.getTileAt(current.column, current.row);
    if (!isWalkable(tile)) {
      continue;
    }

    visited.add(key);

    deltas.forEach((delta) => {
      queue.push({ column: current.column + delta.column, row: current.row + delta.row });
    });
  }

  return visited.size;
}

describe('AreaManager', () => {
  let manager: AreaManager;

  beforeEach(() => {
    manager = new AreaManager();
  });

  function createStubDefinition(id: AreaId, name: string): AreaDefinition {
    return {
      id,
      name,
      tileSize: 16,
      layout: ['##', '##'],
      neighbors: {},
      entryPoints: { default: { position: { x: 0, y: 0 } } },
    };
  }

  it('中央ハブエリアを初期読み込みし、タイルの種類を参照できる', () => {
    const current = manager.getCurrentAreaState();

    expect(current.definition.id).toBe(AREA_IDS.CentralHub);
    expect(current.tileMap.tileSize).toBe(32);
    expect(current.tileMap.columns).toBeGreaterThan(0);
    expect(current.tileMap.rows).toBeGreaterThan(0);

    const topLeftTile = manager.getTileAtWorldPosition({ x: 0, y: 0 });
    const interiorTile = manager.getTileAtWorldPosition({
      x: current.tileMap.tileSize * 4,
      y: current.tileMap.tileSize * 4,
    });

    expect(topLeftTile).toBe('wall');
    expect(interiorTile).toBe('floor');
  });

  it('中央ハブのエリア切替地点はドアタイルとして識別できる', () => {
    const current = manager.getCurrentAreaState();
    const tileMap = current.tileMap;
    const doors = current.definition.doors ?? [];
    const directions: AreaTransitionDirection[] = [
      'northwest',
      'northeast',
      'southwest',
      'southeast',
      'north',
    ];

    directions.forEach((direction) => {
      const door = doors.find((candidate) => candidate.direction === direction);
      expect(door).toBeDefined();
      if (!door) {
        throw new Error(`ドア metadata missing for ${direction}`);
      }

      const { column, row } = door.tile;
      expect(tileMap.getTileAt(column, row)).toBe('door');
    });
  });

  it('ドアタイルを踏むと隣接エリアへ遷移する', () => {
    const initial = manager.getCurrentAreaState();
    const northeastDoorPosition = getDoorWorldPosition(initial, 'northeast');

    const result = manager.updatePlayerPosition(northeastDoorPosition);

    expect(result.areaChanged).toBe(true);
    expect(result.transition?.from).toBe(AREA_IDS.CentralHub);
    expect(result.transition?.to).toBeDefined();
    expect(result.transition?.via).toBe('northeast');

    const current = manager.getCurrentAreaState();
    expect(current.definition.id).toBe(result.transition?.to);

    const entryPoint = current.playerSpawnPosition;
    expect(entryPoint).toEqual(result.transition?.entryPosition);

    // 新エリアで反対方向に戻ると中央ハブに帰る
    const returnDoorPosition = getDoorWorldPosition(current, getOpposite(result.transition!.via));
    const returnResult = manager.updatePlayerPosition(returnDoorPosition);

    expect(returnResult.areaChanged).toBe(true);
    expect(returnResult.transition?.from).toBe(current.definition.id);
    expect(returnResult.transition?.to).toBe(AREA_IDS.CentralHub);
    expect(returnResult.transition?.via).toBe(getOpposite(result.transition!.via));
  });

  it('中央ハブの角ドアから各基幹エリアへ分岐できる', () => {
    const cases: Array<{
      direction: AreaTransitionDirection;
      expectedArea: typeof AREA_IDS[keyof typeof AREA_IDS];
    }> = [
      {
        direction: 'northwest',
        expectedArea: AREA_IDS.IceArea,
      },
      {
        direction: 'northeast',
        expectedArea: AREA_IDS.FireArea,
      },
      {
        direction: 'southeast',
        expectedArea: AREA_IDS.ForestArea,
      },
      {
        direction: 'southwest',
        expectedArea: AREA_IDS.CaveArea,
      },
    ];

    for (const testCase of cases) {
      const localManager = new AreaManager();
      const hub = localManager.getCurrentAreaState();

      const result = localManager.updatePlayerPosition(
        getDoorWorldPosition(hub, testCase.direction),
      );

      expect(result.areaChanged).toBe(true);
      expect(result.transition?.via).toBe(testCase.direction);
      expect(result.transition?.to).toBe(testCase.expectedArea);

      const branchedArea = localManager.getCurrentAreaState();

      const returnResult = localManager.updatePlayerPosition(
        getDoorWorldPosition(branchedArea, getOpposite(testCase.direction)),
      );

      expect(returnResult.areaChanged).toBe(true);
      expect(returnResult.transition?.to).toBe(AREA_IDS.CentralHub);
      expect(returnResult.transition?.via).toBe(getOpposite(testCase.direction));
    }
  });

  it('中央ハブ北扉は4つの遺物を集めるまで開放されない', () => {
    const localManager = new AreaManager();
    const attemptBefore = localManager.updatePlayerPosition(
      getDoorWorldPosition(localManager.getCurrentAreaState(), 'north'),
    );

    expect(attemptBefore.areaChanged).toBe(false);

    ['forest-keystone', 'ice-keystone', 'fire-keystone', 'cave-keystone'].forEach((itemId) => {
      localManager.recordCollectibleItem(itemId);
    });

    const snapshot = localManager.getPersistenceSnapshot();
    expect(snapshot.collectedItems).toEqual(
      expect.arrayContaining([
        'forest-keystone',
        'ice-keystone',
        'fire-keystone',
        'cave-keystone',
      ]),
    );
    expect(new Set(snapshot.collectedItems).size).toBe(4);

    const unlockedAttempt = localManager.updatePlayerPosition(
      getDoorWorldPosition(localManager.getCurrentAreaState(), 'north'),
    );

    expect(unlockedAttempt.areaChanged).toBe(true);
    expect(unlockedAttempt.transition?.to).toBe(AREA_IDS.MirrorCorridor);
    expect(unlockedAttempt.transition?.via).toBe('north');

    const mirror = localManager.getCurrentAreaState();
    const backToHub = localManager.updatePlayerPosition(
      getDoorWorldPosition(mirror, getOpposite('north')),
    );

    expect(backToHub.areaChanged).toBe(true);
    expect(backToHub.transition?.to).toBe(AREA_IDS.CentralHub);
    expect(backToHub.transition?.via).toBe('south');
  });

  it('Mirror Corridor の北扉から Goal Sanctum へ接続する', () => {
    const localManager = new AreaManager(AREA_IDS.MirrorCorridor);
    const mirror = localManager.getCurrentAreaState();

    const result = localManager.updatePlayerPosition(getDoorWorldPosition(mirror, 'north'));

    expect(result.areaChanged).toBe(true);
    expect(result.transition?.from).toBe(AREA_IDS.MirrorCorridor);
    expect(result.transition?.to).toBe(AREA_IDS.GoalSanctum);
    expect(result.transition?.via).toBe('north');

    const goal = localManager.getCurrentAreaState();
    const backToMirror = localManager.updatePlayerPosition(getDoorWorldPosition(goal, 'south'));

    expect(backToMirror.areaChanged).toBe(true);
    expect(backToMirror.transition?.to).toBe(AREA_IDS.MirrorCorridor);
    expect(backToMirror.transition?.via).toBe('south');
  });

  it('Fire Area からは Mirror Corridor や Goal Sanctum へ直接進入できない', () => {
    const localManager = new AreaManager();
    const hub = localManager.getCurrentAreaState();

    const toFire = localManager.updatePlayerPosition(getDoorWorldPosition(hub, 'northeast'));
    expect(toFire.areaChanged).toBe(true);
    expect(toFire.transition?.to).toBe(AREA_IDS.FireArea);

    const fireArea = localManager.getCurrentAreaState();
    const fireDoors = fireArea.definition.doors ?? [];
    const mirrorDoor = fireDoors.find((door) => door.target === AREA_IDS.MirrorCorridor);
    const goalDoor = fireDoors.find((door) => door.target === AREA_IDS.GoalSanctum);

    expect(mirrorDoor).toBeUndefined();
    expect(goalDoor).toBeUndefined();
    expect(fireArea.definition.neighbors.north).toBeUndefined();
  });

  it('森林エリアのスポーン地点は床タイルになる', () => {
    const hub = manager.getCurrentAreaState();
    const doorToForest = getDoorWorldPosition(hub, 'southeast');

    const transition = manager.updatePlayerPosition(doorToForest);

    expect(transition.areaChanged).toBe(true);
    expect(transition.transition?.to).toBe(AREA_IDS.ForestArea);

    const forest = manager.getCurrentAreaState();
    const spawnTile = forest.tileMap.getTileAtWorldPosition(forest.playerSpawnPosition);

    expect(spawnTile).toBe('floor');
  });

  it('starlit-keep のデフォルトスポーンは歩行可能タイルになる', () => {
    const branchManager = new AreaManager(AREA_IDS.StarlitKeep);
    const starlitKeep = branchManager.getCurrentAreaState();
    const spawnTile = starlitKeep.tileMap.getTileAtWorldPosition(starlitKeep.playerSpawnPosition);

    expect(spawnTile === 'floor' || spawnTile === 'door').toBe(true);
  });

  it('sky-sanctum から starlit-keep へ入った直後にエリアが戻らない', () => {
    const branchManager = new AreaManager(AREA_IDS.SkySanctum);
    const skySanctum = branchManager.getCurrentAreaState();

    const westDoorPosition = getDoorWorldPosition(skySanctum, 'west');
    const transition = branchManager.updatePlayerPosition(westDoorPosition);

    expect(transition.areaChanged).toBe(true);
    expect(transition.transition?.to).toBe(AREA_IDS.StarlitKeep);

    const starlitKeep = branchManager.getCurrentAreaState();
    const spawnTile = starlitKeep.tileMap.getTileAtWorldPosition(starlitKeep.playerSpawnPosition);
    expect(spawnTile).toBe('floor');

    const immediateUpdate = branchManager.updatePlayerPosition(starlitKeep.playerSpawnPosition);
    expect(immediateUpdate.areaChanged).toBe(false);
  });

  it('goal-sanctum の北扉から sky-sanctum へ遷移する', () => {
    const branchManager = new AreaManager(AREA_IDS.GoalSanctum);
    const goalSanctumState = branchManager.getCurrentAreaState();

    const result = branchManager.updatePlayerPosition(
      getDoorWorldPosition(goalSanctumState, 'north'),
    );

    expect(result.areaChanged).toBe(true);
    expect(result.transition?.from).toBe(AREA_IDS.GoalSanctum);
    expect(result.transition?.to).toBe(AREA_IDS.SkySanctum);
    expect(result.transition?.via).toBe('north');

    const skySanctum = branchManager.getCurrentAreaState();
    expect(skySanctum.definition.id).toBe(AREA_IDS.SkySanctum);
  });

  it('aurora-spire の西扉から sky-sanctum へ遷移する', () => {
    const branchManager = new AreaManager(AREA_IDS.AuroraSpire);
    const auroraSpireState = branchManager.getCurrentAreaState();

    const westDoorPosition = getDoorWorldPosition(auroraSpireState, 'west');

    const result = branchManager.updatePlayerPosition(westDoorPosition);

    expect(result.areaChanged).toBe(true);
    expect(result.transition?.from).toBe(AREA_IDS.AuroraSpire);
    expect(result.transition?.to).toBe(AREA_IDS.SkySanctum);
    expect(result.transition?.via).toBe('west');

    const skySanctum = branchManager.getCurrentAreaState();
    expect(skySanctum.definition.id).toBe(AREA_IDS.SkySanctum);
  });

  it('aurora-spire の歩行可能タイルは既定スポーンから全て到達できる', () => {
    const branchManager = new AreaManager(AREA_IDS.AuroraSpire);
    const auroraSpireState = branchManager.getCurrentAreaState();
    const { tileMap, playerSpawnPosition } = auroraSpireState;

    const spawnColumn = Math.floor(playerSpawnPosition.x / tileMap.tileSize);
    const spawnRow = Math.floor(playerSpawnPosition.y / tileMap.tileSize);

    const reachable = countReachableWalkableTiles(tileMap, spawnColumn, spawnRow);

    expect(reachable).toBe(tileMap.totalWalkableTiles);
  });

  it('探索済みエリア情報を記録し、訪問済みエリアを管理する', () => {
    const centralHub = manager.getCurrentAreaState();

    // 2タイル分を探索
    manager.updatePlayerPosition({
      x: centralHub.tileMap.tileSize * 2,
      y: centralHub.tileMap.tileSize * 2,
    });
    manager.updatePlayerPosition({
      x: centralHub.tileMap.tileSize * 3,
      y: centralHub.tileMap.tileSize * 2,
    });

    const exploration = manager.getExplorationState(AREA_IDS.CentralHub);
    expect(exploration.visitedTiles).toBeGreaterThanOrEqual(2);
    expect(exploration.totalTiles).toBeGreaterThan(exploration.visitedTiles);
    expect(exploration.completion).toBeGreaterThan(0);
    expect(manager.getDiscoveredAreas()).toContain(AREA_IDS.CentralHub);

    // エリア遷移で新エリアも発見済みに追加
    const transition = manager.updatePlayerPosition(getDoorWorldPosition(centralHub, 'northeast'));

    expect(transition.areaChanged).toBe(true);
    if (transition.transition) {
      const discovered = manager.getDiscoveredAreas();
      expect(discovered).toContain(transition.transition.to);
    }
  });

  it('エリアのメタデータを一覧で取得できる', () => {
    const metadata = manager.getAllAreaMetadata();

    expect(metadata).toEqual(
      expect.arrayContaining([
        { id: AREA_IDS.CentralHub, name: 'Central Hub' },
        { id: AREA_IDS.MirrorCorridor, name: 'Mirror Corridor' },
        { id: AREA_IDS.IceArea, name: 'Ice Area' },
        { id: AREA_IDS.FireArea, name: 'Fire Area' },
        { id: AREA_IDS.ForestArea, name: 'Forest Area' },
        { id: AREA_IDS.CaveArea, name: 'Cave Area' },
        { id: AREA_IDS.GoalSanctum, name: 'Goal Sanctum' },
        { id: AREA_IDS.SkySanctum, name: 'Sky Sanctum' },
        { id: AREA_IDS.AuroraSpire, name: 'Aurora Spire' },
        { id: AREA_IDS.StarlitKeep, name: 'Starlit Keep' },
      ]),
    );
  });

  it('同名エリア定義を渡してもユニークな名称へ自動変換する', () => {
    const duplicateA = createStubDefinition('labyrinth-900' as AreaId, 'Duplicate Area');
    const duplicateB = createStubDefinition('labyrinth-901' as AreaId, 'Duplicate Area');

    const customManager = new AreaManager(duplicateA.id, [duplicateA, duplicateB]);
    const metadata = customManager
      .getAllAreaMetadata()
      .filter((entry) => entry.id === duplicateA.id || entry.id === duplicateB.id);

    expect(metadata).toEqual([
      { id: duplicateA.id, name: 'Duplicate Area' },
      { id: duplicateB.id, name: 'Duplicate Area (2)' },
    ]);
  });

  it('探索状態をスナップショットとして保存できる', () => {
    const centralHub = manager.getCurrentAreaState();

    manager.updatePlayerPosition({ x: centralHub.tileMap.tileSize * 2, y: centralHub.tileMap.tileSize * 3 });
    manager.updatePlayerPosition({ x: centralHub.tileMap.tileSize * 7, y: centralHub.tileMap.tileSize * 3 });
    manager.updatePlayerPosition(getDoorWorldPosition(manager.getCurrentAreaState(), 'northeast'));

    const snapshot = manager.getPersistenceSnapshot();

    expect(snapshot.currentAreaId).toBe(AREA_IDS.FireArea);
    expect(snapshot.discoveredAreas).toEqual(
      expect.arrayContaining([AREA_IDS.CentralHub, AREA_IDS.FireArea]),
    );
    expect(snapshot.exploredTiles[AREA_IDS.CentralHub]?.length).toBeGreaterThan(0);
    expect(snapshot.lastKnownPlayerPosition).toEqual(manager.getLastKnownPlayerPosition());
    expect(snapshot.collectedItems).toEqual([]);
  });

  it('スナップショットから状態を復元し、不正な値を除去する', () => {
    const snapshot: AreaManagerSnapshot = {
      currentAreaId: AREA_IDS.MirrorCorridor,
      discoveredAreas: [AREA_IDS.MirrorCorridor, AREA_IDS.CentralHub, 'unknown-area' as never],
      exploredTiles: {
        [AREA_IDS.CentralHub]: ['1,1', 'not-a-tile'],
        [AREA_IDS.MirrorCorridor]: ['0,0', '0,0', '2,2'],
        unknown: ['0,0'],
      } as Record<string, string[]>,
      lastKnownPlayerPosition: { x: 128, y: 96 },
      collectedItems: ['forest-keystone', '', 'forest-keystone', 42 as never],
    };

    manager.restoreFromSnapshot(snapshot);

    const current = manager.getCurrentAreaState();
    expect(current.definition.id).toBe(AREA_IDS.MirrorCorridor);
    expect(manager.getDiscoveredAreas()).toEqual(
      expect.arrayContaining([AREA_IDS.CentralHub, AREA_IDS.MirrorCorridor]),
    );

    const mirrorExploration = manager.getExplorationState(AREA_IDS.MirrorCorridor);
    expect(mirrorExploration.visitedTiles).toBeGreaterThanOrEqual(2);

    const hubExploration = manager.getExplorationState(AREA_IDS.CentralHub);
    expect(hubExploration.visitedTiles).toBeGreaterThanOrEqual(1);

    expect(manager.getLastKnownPlayerPosition()).toEqual({ x: 128, y: 96 });

    const restoredSnapshot = manager.getPersistenceSnapshot();
    expect(restoredSnapshot.collectedItems).toEqual(['forest-keystone']);
  });

  it('無効なスナップショットでは安全な既定値を使用する', () => {
    const snapshot = {
      currentAreaId: 'mystery-zone',
      discoveredAreas: ['mystery-zone'],
      exploredTiles: {
        'mystery-zone': ['a,b'],
      },
      lastKnownPlayerPosition: { x: Number.NaN, y: Number.POSITIVE_INFINITY },
    } as unknown as AreaManagerSnapshot;

    manager.restoreFromSnapshot(snapshot);

    const current = manager.getCurrentAreaState();
    expect(current.definition.id).toBe(AREA_IDS.CentralHub);
    expect(manager.getDiscoveredAreas()).toEqual([AREA_IDS.CentralHub]);

    const exploration = manager.getExplorationState(AREA_IDS.CentralHub);
    expect(exploration.visitedTiles).toBe(0);
    expect(manager.getLastKnownPlayerPosition()).toEqual({ x: 0, y: 0 });
  });
});
