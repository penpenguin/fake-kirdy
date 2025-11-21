import type { AreaDefinition } from '../AreaManager';
import { buildStageDefinition } from './stage-utils';
import { RUINS_RELIQUARY_ID, getRuinsBossId } from './procedural';

const tileSize = 32;

const layout = [
  '####################',
  'D....##......##....#',
  '#..####......####..#',
  '#..................#',
  '#..######..######..#',
  '#..................#',
  '####################',
];

const width = layout[0].length * tileSize;
const height = layout.length * tileSize;

export const ruinsReliquary: AreaDefinition = buildStageDefinition({
  id: RUINS_RELIQUARY_ID,
  name: 'Ruins Reliquary',
  tileSize,
  layout,
  neighbors: {
    west: getRuinsBossId(),
  },
  entryPoints: {
    default: { position: { x: width - tileSize * 4, y: height / 2 } },
    west: { position: { x: tileSize * 2, y: height / 2 } },
  },
  enemySpawns: {
    baseline: 3,
    maxActive: 4,
    entries: [
      { type: 'dronto-durt', limit: 1 },
      { type: 'stone-sentinel', limit: 1 },
      { type: 'curse-bat', limit: 1 },
      { type: 'relic-thief', limit: 1 },
    ],
  },
  metadata: {
    cluster: 'ruins',
    index: 260,
    difficulty: 3,
  },
  doorBuffer: 1,
  goal: null,
  collectibles: [
    { id: 'cave-keystone', itemId: 'cave-keystone', column: 10, row: 3 },
  ],
});
