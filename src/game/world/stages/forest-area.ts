import type { AreaDefinition, AreaId } from '../AreaManager';
import { buildStageDefinition } from './stage-utils';

const tileSize = 32;
const LABYRINTH_ENTRY_ID = 'labyrinth-001' as AreaId;

const layout = [
  '########################',
  '#D.....................#',
  '#..####..######..####..#',
  '#.....................D#',
  '#..####..######..####..#',
  '#......................#',
  '########################',
];

const width = layout[0].length * tileSize;
const height = layout.length * tileSize;

export const forestArea: AreaDefinition = buildStageDefinition({
  id: 'forest-area',
  name: 'Forest Area',
  tileSize,
  layout,
  neighbors: {
    northwest: 'central-hub',
    east: LABYRINTH_ENTRY_ID,
  },
  entryPoints: {
    default: { position: { x: width / 2, y: tileSize * 3 } },
    northwest: { position: { x: tileSize * 2, y: tileSize * 2 } },
    south: { position: { x: width / 2, y: height - tileSize * 2 } },
    east: { position: { x: width - tileSize * 2, y: height / 2 } },
  },
  enemySpawns: {
    baseline: 3,
    maxActive: 3,
    entries: [
      { type: 'wabble-bee', limit: 1 },
      { type: 'dronto-durt', limit: 1 },
      { type: 'vine-hopper', limit: 1 },
      { type: 'thorn-roller', limit: 1 },
      { type: 'sap-spitter', limit: 1 },
    ],
  },
  metadata: {
    cluster: 'forest',
    index: 3,
    difficulty: 1,
  },
  doorBuffer: 1,
  goal: null,
});
