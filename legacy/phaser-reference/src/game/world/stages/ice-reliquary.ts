import type { AreaDefinition } from '../AreaManager';
import { buildStageDefinition } from './stage-utils';
import { ICE_RELIQUARY_ID, getIceExpanseExitId } from './procedural';

const tileSize = 32;

const layout = [
  '####################',
  'D....##......##....#',
  '#....##......##....#',
  '#..................#',
  '#..####......####..#',
  '#..................#',
  '####################',
];

const width = layout[0].length * tileSize;
const height = layout.length * tileSize;

export const iceReliquary: AreaDefinition = buildStageDefinition({
  id: ICE_RELIQUARY_ID,
  name: 'Ice Reliquary',
  tileSize,
  layout,
  neighbors: {
    west: getIceExpanseExitId(),
  },
  entryPoints: {
    default: { position: { x: width - tileSize * 3, y: height / 2 } },
    west: { position: { x: tileSize * 2, y: height / 2 } },
  },
  enemySpawns: {
    baseline: 2,
    maxActive: 3,
    entries: [
      { type: 'frost-wabble', limit: 1 },
      { type: 'glacio-durt', limit: 1 },
    ],
  },
  metadata: {
    cluster: 'ice',
    index: 210,
    difficulty: 4,
  },
  doorBuffer: 2,
  goal: null,
  collectibles: [
    { id: 'ice-keystone', itemId: 'ice-keystone', column: 14, row: 3 },
  ],
});
