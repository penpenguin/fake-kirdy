import type { AreaDefinition, AreaTransitionDirection, AreaId } from '../AreaManager';
import { buildStageDefinition } from './stage-utils';

interface ClusterBlueprint {
  cluster: 'hub' | 'forest' | 'ice' | 'fire' | 'ruins' | 'sky' | 'void';
  count: number;
  difficulty: number;
  doorBuffer: number;
}

interface GeneratedNode {
  id: AreaId;
  cluster: ClusterBlueprint['cluster'];
  difficulty: number;
  doorBuffer: number;
  metadataIndex: number;
  neighbors: Partial<Record<AreaTransitionDirection, AreaId>>;
  seed: number;
}

const CLUSTERS: ClusterBlueprint[] = [
  { cluster: 'forest', count: 5, difficulty: 2, doorBuffer: 1 },
  { cluster: 'ice', count: 5, difficulty: 3, doorBuffer: 2 },
  { cluster: 'fire', count: 22, difficulty: 3, doorBuffer: 1 },
  { cluster: 'ruins', count: 18, difficulty: 2, doorBuffer: 1 },
  { cluster: 'sky', count: 18, difficulty: 4, doorBuffer: 2 },
  { cluster: 'void', count: 64, difficulty: 1, doorBuffer: 1 },
];

const TILE_SIZE = 32;
const LAYOUT_WIDTH = 18;
const LAYOUT_HEIGHT = 12;
const FOREST_AREA_ID = 'forest-area' as AreaId;
const ICE_AREA_ID = 'ice-area' as AreaId;
const CAVE_AREA_ID = 'cave-area' as AreaId;
const FIRE_AREA_ID = 'fire-area' as AreaId;

let iceClusterEntryId: AreaId | undefined;
let fireClusterEntryId: AreaId | undefined;
let ruinsClusterEntryId: AreaId | undefined;

export const PROCEDURAL_STAGE_DEFINITIONS: AreaDefinition[] = generateProceduralStages();

export function getIceExpanseEntryId(): AreaId {
  if (!iceClusterEntryId) {
    throw new Error('Ice expanse entry id is not initialized');
  }
  return iceClusterEntryId;
}

export function getFireExpanseEntryId(): AreaId {
  if (!fireClusterEntryId) {
    throw new Error('Fire expanse entry id is not initialized');
  }
  return fireClusterEntryId;
}

export function getRuinsExpanseEntryId(): AreaId {
  if (!ruinsClusterEntryId) {
    throw new Error('Ruins expanse entry id is not initialized');
  }
  return ruinsClusterEntryId;
}

function generateProceduralStages(): AreaDefinition[] {
  const nodes: GeneratedNode[] = [];
  let areaIndex = 0;
  let metadataIndex = 10;
  let previousClusterLast: GeneratedNode | undefined;
  let forestEntryNode: GeneratedNode | undefined;
  let iceEntryNode: GeneratedNode | undefined;
  let fireEntryNode: GeneratedNode | undefined;
  let ruinsEntryNode: GeneratedNode | undefined;

  CLUSTERS.forEach((blueprint) => {
    const clusterNodes: GeneratedNode[] = [];

    for (let i = 0; i < blueprint.count; i += 1) {
      areaIndex += 1;
      const node: GeneratedNode = {
        id: buildAreaId(areaIndex),
        cluster: blueprint.cluster,
        difficulty: blueprint.difficulty,
        doorBuffer: blueprint.doorBuffer,
        metadataIndex,
        neighbors: {},
        seed: (areaIndex + i) % 7,
      };

      metadataIndex += 1;
      nodes.push(node);
      clusterNodes.push(node);
    }

    clusterNodes.forEach((node, index) => {
      const previous = clusterNodes[index - 1];
      if (previous) {
        node.neighbors.west = previous.id;
        previous.neighbors.east = node.id;
      }
    });

    if (previousClusterLast && clusterNodes.length > 0) {
      if (blueprint.cluster !== 'ice' && blueprint.cluster !== 'fire' && blueprint.cluster !== 'ruins') {
        const first = clusterNodes[0];
        first.neighbors.north = previousClusterLast.id;
        previousClusterLast.neighbors.south = first.id;
      }
    }

    previousClusterLast = clusterNodes.at(-1);

    if (blueprint.cluster === 'forest' && !forestEntryNode) {
      forestEntryNode = clusterNodes[0];
    }

    if (blueprint.cluster === 'ice' && !iceEntryNode) {
      iceEntryNode = clusterNodes[0];
    }

    if (blueprint.cluster === 'fire' && !fireEntryNode) {
      fireEntryNode = clusterNodes[0];
    }

    if (blueprint.cluster === 'ruins' && !ruinsEntryNode) {
      ruinsEntryNode = clusterNodes[0];
    }
  });

  if (forestEntryNode) {
    forestEntryNode.neighbors.west = FOREST_AREA_ID;
  }

  if (iceEntryNode) {
    iceEntryNode.neighbors.west = ICE_AREA_ID;
    iceClusterEntryId = iceEntryNode.id;
  }

  if (fireEntryNode) {
    fireEntryNode.neighbors.south = FIRE_AREA_ID;
    fireClusterEntryId = fireEntryNode.id;
  }

  if (ruinsEntryNode) {
    ruinsEntryNode.neighbors.south = CAVE_AREA_ID;
    ruinsClusterEntryId = ruinsEntryNode.id;
  }

  return nodes.map((node, index) => {
    const { layout, deadEndOverrides } = createProceduralLayout(node.neighbors, node.seed);

    return buildStageDefinition({
      id: node.id,
      name: `${capitalize(node.cluster)} Expanse ${index + 1}`,
      tileSize: TILE_SIZE,
      layout,
      neighbors: { ...node.neighbors },
      entryPoints: createEntryPoints(),
      metadata: {
        cluster: node.cluster,
        index: node.metadataIndex,
        difficulty: node.difficulty,
      },
      doorBuffer: node.doorBuffer,
      goal: null,
      enemySpawns: {
        baseline: 3,
        maxActive: 4,
        entries: [
          { type: 'wabble-bee', limit: 2 },
          { type: 'dronto-durt', limit: 1 },
        ],
      },
      deadEndOverrides,
    });
  });
}

