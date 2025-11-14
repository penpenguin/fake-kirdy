import type { AreaDefinition } from '../AreaManager';
import { buildStageDefinition } from './stage-utils';

const tileSize = 32;

const layout = [
  '####################',
  '#..................#',
  '#..######..######..#',
  '#.................D#',
  '#..######..######..#',
  '#..................#',
  '####################',
];

const width = layout[0].length * tileSize;
const height = layout.length * tileSize;

export const caveArea: AreaDefinition = buildStageDefinition({
  id: 'cave-area',
  name: 'Cave Area',
  tileSize,
  layout,
  neighbors: {
    east: 'central-hub',
  },
  entryPoints: {
    default: { position: { x: width - tileSize * 3, y: height / 2 } },
    east: { position: { x: width - tileSize * 3, y: height / 2 } },
    west: { position: { x: tileSize * 2, y: height / 2 } },
    north: { position: { x: width / 2, y: tileSize * 2 } },
    south: { position: { x: width / 2, y: height - tileSize * 2 } },
  },
  enemySpawns: {
    baseline: 3,
    maxActive: 3,
    entries: [
      { type: 'wabble-bee', limit: 1 },
      { type: 'dronto-durt', limit: 2 },
    ],
  },
  metadata: {
    cluster: 'ruins',
    index: 4,
    difficulty: 2,
  },
  doorBuffer: 1,
  goal: null,
});
