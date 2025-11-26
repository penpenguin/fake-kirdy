import type { AreaDefinition } from '../AreaManager';
import { buildStageDefinition } from './stage-utils';
import { ICE_BOSS_ID, ICE_RELIQUARY_ID, getIceExpanseExitId } from './procedural';

const tileSize = 32;

const layout = [
  '####################',
  'D..................#',
  '#......######......#',
  '#..................#',
  '#......######......#',
  '#.................D#',
  '####################',
];

const width = layout[0].length * tileSize;
const height = layout.length * tileSize;

export const iceBoss: AreaDefinition = buildStageDefinition({
  id: ICE_BOSS_ID,
  name: 'Ice Boss Chamber',
  tileSize,
  layout,
  neighbors: {
    west: getIceExpanseExitId(),
    east: ICE_RELIQUARY_ID,
  },
  entryPoints: {
    default: { position: { x: tileSize * 2, y: height / 2 } },
    west: { position: { x: tileSize * 2, y: height / 2 }, facing: 'west' },
    east: { position: { x: width - tileSize * 2, y: height / 2 }, facing: 'east' },
  },
  enemySpawns: {
    baseline: 1,
    maxActive: 1,
    entries: [{ type: 'glacio-durt', limit: 1 }],
  },
  metadata: {
    cluster: 'ice',
    index: 209,
    difficulty: 4,
  },
  doorBuffer: 2,
  goal: null,
});
