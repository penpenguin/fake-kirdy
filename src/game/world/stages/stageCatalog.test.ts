import { describe, expect, it } from 'vitest';
import type { AreaTransitionDirection } from '../AreaManager';
import { STAGE_DEFINITIONS } from './index';

function findStage(id: string) {
  return STAGE_DEFINITIONS.find((definition) => definition.id === id);
}

const DIRECTIONS: AreaTransitionDirection[] = [
  'north',
  'south',
  'east',
  'west',
  'northeast',
  'northwest',
  'southeast',
  'southwest',
];

describe('Stage catalog', () => {

  it('connects goal sanctum north to sky sanctum and south to mirror corridor', () => {
    const fireArea = findStage('fire-area');
    expect(fireArea).toBeDefined();
    expect(fireArea?.neighbors?.north).toBeUndefined();

    const goalSanctum = findStage('goal-sanctum');
    expect(goalSanctum).toBeDefined();
    expect(goalSanctum?.neighbors?.south).toBe('mirror-corridor');
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

  it('annotates central hub door safety data and dead ends for heal placement', () => {
    const centralHub = findStage('central-hub');
    expect(centralHub).toBeDefined();
    expect(centralHub?.doorBuffer).toBeGreaterThanOrEqual(1);
    expect(centralHub?.doors?.length).toBe(5);
    const doorWithMetadata = centralHub?.doors?.find((door) => Boolean(door.id && door.safeRadius));
    expect(doorWithMetadata?.direction).toBeTruthy();
    expect(doorWithMetadata?.tile).toBeDefined();
    expect(centralHub?.deadEnds?.length).toBeGreaterThan(0);
    expect(centralHub?.deadEnds?.[0]?.reward).toBeTruthy();
  });

  it('routes the mirror corridor above the central hub and detaches it from the fire area', () => {
    const centralHub = findStage('central-hub');
    const mirror = findStage('mirror-corridor');

    expect(centralHub?.neighbors?.north).toBe('mirror-corridor');
    expect(mirror?.neighbors?.south).toBe('central-hub');
    expect(mirror?.neighbors?.north).toBe('goal-sanctum');
    expect(mirror?.neighbors?.west).toBeUndefined();
  });

  it('connects the forest area to the labyrinth entry branch', () => {
    const forest = findStage('forest-area');
    expect(forest?.neighbors?.east).toBe('labyrinth-001');

    const labyrinthEntry = findStage('labyrinth-001');
    expect(labyrinthEntry).toBeDefined();
    expect(labyrinthEntry?.neighbors?.west).toBe('forest-area');
  });

  it('keeps directional entry points safely away from their connecting doors', () => {
    STAGE_DEFINITIONS.forEach((stage) => {
      DIRECTIONS.forEach((direction) => {
        const neighbor = stage.neighbors[direction];
        if (!neighbor) {
          return;
        }

        const entry = stage.entryPoints[direction];
        expect(entry).toBeDefined();
        if (!entry) {
          throw new Error(`${stage.id} should define an entry point for ${direction}`);
        }

        const matchingDoor = stage.doors?.find((door) => door.direction === direction && door.target === neighbor);
        expect(matchingDoor).toBeDefined();
        if (!matchingDoor) {
          throw new Error(`${stage.id} should define a door for ${direction}`);
        }

        const usesVerticalAxis = direction.includes('north') || direction.includes('south');
        const axis = usesVerticalAxis ? 'y' : 'x';
        const inwardSign = axis === 'y' ? (direction.includes('north') ? 1 : -1) : direction.includes('west') ? 1 : -1;
        const separation = (entry.position[axis] - matchingDoor.position[axis]) * inwardSign;
        const safeRadiusTiles = Math.max(matchingDoor.safeRadius ?? stage.doorBuffer ?? 1, 1);
        const minDistance = (safeRadiusTiles + 1) * stage.tileSize;

        expect(separation).toBeGreaterThanOrEqual(minDistance);
      });
    });
  });

  it('limits forest expanse stages to five entries for focused debugging', () => {
    const forestExpanses = STAGE_DEFINITIONS.filter(
      (stage) => stage.metadata?.cluster === 'forest' && stage.name.startsWith('Forest Expanse'),
    );

    expect(forestExpanses).toHaveLength(5);
  });

  it('limits ice expanse stages to five entries for focused debugging', () => {
    const iceExpanses = STAGE_DEFINITIONS.filter(
      (stage) => stage.metadata?.cluster === 'ice' && stage.name.startsWith('Ice Expanse'),
    );

    expect(iceExpanses).toHaveLength(5);
  });

  it('connects the ice area directly to the first ice expanse', () => {
    const iceArea = findStage('ice-area');
    expect(iceArea).toBeDefined();

    const iceExpanses = STAGE_DEFINITIONS.filter(
      (stage) => stage.metadata?.cluster === 'ice' && stage.name.startsWith('Ice Expanse'),
    );
    const firstIce = iceExpanses.sort((a, b) => (a.metadata?.index ?? 0) - (b.metadata?.index ?? 0))[0];
    expect(firstIce).toBeDefined();

    expect(iceArea?.neighbors?.east).toBe(firstIce?.id);
    expect(firstIce?.neighbors?.west).toBe('ice-area');

    const eastDoor = iceArea?.doors?.find((door) => door.direction === 'east' && door.target === firstIce?.id);
    expect(eastDoor).toBeDefined();
  });

  it('routes the fire expanse through the hub-connected fire area', () => {
    const centralHub = findStage('central-hub');
    const fireArea = findStage('fire-area');
    expect(centralHub?.neighbors?.northeast).toBe('fire-area');
    expect(fireArea?.neighbors?.southwest).toBe('central-hub');

    const fireExpanses = STAGE_DEFINITIONS.filter(
      (stage) => stage.metadata?.cluster === 'fire' && stage.name.startsWith('Fire Expanse'),
    ).sort((a, b) => (a.metadata?.index ?? 0) - (b.metadata?.index ?? 0));

    const firstFire = fireExpanses[0];
    expect(firstFire).toBeDefined();

    expect(fireArea?.neighbors?.south).toBe(firstFire?.id);
    expect(firstFire?.neighbors?.south).toBe('fire-area');

    const lastIce = STAGE_DEFINITIONS.filter((stage) => stage.metadata?.cluster === 'ice')
      .sort((a, b) => (b.metadata?.index ?? 0) - (a.metadata?.index ?? 0))[0];
    expect(lastIce).toBeDefined();
    expect(lastIce?.neighbors?.north).not.toBe(firstFire?.id);
    expect(firstFire?.neighbors?.north).toBeUndefined();
  });

  it('connects the cave area directly to the first ruins expanse and detaches it from the fire expanse', () => {
    const caveArea = findStage('cave-area');
    expect(caveArea).toBeDefined();

    const ruinsExpanses = STAGE_DEFINITIONS.filter(
      (stage) => stage.metadata?.cluster === 'ruins' && stage.name.startsWith('Ruins Expanse'),
    );
    const firstRuins = ruinsExpanses.sort((a, b) => (a.metadata?.index ?? 0) - (b.metadata?.index ?? 0))[0];
    expect(firstRuins).toBeDefined();

    expect(caveArea?.neighbors?.north).toBe(firstRuins?.id);
    expect(firstRuins?.neighbors?.south).toBe('cave-area');

    const northDoor = caveArea?.doors?.find((door) => door.direction === 'north' && door.target === firstRuins?.id);
    expect(northDoor).toBeDefined();

    const fireExpanses = STAGE_DEFINITIONS.filter((stage) => stage.metadata?.cluster === 'fire');
    const lastFire = fireExpanses.sort((a, b) => (b.metadata?.index ?? 0) - (a.metadata?.index ?? 0))[0];
    expect(lastFire).toBeDefined();
    expect(lastFire?.neighbors?.south).not.toBe(firstRuins?.id);
    expect(firstRuins?.neighbors?.north).toBeUndefined();
  });

  it('terminates each expanse branch with a fixed reliquary that houses its keystone relic', () => {
    const configs = [
      { entryId: 'forest-area', cluster: 'forest', reliquaryId: 'forest-reliquary', relicId: 'forest-keystone' },
      { entryId: 'ice-area', cluster: 'ice', reliquaryId: 'ice-reliquary', relicId: 'ice-keystone' },
      { entryId: 'fire-area', cluster: 'fire', reliquaryId: 'fire-reliquary', relicId: 'fire-keystone' },
      { entryId: 'cave-area', cluster: 'ruins', reliquaryId: 'ruins-reliquary', relicId: 'cave-keystone' },
    ] as const;

    configs.forEach(({ entryId, cluster, reliquaryId, relicId }) => {
      const entryArea = findStage(entryId);
      expect(entryArea).toBeDefined();
      const entryHasRelic = (entryArea?.collectibles ?? []).some((collectible) => collectible.itemId === relicId);
      expect(entryHasRelic).toBe(false);

      const reliquary = findStage(reliquaryId);
      expect(reliquary).toBeDefined();
      expect(reliquary?.metadata?.cluster).toBe(cluster);

      const reliquaryHasRelic = (reliquary?.collectibles ?? []).some((collectible) => collectible.itemId === relicId);
      expect(reliquaryHasRelic).toBe(true);

      const clusterExpanses = STAGE_DEFINITIONS.filter(
        (stage) => stage.metadata?.cluster === cluster && stage.name.includes('Expanse '),
      ).sort((a, b) => (a.metadata?.index ?? 0) - (b.metadata?.index ?? 0));
      const finalExpanse = clusterExpanses.at(-1);
      expect(finalExpanse).toBeDefined();
      expect(finalExpanse?.neighbors?.east).toBe(reliquaryId);
      expect(reliquary?.neighbors?.west).toBe(finalExpanse?.id);
    });

    const skyExpanses = STAGE_DEFINITIONS.filter(
      (stage) => stage.metadata?.cluster === 'sky' && stage.name.includes('Expanse '),
    ).sort(
      (a, b) => (a.metadata?.index ?? 0) - (b.metadata?.index ?? 0),
    );
    const firstSky = skyExpanses[0];
    expect(firstSky).toBeDefined();
    expect(firstSky?.neighbors?.north).toBe('ruins-reliquary');
  });
});
