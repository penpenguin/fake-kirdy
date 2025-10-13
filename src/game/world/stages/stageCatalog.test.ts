import { describe, expect, it } from 'vitest';
import { STAGE_DEFINITIONS } from './index';

function findStage(id: string) {
  return STAGE_DEFINITIONS.find((definition) => definition.id === id);
}

describe('Stage catalog', () => {
  it('includes a goal sanctum area connected to the fire area', () => {
    const fireArea = findStage('fire-area');
    expect(fireArea).toBeDefined();
    expect(fireArea?.neighbors?.north).toBe('goal-sanctum');

    const goalSanctum = findStage('goal-sanctum');
    expect(goalSanctum).toBeDefined();
    expect(goalSanctum?.neighbors?.south).toBe('fire-area');
    expect(goalSanctum?.neighbors?.north).toBe('sky-sanctum');
    expect(goalSanctum?.enemySpawns?.baseline).toBeGreaterThanOrEqual(1);

    const hasExitDoor = goalSanctum?.layout.some((row) => row.includes('D')) ?? false;
    expect(hasExitDoor).toBe(true);

    const tileSize = goalSanctum?.tileSize ?? 0;
    const southExit = goalSanctum?.entryPoints?.south;
    expect(southExit).toBeDefined();

    const doorPositions = goalSanctum?.layout.flatMap((row, rowIndex) =>
      [...row].flatMap((tile, columnIndex) => (tile === 'D' ? [{ rowIndex, columnIndex }] : [])),
    ) ?? [];
    const southernDoor = doorPositions.reduce<{ rowIndex: number; columnIndex: number } | undefined>((current, candidate) => {
      if (!current) {
        return candidate;
      }
      return candidate.rowIndex > current.rowIndex ? candidate : current;
    }, undefined);

    expect(southernDoor).toBeDefined();
    const expectedX = ((southernDoor?.columnIndex ?? 0) + 1) * tileSize;
    expect(southExit?.position.x).toBeCloseTo(expectedX, 6);
  });

  it('includes the sky sanctum branch connected north of the goal sanctum', () => {
    const skySanctum = findStage('sky-sanctum');
    expect(skySanctum).toBeDefined();
    expect(skySanctum?.neighbors?.south).toBe('goal-sanctum');
    expect(skySanctum?.neighbors?.east).toBe('aurora-spire');
    expect(skySanctum?.neighbors?.west).toBe('starlit-keep');

    const auroraSpire = findStage('aurora-spire');
    expect(auroraSpire?.neighbors?.west).toBe('sky-sanctum');

    const starlitKeep = findStage('starlit-keep');
    expect(starlitKeep?.neighbors?.east).toBe('sky-sanctum');
  });

  it('lays out aurora-spire as a vertical tower with safe west entry', () => {
    const auroraSpire = findStage('aurora-spire');
    expect(auroraSpire).toBeDefined();

    const layoutRows = auroraSpire?.layout.length ?? 0;
    expect(layoutRows).toBeGreaterThanOrEqual(11);

    const tileSize = auroraSpire?.tileSize ?? 0;
    const stageHeight = layoutRows * tileSize;
    const defaultSpawnY = auroraSpire?.entryPoints.default.position.y ?? 0;
    expect(defaultSpawnY).toBeGreaterThan(stageHeight / 2);

    const westEntry = auroraSpire?.entryPoints.west;
    expect(westEntry).toBeDefined();
    expect(westEntry?.facing).toBe('east');

    const spawnColumn = Math.floor((westEntry?.position.x ?? 0) / tileSize);
    const spawnRow = Math.floor((westEntry?.position.y ?? 0) / tileSize);
    const spawnRowLayout = auroraSpire?.layout[spawnRow] ?? '';
    const spawnSymbol = spawnRowLayout.charAt(spawnColumn);
    expect(['.', 'D'].includes(spawnSymbol)).toBe(true);
  });
});
