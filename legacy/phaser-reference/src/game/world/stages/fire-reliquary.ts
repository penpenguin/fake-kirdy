import type { AreaDefinition } from '../AreaManager';
import { buildStageDefinition } from './stage-utils';
import { FIRE_RELIQUARY_ID, getFireExpanseExitId } from './procedural';

const tileSize = 32;

const layout = [
  '########################',
  'D......................#',
  '#..####..######..####..#',
  '#......................#',
  '#..####..######..####..#',
  '#......##########......#',
  '########################',
];

const width = layout[0].length * tileSize;
const height = layout.length * tileSize;

export const fireReliquary: AreaDefinition = buildStageDefinition({
  id: FIRE_RELIQUARY_ID,
  name: 'Fire Reliquary',
  tileSize,
  layout,
  neighbors: {
    west: getFireExpanseExitId(),
  },
  entryPoints: {
    default: { position: { x: width - tileSize * 4, y: height / 2 } },
    west: { position: { x: tileSize * 2, y: height / 2 } },
  },
  enemySpawns: {
    baseline: 3,
    maxActive: 4,
    entries: [
      { type: 'wabble-bee', limit: 1 },
      { type: 'dronto-durt', limit: 1 },
      { type: 'glacio-durt', limit: 1 },
    ],
  },
  metadata: {
    cluster: 'fire',
    index: 240,
    difficulty: 4,
  },
  doorBuffer: 1,
  goal: null,
  collectibles: [
    { id: 'fire-keystone', itemId: 'fire-keystone', column: 16, row: 3 },
  ],
});
