import type { AreaDefinition } from '../AreaManager';

const tileSize = 32;

const layout = [
  '########################',
  '#D....###.....###.....##',
  '######.###.###.###.#####',
  '#.....###.....###.....##',
  '###.###########.########',
  '#.....###.....###.....##',
  '########################',
];

const columns = layout[0].length;
const width = columns * tileSize;
const height = layout.length * tileSize;

const westDoorRowIndex = layout.findIndex((row) => row.indexOf('D') === 1);
const westEntryY = (westDoorRowIndex >= 0 ? westDoorRowIndex + 0.5 : layout.length / 2) * tileSize;

export const auroraSpire: AreaDefinition = {
  id: 'aurora-spire',
  name: 'Aurora Spire',
  tileSize,
  layout,
  neighbors: {
    west: 'sky-sanctum',
  },
  entryPoints: {
    default: { position: { x: tileSize * 2, y: westEntryY } },
    west: { position: { x: tileSize * 2, y: westEntryY }, facing: 'west' },
    east: { position: { x: width - tileSize * 3, y: height - tileSize * 3 } },
    north: { position: { x: width / 2, y: tileSize * 2 } },
    south: { position: { x: width / 2, y: height - tileSize * 2 } },
  },
  enemySpawns: {
    baseline: 3,
    maxActive: 4,
    entries: [
      { type: 'wabble-bee', limit: 2 },
      { type: 'dronto-durt', limit: 2 },
    ],
  },
};
