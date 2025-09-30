import { beforeEach, describe, expect, it } from 'vitest';
import {
  AREA_IDS,
  AreaManager,
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
});
