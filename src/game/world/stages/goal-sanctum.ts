import type { AreaDefinition } from '../AreaManager';
import { buildStageDefinition } from './stage-utils';

const tileSize = 32;

const layout = [
  '####################',
  '#.........D........#',
  '#D.................#',
  '#......####........#',
  '#..................#',
  '#.........D........#',
  '####################',
];

const width = layout[0].length * tileSize;
const height = layout.length * tileSize;
const southernDoorRowIndex = layout.length - 2;
const southernDoorColumnIndex = layout[southernDoorRowIndex]?.indexOf('D') ?? -1;
const southDoorX = southernDoorColumnIndex >= 0 ? (southernDoorColumnIndex + 1) * tileSize : width / 2;

export const goalSanctum: AreaDefinition = buildStageDefinition({
  id: 'goal-sanctum',
  name: 'Goal Sanctum',
  tileSize,
  layout,
  neighbors: {
    south: 'mirror-corridor',
    north: 'sky-sanctum',
    west: 'central-hub',
  },
  entryPoints: {
    default: { position: { x: southDoorX, y: height - tileSize * 2 } },
    south: { position: { x: southDoorX, y: height - tileSize * 2 }, facing: 'south' },
    north: { position: { x: width / 2, y: tileSize * 2 }, facing: 'north' },
    west: { position: { x: tileSize * 5, y: height / 2 }, facing: 'east' },
  },
  enemySpawns: {
    baseline: 0,
    maxActive: 0,
    entries: [],
  },
  metadata: {
    cluster: 'ruins',
    index: 6,
    difficulty: 4,
  },
  doorBuffer: 2,
  goal: {
    doorId: 'south-0',
    direction: 'south',
    texture: 'goal-door',
    resultOverlayKey: 'goal-results',
    scoreBonus: 5000,
  },
});
