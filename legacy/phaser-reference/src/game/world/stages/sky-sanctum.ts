import type { AreaDefinition } from '../AreaManager';
import { getSkyExpanseEntryId } from './procedural';
import { buildStageDefinition } from './stage-utils';

const tileSize = 32;

const layout = [
  '########################',
  '#....###..D...###......#',
  '#......................#',
  '#D..####....####......D#',
  '#......................#',
  '#..........D...........#',
  '########################',
];

const columns = layout[0].length;
const width = columns * tileSize;
const height = layout.length * tileSize;

const southDoorRowIndex = layout.length - 2;
const southDoorColumnIndex = layout[southDoorRowIndex]?.indexOf('D') ?? Math.floor(columns / 2);
const southDoorX = (southDoorColumnIndex + 1) * tileSize;

const westDoorRowIndex = layout.findIndex((row) => row.indexOf('D') === 1);
const eastDoorRowIndex = layout.findIndex((row) => row.lastIndexOf('D') === columns - 2);

const resolveDoorY = (rowIndex: number | undefined) => {
  const index = typeof rowIndex === 'number' && rowIndex >= 0 ? rowIndex : Math.floor(layout.length / 2);
  return (index + 0.5) * tileSize;
};

const westEntryY = resolveDoorY(westDoorRowIndex);
const eastEntryY = resolveDoorY(eastDoorRowIndex);

export const skySanctum: AreaDefinition = buildStageDefinition({
  id: 'sky-sanctum',
  name: 'Sky Sanctum',
  tileSize,
  layout,
  neighbors: {
    south: 'goal-sanctum',
    east: 'aurora-spire',
    west: 'starlit-keep',
    north: getSkyExpanseEntryId(),
  },
  entryPoints: {
    default: { position: { x: southDoorX, y: height - tileSize * 2 } },
    south: { position: { x: southDoorX, y: height - tileSize * 2 }, facing: 'south' },
    north: { position: { x: width / 2, y: tileSize * 2 }, facing: 'north' },
    east: { position: { x: width - tileSize * 3, y: eastEntryY }, facing: 'east' },
    west: { position: { x: tileSize * 2, y: westEntryY }, facing: 'west' },
  },
  enemySpawns: {
    baseline: 3,
    maxActive: 4,
    entries: [
      { type: 'frost-wabble', limit: 2 },
      { type: 'glacio-durt', limit: 2 },
    ],
  },
  metadata: {
    cluster: 'sky',
    index: 7,
    difficulty: 4,
  },
  doorBuffer: 2,
  goal: null,
});
