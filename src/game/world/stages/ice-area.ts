import type { AreaDefinition } from '../AreaManager';

const tileSize = 32;

const layout = [
  '####################',
  '#....##......##....#',
  '#....##......##....#',
  '#..................#',
  '#..####......####..#',
  '#.........D........#',
  '####################',
];

const width = layout[0].length * tileSize;
const height = layout.length * tileSize;

export const iceArea: AreaDefinition = {
  id: 'ice-area',
  name: 'Ice Area',
  tileSize,
  layout,
  neighbors: {
    south: 'central-hub',
  },
  entryPoints: {
    default: { position: { x: width / 2, y: height - tileSize * 3 } },
    south: { position: { x: width / 2, y: height - tileSize * 3 } },
    north: { position: { x: width / 2, y: tileSize * 2 } },
    east: { position: { x: width - tileSize * 2, y: height / 2 } },
    west: { position: { x: tileSize * 2, y: height / 2 } },
  },
  enemySpawns: {
    baseline: 3,
    maxActive: 3,
    entries: [
      { type: 'wabble-bee', limit: 2 },
      { type: 'dronto-durt', limit: 1 },
    ],
  },
};
