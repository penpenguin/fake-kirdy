import type { AreaDefinition } from '../AreaManager';

const tileSize = 32;

const layout = [
  '####################',
  '#.............D....#',
  '#..................#',
  '#......####........#',
  '#..................#',
  '#....D.............#',
  '####################',
];

const width = layout[0].length * tileSize;
const height = layout.length * tileSize;
const southernDoorRowIndex = layout.length - 2;
const southernDoorColumnIndex = layout[southernDoorRowIndex]?.indexOf('D') ?? -1;
const southDoorX = southernDoorColumnIndex >= 0 ? (southernDoorColumnIndex + 1) * tileSize : width / 2;

export const goalSanctum: AreaDefinition = {
  id: 'goal-sanctum',
  name: 'Goal Sanctum',
  tileSize,
  layout,
  neighbors: {
    south: 'fire-area',
  },
  entryPoints: {
    default: { position: { x: southDoorX, y: height - tileSize * 2 } },
    south: { position: { x: southDoorX, y: height - tileSize * 2 }, facing: 'south' },
    north: { position: { x: width / 2, y: tileSize * 2 } },
    east: { position: { x: width - tileSize * 3, y: height / 2 } },
    west: { position: { x: tileSize * 2, y: height / 2 } },
  },
  enemySpawns: {
    baseline: 1,
    maxActive: 2,
    entries: [
      { type: 'glacio-durt', limit: 1 },
      { type: 'frost-wabble', limit: 1 },
    ],
  },
};
