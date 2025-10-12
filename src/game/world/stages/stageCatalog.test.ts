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
    expect(goalSanctum?.enemySpawns?.baseline).toBeGreaterThanOrEqual(1);

    const hasExitDoor = goalSanctum?.layout.some((row) => row.includes('D')) ?? false;
    expect(hasExitDoor).toBe(true);
  });
});
