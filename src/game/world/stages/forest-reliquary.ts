import type { AreaDefinition } from '../AreaManager';
import { buildStageDefinition } from './stage-utils';
import { FOREST_RELIQUARY_ID, getForestBossId } from './procedural';

const tileSize = 32;

const layout = [
  '########################',
  'D....##....##....##....D',
  '#....##....##....##....#',
  '#......................#',
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
    west: getForestBossId(),
    east: 'central-hub',
  },
  entryPoints: {
    default: { position: { x: width - tileSize * 3, y: height / 2 } },
    west: { position: { x: tileSize * 2, y: height / 2 } },
    east: { position: { x: width - tileSize * 3, y: height / 2 }, facing: 'west' },
  },
  enemySpawns: {
    baseline: 0,
    maxActive: 0,
    entries: [],
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
