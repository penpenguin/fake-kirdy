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
});
