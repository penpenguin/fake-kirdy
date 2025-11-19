import type { AreaDefinition } from '../AreaManager';
import { buildStageDefinition } from './stage-utils';
import { getRuinsExpanseEntryId } from './procedural';

const tileSize = 32;

const layout = [
  '####################',
  '#.........D.......D#',
  '#..######..######..#',
  '#..................#',
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
    northeast: 'central-hub',
    north: getRuinsExpanseEntryId(),
  },
  entryPoints: {
    default: { position: { x: width - tileSize * 3, y: height / 2 } },
    northeast: { position: { x: width - tileSize * 2, y: tileSize * 2 } },
    north: { position: { x: width / 2, y: tileSize * 2 } },
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
