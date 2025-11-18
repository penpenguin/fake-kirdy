import type { AreaDefinition } from '../AreaManager';
import { buildStageDefinition } from './stage-utils';

const tileSize = 32;

const layout = [
  '####################',
  '#.........D........#',
  '#..................#',
  '#.........D........#',
  '####################',
];

const width = layout[0].length * tileSize;
const height = layout.length * tileSize;

export const mirrorCorridor: AreaDefinition = buildStageDefinition({
  id: 'mirror-corridor',
  name: 'Mirror Corridor',
  tileSize,
  layout,
  neighbors: {
    south: 'central-hub',
    north: 'goal-sanctum',
  },
  entryPoints: {
    default: { position: { x: width / 2, y: height / 2 } },
    north: { position: { x: width / 2, y: tileSize } },
    south: { position: { x: width / 2, y: height - tileSize } },
  },
  enemySpawns: {
    baseline: 2,
    maxActive: 2,
    entries: [
      { type: 'wabble-bee', limit: 1 },
      { type: 'dronto-durt', limit: 1 },
    ],
  },
  metadata: {
    cluster: 'ruins',
    index: 1,
    difficulty: 1,
  },
  doorBuffer: 1,
  goal: null,
});
