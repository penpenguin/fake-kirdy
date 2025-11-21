import type { AreaDefinition } from '../AreaManager';
import { buildStageDefinition } from './stage-utils';
import { getFireExpanseEntryId } from './procedural';

const tileSize = 32;

const layout = [
  '########################',
  '#......................#',
  '#..####..######..####..#',
  '#......................#',
  '#..####..######..####..#',
  '#D........D............#',
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
    southwest: 'central-hub',
    south: getFireExpanseEntryId(),
  },
  entryPoints: {
    default: { position: { x: tileSize * 2, y: height / 2 } },
    southwest: { position: { x: tileSize * 2, y: height - tileSize * 2 } },
    south: { position: { x: width / 2, y: height - tileSize * 2 } },
  },
  enemySpawns: {
    baseline: 3,
    maxActive: 3,
    entries: [
      { type: 'ember-imp', limit: 1 },
      { type: 'magma-crab', limit: 1 },
      { type: 'blaze-strider', limit: 1 },
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
