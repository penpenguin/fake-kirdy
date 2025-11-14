import type { AreaDefinition } from '../AreaManager';
import { buildStageDefinition } from './stage-utils';

const tileSize = 32;

const layout = [
  '####################',
  '#.........D........#',
  '#..................#',
  '#....####..####....#',
  '#..................#',
  '#D................D#',
  '#....####..####....#',
  '#..................#',
  '#......D...........#',
  '####################',
];

const width = layout[0].length * tileSize;
const height = layout.length * tileSize;

export const centralHub: AreaDefinition = buildStageDefinition({
  id: 'central-hub',
  name: 'Central Hub',
  tileSize,
  layout,
  neighbors: {
    north: 'ice-area',
    east: 'mirror-corridor',
    south: 'forest-area',
    west: 'cave-area',
  },
  entryPoints: {
    default: { position: { x: width / 2, y: height / 2 } },
    east: { position: { x: width - tileSize * 3, y: height / 2 } },
    west: { position: { x: tileSize * 2, y: height / 2 } },
    north: { position: { x: width / 2, y: tileSize * 2 } },
    south: { position: { x: width / 2, y: height - tileSize * 3 } },
  },
  enemySpawns: {
    baseline: 3,
    maxActive: 3,
    entries: [
      { type: 'wabble-bee', limit: 2 },
      { type: 'dronto-durt', limit: 1 },
    ],
  },
  metadata: {
    cluster: 'hub',
    index: 0,
    difficulty: 1,
  },
  doorBuffer: 2,
  goal: null,
  deadEndOverrides: [
    { column: 3, row: 2, reward: 'health' },
    { column: 15, row: 7, reward: 'max-health' },
  ],
});
