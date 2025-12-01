import type { AreaDefinition } from '../AreaManager';
import { buildStageDefinition } from './stage-utils';
import { FIRE_RELIQUARY_ID, getFireBossId } from './procedural';

const tileSize = 32;

const layout = [
  '########################',
  'D......................D',
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
    west: getFireBossId(),
    east: 'central-hub',
  },
  entryPoints: {
    default: { position: { x: width - tileSize * 4, y: height / 2 } },
    west: { position: { x: tileSize * 2, y: height / 2 } },
    east: { position: { x: width - tileSize * 4, y: height / 2 }, facing: 'west' },
  },
  enemySpawns: {
    baseline: 0,
    maxActive: 0,
    entries: [],
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
