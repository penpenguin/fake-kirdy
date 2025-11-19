import type { AreaDefinition } from '../AreaManager';
import { buildStageDefinition } from './stage-utils';
import { FOREST_RELIQUARY_ID, getForestExpanseExitId } from './procedural';

const tileSize = 32;

const layout = [
  '########################',
  'D....##....##....##....#',
  '#....##....##....##....#',
  '#..##..............##..#',
  '#....##....##....##....#',
  '#....######..######....#',
  '########################',
];

const width = layout[0].length * tileSize;
const height = layout.length * tileSize;

export const forestReliquary: AreaDefinition = buildStageDefinition({
  id: FOREST_RELIQUARY_ID,
  name: 'Forest Reliquary',
  tileSize,
  layout,
  neighbors: {
    west: getForestExpanseExitId(),
  },
  entryPoints: {
    default: { position: { x: width - tileSize * 3, y: height / 2 } },
    west: { position: { x: tileSize * 2, y: height / 2 } },
  },
  enemySpawns: {
    baseline: 2,
    maxActive: 3,
    entries: [
      { type: 'wabble-bee', limit: 1 },
      { type: 'dronto-durt', limit: 1 },
    ],
  },
  metadata: {
    cluster: 'forest',
    index: 205,
    difficulty: 3,
  },
  doorBuffer: 1,
  goal: null,
  collectibles: [
    { id: 'forest-keystone', itemId: 'forest-keystone', column: 18, row: 3 },
  ],
});