function buildAreaId(index: number) {
  return `labyrinth-${String(index).padStart(3, '0')}` as AreaId;
}

function createProceduralLayout(
  neighbors: Partial<Record<AreaTransitionDirection, string>>,
  seed: number,
) {
  const grid: string[][] = Array.from({ length: LAYOUT_HEIGHT }, (_, row) => {
    if (row === 0 || row === LAYOUT_HEIGHT - 1) {
      return '#'.repeat(LAYOUT_WIDTH).split('');
    }

    const rowChars = Array.from({ length: LAYOUT_WIDTH }, (_, column) => {
      if (column === 0 || column === LAYOUT_WIDTH - 1) {
        return '#';
      }
      return '.';
    });

    return rowChars;
  });

  for (let row = 2; row < LAYOUT_HEIGHT - 2; row += 2) {
    for (let column = 2 + ((row + seed) % 3); column < LAYOUT_WIDTH - 2; column += 4) {
      grid[row][column] = '#';
    }
  }

  const deadEndOverrides = [
    { column: 2, row: LAYOUT_HEIGHT - 3, reward: 'health' as const },
    { column: LAYOUT_WIDTH - 3, row: 2, reward: 'max-health' as const },
    { column: Math.floor(LAYOUT_WIDTH / 2), row: Math.floor(LAYOUT_HEIGHT / 2) + 2, reward: 'revive' as const },
  ];

  deadEndOverrides.forEach(({ column, row }) => {
    if (grid[row]?.[column]) {
      grid[row][column] = '.';
    }
  });

  if (neighbors.north) {
    grid[1][Math.floor(LAYOUT_WIDTH / 2)] = 'D';
  }
  if (neighbors.south) {
    grid[LAYOUT_HEIGHT - 2][Math.floor(LAYOUT_WIDTH / 2)] = 'D';
  }
  if (neighbors.west) {
    grid[Math.floor(LAYOUT_HEIGHT / 2)][1] = 'D';
  }
  if (neighbors.east) {
    grid[Math.floor(LAYOUT_HEIGHT / 2)][LAYOUT_WIDTH - 2] = 'D';
  }

  const layout = grid.map((row) => row.join(''));
  return { layout, deadEndOverrides };
}

function createEntryPoints() {
  const width = LAYOUT_WIDTH * TILE_SIZE;
  const height = LAYOUT_HEIGHT * TILE_SIZE;
  return {
    default: { position: { x: width / 2, y: height / 2 } },
    north: { position: { x: width / 2, y: TILE_SIZE * 2 } },
    south: { position: { x: width / 2, y: height - TILE_SIZE * 2 } },
    east: { position: { x: width - TILE_SIZE * 2, y: height / 2 } },
    west: { position: { x: TILE_SIZE * 2, y: height / 2 } },
  } satisfies AreaDefinition['entryPoints'];
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
