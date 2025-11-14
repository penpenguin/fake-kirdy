import type {
  AreaDefinition,
  AreaDoorDefinition,
  AreaDefinitionMetadata,
  AreaGoalMetadata,
  AreaTransitionDirection,
  DeadEndDefinition,
  HealRewardType,
  Vector2,
} from '../AreaManager';

export interface StageDefinitionConfig extends Omit<AreaDefinition, 'doors' | 'deadEnds' | 'goal' | 'doorBuffer' | 'metadata'> {
  metadata: AreaDefinitionMetadata;
  doorBuffer?: number;
  goal?: (AreaGoalMetadata & { direction?: AreaTransitionDirection }) | null;
  deadEndOverrides?: DeadEndOverride[];
}

const DEFAULT_DOOR_BUFFER = 1;
const DIRECTIONS: AreaTransitionDirection[] = ['north', 'south', 'east', 'west'];
const DEAD_END_REWARDS: HealRewardType[] = ['health', 'max-health', 'revive'];

type TileCoordinate = { column: number; row: number };
type DeadEndOverride = TileCoordinate & { reward?: HealRewardType };

export function buildStageDefinition(config: StageDefinitionConfig): AreaDefinition {
  const doorBuffer = Math.max(1, config.doorBuffer ?? DEFAULT_DOOR_BUFFER);
  const doors = deriveDoors(config.layout, config.tileSize, config.neighbors, doorBuffer);
  const deadEnds = deriveDeadEnds(config.layout, config.tileSize, config.deadEndOverrides);
  const resolvedGoal = resolveGoalMetadata(config.goal ?? null, doors);
  const entryPoints = enforceEntryPointDoorSpacing(
    cloneEntryPoints(config.entryPoints),
    doors,
    config.neighbors,
    config.tileSize,
    {
      width: (config.layout[0]?.length ?? 0) * config.tileSize,
      height: config.layout.length * config.tileSize,
    },
    doorBuffer,
  );

  return {
    ...config,
    entryPoints,
    metadata: config.metadata,
    doorBuffer,
    doors,
    deadEnds,
    goal: resolvedGoal,
  } satisfies AreaDefinition;
}

function cloneEntryPoints(entryPoints: AreaDefinition['entryPoints']): AreaDefinition['entryPoints'] {
  const clone: AreaDefinition['entryPoints'] = {
    default: {
      position: { ...entryPoints.default.position },
      ...(entryPoints.default.facing ? { facing: entryPoints.default.facing } : {}),
    },
  };

  DIRECTIONS.forEach((direction) => {
    const entry = entryPoints[direction];
    if (!entry) {
      return;
    }

    clone[direction] = {
      position: { ...entry.position },
      ...(entry.facing ? { facing: entry.facing } : {}),
    };
  });

  return clone;
}

function enforceEntryPointDoorSpacing(
  entryPoints: AreaDefinition['entryPoints'],
  doors: AreaDoorDefinition[],
  neighbors: AreaDefinition['neighbors'],
  tileSize: number,
  bounds: { width: number; height: number },
  doorBuffer: number,
): AreaDefinition['entryPoints'] {
  if (!doors?.length) {
    return entryPoints;
  }

  const minCoordinate = {
    x: tileSize,
    y: tileSize,
  };
  const maxCoordinate = {
    x: Math.max(tileSize, bounds.width - tileSize),
    y: Math.max(tileSize, bounds.height - tileSize),
  };

  DIRECTIONS.forEach((direction) => {
    const entry = entryPoints[direction];
    if (!entry) {
      return;
    }

    const target = neighbors[direction];
    if (!target) {
      return;
    }

    const door = doors.find((candidate) => candidate.direction === direction && candidate.target === target);
    if (!door) {
      return;
    }

    const axis = direction === 'north' || direction === 'south' ? 'y' : 'x';
    const inwardSign = direction === 'north' || direction === 'west' ? 1 : -1;
    const distanceFromDoor = (entry.position[axis] - door.position[axis]) * inwardSign;
    const safeRadiusTiles = Math.max(door.safeRadius ?? doorBuffer, doorBuffer);
    const minDistance = (safeRadiusTiles + 1) * tileSize;
    if (distanceFromDoor >= minDistance) {
      return;
    }

    const candidate = door.position[axis] + minDistance * inwardSign;
    const clamped = clamp(candidate, minCoordinate[axis], maxCoordinate[axis]);
    entry.position[axis] = clamped;
  });

  return entryPoints;
}

function deriveDoors(
  layout: string[],
  tileSize: number,
  neighbors: AreaDefinition['neighbors'],
  doorBuffer: number,
): AreaDoorDefinition[] {
  const doors: AreaDoorDefinition[] = [];
  const directionCounts = new Map<AreaTransitionDirection, number>();

  layout.forEach((row, rowIndex) => {
    [...row].forEach((symbol, columnIndex) => {
      if (symbol !== 'D') {
        return;
      }

      const direction = inferDoorDirectionForTile(columnIndex, rowIndex, layout, neighbors);
      if (!direction) {
        return;
      }

      const id = `${direction}-${directionCounts.get(direction) ?? 0}`;
      directionCounts.set(direction, (directionCounts.get(direction) ?? 0) + 1);

      const position = tileToWorld({ column: columnIndex, row: rowIndex }, tileSize);
      doors.push({
        id,
        direction,
        tile: { column: columnIndex, row: rowIndex },
        position,
        safeRadius: doorBuffer,
        type: 'standard',
        target: neighbors[direction],
      });
    });
  });

  return doors;
}

