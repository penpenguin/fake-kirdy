import type { AreaDefinition } from '../AreaManager';
import { buildStageDefinition } from './stage-utils';

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
const eastDoorColumnIndex =
  eastDoorRowIndex >= 0 ? layout[eastDoorRowIndex].lastIndexOf('D') : columns - 2;
const eastEntryColumnIndex =
  eastDoorRowIndex >= 0 && eastDoorColumnIndex >= 0
    ? (() => {
        const row = layout[eastDoorRowIndex];
        for (let column = eastDoorColumnIndex - 1; column >= 0; column -= 1) {
          if (row[column] === '.') {
            return column;
          }
        }

        return Math.max(1, eastDoorColumnIndex - 1);
      })()
    : columns - 3;
const eastEntryX = (eastEntryColumnIndex + 0.5) * tileSize;

export const starlitKeep: AreaDefinition = buildStageDefinition({
  id: 'starlit-keep',
  name: 'Starlit Keep',
  tileSize,
  layout,
  neighbors: {
    east: 'sky-sanctum',
  },
  entryPoints: {
    default: { position: { x: eastEntryX, y: eastEntryY } },
    east: { position: { x: eastEntryX, y: eastEntryY }, facing: 'east' },
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
  metadata: {
    cluster: 'sky',
    index: 9,
    difficulty: 3,
  },
  doorBuffer: 2,
  goal: null,
});
