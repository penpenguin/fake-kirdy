import type { AreaDefinition } from '../AreaManager';
import { buildStageDefinition } from './stage-utils';
import { RUINS_BOSS_ID, RUINS_RELIQUARY_ID, getRuinsExpanseExitId } from './procedural';

const tileSize = 32;

const layout = [
  '####################',
  'D..................#',
  '#..######....#######',
  '#..................#',
  '#..######....#######',
  '#.................D#',
  '####################',
];

const width = layout[0].length * tileSize;
const height = layout.length * tileSize;

export const ruinsBoss: AreaDefinition = buildStageDefinition({
  id: RUINS_BOSS_ID,
  name: 'Ruins Boss Chamber',
  tileSize,
  layout,
  neighbors: {
    west: getRuinsExpanseExitId(),
    east: RUINS_RELIQUARY_ID,
  },
  entryPoints: {
    default: { position: { x: tileSize * 2, y: height / 2 } },
    west: { position: { x: tileSize * 2, y: height / 2 }, facing: 'west' },
    east: { position: { x: width - tileSize * 2, y: height / 2 }, facing: 'east' },
  },
  enemySpawns: {
    baseline: 1,
    maxActive: 1,
    entries: [{ type: 'stone-sentinel', limit: 1 }],
  },
  metadata: {
    cluster: 'ruins',
    index: 259,
    difficulty: 3,
  },
  doorBuffer: 2,
  goal: null,
});
