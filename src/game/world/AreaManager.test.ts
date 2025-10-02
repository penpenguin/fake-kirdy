import { beforeEach, describe, expect, it } from 'vitest';
import {
  AREA_IDS,
  AreaManager,
  type AreaManagerSnapshot,
  type AreaTransitionDirection,
  type AreaUpdateResult,
} from './AreaManager';

function getOpposite(direction: AreaTransitionDirection): AreaTransitionDirection {
  const opposites: Record<AreaTransitionDirection, AreaTransitionDirection> = {
    north: 'south',
    south: 'north',
    east: 'west',
    west: 'east',
  };

  return opposites[direction];
}

describe('AreaManager', () => {
  let manager: AreaManager;

  beforeEach(() => {
    manager = new AreaManager();
  });

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

  it('エリア境界を超えたときに隣接エリアへ遷移する', () => {
    const initial = manager.getCurrentAreaState();
    const y = (initial.tileMap.tileSize * initial.tileMap.rows) / 2;

    const result = manager.updatePlayerPosition({
      x: initial.pixelBounds.width + initial.tileMap.tileSize,
      y,
    });

    expect(result.areaChanged).toBe(true);
    expect(result.transition?.from).toBe(AREA_IDS.CentralHub);
    expect(result.transition?.to).toBeDefined();
    expect(result.transition?.via).toBe('east');

    const current = manager.getCurrentAreaState();
    expect(current.definition.id).toBe(result.transition?.to);

    const entryPoint = current.playerSpawnPosition;
    expect(entryPoint).toEqual(result.transition?.entryPosition);

    // 新エリアで反対方向に戻ると中央ハブに帰る
    const returnResult = manager.updatePlayerPosition({
      x: -initial.tileMap.tileSize,
      y: entryPoint.y,
    });

    expect(returnResult.areaChanged).toBe(true);
    expect(returnResult.transition?.from).toBe(current.definition.id);
    expect(returnResult.transition?.to).toBe(AREA_IDS.CentralHub);
    expect(returnResult.transition?.via).toBe(getOpposite(result.transition!.via));
  });

  it('中央ハブから各方角の迷宮エリアへ分岐できる', () => {
    const cases: Array<{
      direction: AreaTransitionDirection;
      move: (area: ReturnType<AreaManager['getCurrentAreaState']>) => { x: number; y: number };
      expectedArea: typeof AREA_IDS[keyof typeof AREA_IDS];
    }> = [
      {
        direction: 'north',
        move: (area) => ({ x: area.pixelBounds.width / 2, y: -area.tileMap.tileSize }),
        expectedArea: AREA_IDS.IceArea,
      },
      {
        direction: 'south',
        move: (area) => ({
          x: area.pixelBounds.width / 2,
          y: area.pixelBounds.height + area.tileMap.tileSize,
        }),
        expectedArea: AREA_IDS.ForestArea,
      },
      {
        direction: 'west',
        move: (area) => ({ x: -area.tileMap.tileSize, y: area.pixelBounds.height / 2 }),
        expectedArea: AREA_IDS.CaveArea,
      },
      {
        direction: 'east',
        move: (area) => ({
          x: area.pixelBounds.width + area.tileMap.tileSize,
          y: area.pixelBounds.height / 2,
        }),
        expectedArea: AREA_IDS.MirrorCorridor,
      },
    ];

    for (const testCase of cases) {
      const localManager = new AreaManager();
      const hub = localManager.getCurrentAreaState();

      const result = localManager.updatePlayerPosition(testCase.move(hub));

      expect(result.areaChanged).toBe(true);
      expect(result.transition?.via).toBe(testCase.direction);
      expect(result.transition?.to).toBe(testCase.expectedArea);

      const branchedArea = localManager.getCurrentAreaState();

      const returnMove = (() => {
        const tileSize = branchedArea.tileMap.tileSize;
        const { width, height } = branchedArea.pixelBounds;

        switch (testCase.direction) {
          case 'north':
            return { x: width / 2, y: height + tileSize };
          case 'south':
            return { x: width / 2, y: -tileSize };
          case 'east':
            return { x: -tileSize, y: height / 2 };
          case 'west':
            return { x: width + tileSize, y: height / 2 };
          default:
            return { x: width / 2, y: height / 2 };
        }
      })();

      const returnResult = localManager.updatePlayerPosition(returnMove);

      expect(returnResult.areaChanged).toBe(true);
      expect(returnResult.transition?.to).toBe(AREA_IDS.CentralHub);
      expect(returnResult.transition?.via).toBe(getOpposite(testCase.direction));
    }
  });

  it('ミラー回廊をさらに探索すると火炎領域へ接続する', () => {
    const hub = manager.getCurrentAreaState();

    // 東側に移動してミラー回廊へ
    manager.updatePlayerPosition({
      x: hub.pixelBounds.width + hub.tileMap.tileSize,
      y: hub.pixelBounds.height / 2,
    });

    const mirror = manager.getCurrentAreaState();

    const result = manager.updatePlayerPosition({
      x: mirror.pixelBounds.width + mirror.tileMap.tileSize,
      y: mirror.pixelBounds.height / 2,
    });

    expect(result.areaChanged).toBe(true);
    expect(result.transition?.from).toBe(AREA_IDS.MirrorCorridor);
    expect(result.transition?.to).toBe(AREA_IDS.FireArea);
    expect(result.transition?.via).toBe('east');
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
    const transition = manager.updatePlayerPosition({
      x: centralHub.pixelBounds.width + centralHub.tileMap.tileSize,
      y: centralHub.tileMap.tileSize * 4,
    });

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
      ]),
    );
  });

  it('探索状態をスナップショットとして保存できる', () => {
    const centralHub = manager.getCurrentAreaState();

    manager.updatePlayerPosition({ x: centralHub.tileMap.tileSize * 2, y: centralHub.tileMap.tileSize * 3 });
    manager.updatePlayerPosition({ x: centralHub.tileMap.tileSize * 7, y: centralHub.tileMap.tileSize * 3 });
    manager.updatePlayerPosition({ x: centralHub.pixelBounds.width + centralHub.tileMap.tileSize, y: centralHub.tileMap.tileSize * 5 });

    const snapshot = manager.getPersistenceSnapshot();

    expect(snapshot.currentAreaId).toBe(AREA_IDS.MirrorCorridor);
    expect(snapshot.discoveredAreas).toEqual(
      expect.arrayContaining([AREA_IDS.CentralHub, AREA_IDS.MirrorCorridor]),
    );
    expect(snapshot.exploredTiles[AREA_IDS.CentralHub]?.length).toBeGreaterThan(0);
    expect(snapshot.lastKnownPlayerPosition).toEqual(manager.getLastKnownPlayerPosition());
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
