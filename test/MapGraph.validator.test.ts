import { describe, expect, it } from 'vitest';
import { STAGE_DEFINITIONS } from '../src/game/world/stages';

const stageLookup = new Map(STAGE_DEFINITIONS.map((stage) => [stage.id, stage]));

describe('Map graph validator', () => {
  it('provides at least 128 area definitions with metadata', () => {
    expect(STAGE_DEFINITIONS.length).toBeGreaterThanOrEqual(128);
    const missingDoorBuffer = STAGE_DEFINITIONS.filter((stage) => typeof stage.doorBuffer !== 'number');
    expect(missingDoorBuffer.length).toBe(0);
  });

  it('ensures at least 20% of areas declare dead ends', () => {
    const stagesWithDeadEnds = STAGE_DEFINITIONS.filter((stage) => (stage.deadEnds?.length ?? 0) > 0);
    const ratio = stagesWithDeadEnds.length / STAGE_DEFINITIONS.length;
    expect(ratio).toBeGreaterThanOrEqual(0.2);
  });

  it('validates door links and safe radii', () => {
    STAGE_DEFINITIONS.forEach((stage) => {
      stage.doors?.forEach((door) => {
        const neighborId = stage.neighbors[door.direction];
        expect(neighborId).toBeDefined();
        expect(door.target).toBe(neighborId);
        if (neighborId) {
          expect(stageLookup.has(neighborId)).toBe(true);
        }
        expect(door.safeRadius).toBeGreaterThanOrEqual(stage.doorBuffer ?? 1);
      });
    });
  });
});
