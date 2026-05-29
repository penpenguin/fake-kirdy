import type { AreaDefinition } from '../AreaManager';
import { buildStageDefinition } from './stage-utils';
import { getIceExpanseEntryId } from './procedural';

const tileSize = 32;

const layout = [
  '####################',
  '#....##......##....#',
  '#....##......##....#',
  '#.................D#',
  '#..####......####..#',
  '#.................D#',
  '####################',
];

const width = layout[0].length * tileSize;
const height = layout.length * tileSize;

export const iceArea: AreaDefinition = buildStageDefinition({
  id: 'ice-area',
  name: 'Ice Area',
  tileSize,
  layout,
  neighbors: {
    southeast: 'central-hub',
    east: getIceExpanseEntryId(),
  },
  entryPoints: {
    default: { position: { x: width / 2, y: height - tileSize * 3 } },
    southeast: { position: { x: width - tileSize * 2, y: height - tileSize * 2 } },
    north: { position: { x: width / 2, y: tileSize * 2 } },
    east: { position: { x: width - tileSize * 2, y: height / 2 } },
  },
  enemySpawns: {
    baseline: 3,
    maxActive: 3,
    entries: [
      { type: 'frost-wabble', limit: 2 },
      { type: 'glacio-durt', limit: 1 },
    ],
  },
  metadata: {
    cluster: 'ice',
    index: 2,
    difficulty: 2,
  },
  doorBuffer: 1,
  goal: null,
});
