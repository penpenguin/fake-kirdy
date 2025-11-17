import type { AreaDefinition } from '../AreaManager';
import { buildStageDefinition } from './stage-utils';
import { getFireExpanseEntryId } from './procedural';

const tileSize = 32;

const layout = [
  '########################',
  '#..........D...........#',
  '#..####..######..####..#',
  '#D....................D#',
  '#..####..######..####..#',
  '#.........D............#',
  '########################',
];

const width = layout[0].length * tileSize;
const height = layout.length * tileSize;

export const fireArea: AreaDefinition = buildStageDefinition({
  id: 'fire-area',
  name: 'Fire Area',
  tileSize,
  layout,
  neighbors: {
    west: 'central-hub',
    east: 'mirror-corridor',
    north: 'goal-sanctum',
    south: getFireExpanseEntryId(),
  },
  entryPoints: {
    default: { position: { x: tileSize * 2, y: height / 2 } },
    west: { position: { x: tileSize * 2, y: height / 2 } },
    east: { position: { x: width - tileSize * 3, y: height / 2 } },
    north: { position: { x: width / 2, y: tileSize }, facing: 'north' },
    south: { position: { x: width / 2, y: height - tileSize * 2 } },
  },
  enemySpawns: {
    baseline: 3,
    maxActive: 3,
    entries: [
      { type: 'wabble-bee', limit: 1 },
      { type: 'dronto-durt', limit: 1 },
      { type: 'glacio-durt', limit: 1 },
    ],
  },
  metadata: {
    cluster: 'fire',
    index: 5,
    difficulty: 3,
  },
  doorBuffer: 1,
  goal: null,
});
