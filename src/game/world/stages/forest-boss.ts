import type { AreaDefinition } from '../AreaManager';
import { buildStageDefinition } from './stage-utils';
import { FOREST_BOSS_ID, FOREST_RELIQUARY_ID, getForestExpanseExitId } from './procedural';

const tileSize = 32;

const layout = [
  '########################',
  'D......................#',
  '#..........##..........#',
  '#......................#',
  '#..........##..........#',
  '#.....................D#',
  '########################',
];

const width = layout[0].length * tileSize;
const height = layout.length * tileSize;

export const forestBoss: AreaDefinition = buildStageDefinition({
  id: FOREST_BOSS_ID,
  name: 'Forest Boss Chamber',
  tileSize,
  layout,
  neighbors: {
    west: getForestExpanseExitId(),
    east: FOREST_RELIQUARY_ID,
  },
  entryPoints: {
    default: { position: { x: tileSize * 2, y: height / 2 } },
    west: { position: { x: tileSize * 2, y: height / 2 }, facing: 'west' },
    east: { position: { x: width - tileSize * 2, y: height / 2 }, facing: 'east' },
  },
  enemySpawns: {
    baseline: 1,
    maxActive: 1,
    entries: [{ type: 'dronto-durt', limit: 1 }],
  },
  metadata: {
    cluster: 'forest',
    index: 204,
    difficulty: 3,
  },
  doorBuffer: 2,
  goal: null,
});
