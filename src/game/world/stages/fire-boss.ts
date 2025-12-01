import type { AreaDefinition } from '../AreaManager';
import { buildStageDefinition } from './stage-utils';
import { FIRE_BOSS_ID, FIRE_RELIQUARY_ID, getFireExpanseExitId } from './procedural';

const tileSize = 32;

const layout = [
  '########################',
  'D......................#',
  '#..######......######..#',
  '#......................#',
  '#..######......######..#',
  '#.....................D#',
  '########################',
];

const width = layout[0].length * tileSize;
const height = layout.length * tileSize;

export const fireBoss: AreaDefinition = buildStageDefinition({
  id: FIRE_BOSS_ID,
  name: 'Fire Boss Chamber',
  tileSize,
  layout,
  neighbors: {
    west: getFireExpanseExitId(),
    east: FIRE_RELIQUARY_ID,
  },
  entryPoints: {
    default: { position: { x: tileSize * 2, y: height / 2 } },
    west: { position: { x: tileSize * 2, y: height / 2 }, facing: 'west' },
    east: { position: { x: width - tileSize * 2, y: height / 2 }, facing: 'east' },
  },
  enemySpawns: {
    baseline: 1,
    maxActive: 1,
    entries: [{ type: 'blaze-strider', limit: 1 }],
  },
  metadata: {
    cluster: 'fire',
    index: 239,
    difficulty: 4,
  },
  doorBuffer: 2,
  goal: null,
});
