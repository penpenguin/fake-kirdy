import type { AreaDefinition } from '../AreaManager';

const tileSize = 32;

const layout = [
  '####################',
  '#..................#',
  '#D................D#',
  '#..................#',
  '####################',
];

const width = layout[0].length * tileSize;
const height = layout.length * tileSize;

export const mirrorCorridor: AreaDefinition = {
  id: 'mirror-corridor',
  name: 'Mirror Corridor',
  tileSize,
  layout,
  neighbors: {
    west: 'central-hub',
    east: 'fire-area',
  },
  entryPoints: {
    default: { position: { x: width / 2, y: height / 2 } },
    west: { position: { x: tileSize * 2, y: height / 2 } },
    east: { position: { x: width - tileSize * 3, y: height / 2 } },
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
};