function inferDoorDirectionForTile(
  column: number,
  row: number,
  layout: string[],
  neighbors?: AreaDefinition['neighbors'],
): AreaTransitionDirection | undefined {
  const rows = layout.length;
  const columns = layout[0]?.length ?? 0;
  const edgeOffset = 1;
  const candidates: Array<{ direction: AreaTransitionDirection; interior?: TileCoordinate }> = [];

  if (row <= edgeOffset) {
    candidates.push({ direction: 'north', interior: { column, row: Math.min(row + 1, rows - 1) } });
  }

  if (row >= rows - 1 - edgeOffset) {
    candidates.push({ direction: 'south', interior: { column, row: Math.max(row - 1, 0) } });
  }

  if (column <= edgeOffset) {
    candidates.push({ direction: 'west', interior: { column: Math.min(column + 1, columns - 1), row } });
  }

  if (column >= columns - 1 - edgeOffset) {
    candidates.push({ direction: 'east', interior: { column: Math.max(column - 1, 0), row } });
  }

  const eligible = neighbors
    ? candidates.filter((candidate) => neighbors[candidate.direction])
    : candidates;

  for (const candidate of eligible) {
    if (!candidate?.interior) {
      continue;
    }

    const symbol = layout[candidate.interior.row]?.[candidate.interior.column];
    if (isWalkableSymbol(symbol)) {
      return candidate.direction;
    }
  }

  return eligible[0]?.direction ?? candidates[0]?.direction;
}

function deriveDeadEnds(layout: string[], tileSize: number, overrides?: DeadEndOverride[]): DeadEndDefinition[] {
  const deadEnds: DeadEndDefinition[] = [];
  let rewardIndex = 0;

  layout.forEach((row, rowIndex) => {
    [...row].forEach((symbol, columnIndex) => {
      if (!isWalkableFloorSymbol(symbol)) {
        return;
      }

      const neighbors = countWalkableNeighbors(layout, columnIndex, rowIndex);
      if (neighbors !== 1) {
        return;
      }

      const id = `dead-end-${deadEnds.length}`;
      const position = tileToWorld({ column: columnIndex, row: rowIndex }, tileSize);
      const reward = DEAD_END_REWARDS[rewardIndex % DEAD_END_REWARDS.length];
      rewardIndex += 1;
      deadEnds.push({
        id,
        tile: { column: columnIndex, row: rowIndex },
        position,
        reward,
      });
    });
  });

  if (overrides?.length) {
    overrides.forEach((override) => {
      const exists = deadEnds.some(
        (deadEnd) => deadEnd.tile.column === override.column && deadEnd.tile.row === override.row,
      );

      if (exists) {
        return;
      }

      const position = tileToWorld({ column: override.column, row: override.row }, tileSize);
      const reward = override.reward ?? DEAD_END_REWARDS[rewardIndex % DEAD_END_REWARDS.length];
      rewardIndex += 1;
      deadEnds.push({
        id: `dead-end-${deadEnds.length}`,
        tile: { column: override.column, row: override.row },
        position,
        reward,
      });
    });
  }

  return deadEnds;
}

function resolveGoalMetadata(goal: (AreaGoalMetadata & { direction?: AreaTransitionDirection }) | null, doors: AreaDoorDefinition[]) {
  if (!goal) {
    return null;
  }

  if (goal.doorId) {
    const doorExists = doors.some((door) => door.id === goal.doorId);
    if (doorExists) {
      markGoalDoor(goal.doorId, doors);
      return { ...goal } satisfies AreaGoalMetadata;
    }
  }

  if (goal.direction) {
    const door = doors.find((candidate) => candidate.direction === goal.direction);
    if (door) {
      markGoalDoor(door.id, doors);
      return {
        doorId: door.id,
        texture: goal.texture,
        resultOverlayKey: goal.resultOverlayKey,
        scoreBonus: goal.scoreBonus,
      } satisfies AreaGoalMetadata;
    }
  }

  return null;
}

function markGoalDoor(doorId: string, doors: AreaDoorDefinition[]) {
  doors.forEach((door) => {
    if (door.id === doorId) {
      door.type = 'goal';
    }
  });
}

function tileToWorld(tile: TileCoordinate, tileSize: number): Vector2 {
  return {
    x: tile.column * tileSize + tileSize / 2,
    y: tile.row * tileSize + tileSize / 2,
  } satisfies Vector2;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isWalkableSymbol(symbol: string | undefined) {
  return symbol === '.' || symbol === 'D';
}

function isWalkableFloorSymbol(symbol: string | undefined) {
  return symbol === '.';
}

function countWalkableNeighbors(layout: string[], column: number, row: number) {
  const deltas = [
    { column: 1, row: 0 },
    { column: -1, row: 0 },
    { column: 0, row: 1 },
    { column: 0, row: -1 },
  ];

  let count = 0;
  for (const delta of deltas) {
    const neighbor = layout[row + delta.row]?.[column + delta.column];
    if (isWalkableSymbol(neighbor)) {
      count += 1;
    }
  }

  return count;
}
