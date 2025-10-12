import type { AreaDefinition } from '../AreaManager';

const tileSize = 32;

const layout = [
  '########################',
  '#....###....###....###D#',
  '#..#####..#####..#####.#',
  '#......................#',
  '#..#####..#####..#####.#',
  '#....###....###....###.#',
  '########################',
];

const columns = layout[0].length;
const width = columns * tileSize;
const height = layout.length * tileSize;

const eastDoorRowIndex = layout.findIndex((row) => row.lastIndexOf('D') === columns - 2);
const eastEntryY = (eastDoorRowIndex >= 0 ? eastDoorRowIndex + 0.5 : layout.length / 2) * tileSize;

export const starlitKeep: AreaDefinition = {
  id: 'starlit-keep',
  name: 'Starlit Keep',
  tileSize,
  layout,
  neighbors: {
    east: 'sky-sanctum',
  },
  entryPoints: {
    default: { position: { x: width - tileSize * 3, y: eastEntryY } },
    east: { position: { x: width - tileSize * 3, y: eastEntryY }, facing: 'east' },
    west: { position: { x: tileSize * 2, y: height / 2 } },
    north: { position: { x: width / 2, y: tileSize * 2 } },
    south: { position: { x: width / 2, y: height - tileSize * 2 } },
  },
  enemySpawns: {
    baseline: 3,
    maxActive: 4,
    entries: [
      { type: 'glacio-durt', limit: 2 },
      { type: 'wabble-bee', limit: 2 },
    ],
  },
};
