import type { LoadedArea, Vector2, AreaDoorDefinition } from '../world/AreaManager';
import type { RunTimer } from '../performance/RunTimer';

export interface GoalDoorControllerOptions {
  sceneEvents: { emit: (event: string, payload?: unknown) => void };
  getAreaState: () => LoadedArea | undefined;
  getPlayerPosition: () => Vector2 | undefined;
  getScore: () => number;
  runTimer: RunTimer;
}

export class GoalDoorController {
  private readonly sceneEvents: GoalDoorControllerOptions['sceneEvents'];
  private readonly getAreaState: GoalDoorControllerOptions['getAreaState'];
  private readonly getPlayerPosition: GoalDoorControllerOptions['getPlayerPosition'];
  private readonly getScore: GoalDoorControllerOptions['getScore'];
  private readonly runTimer: RunTimer;
  private triggeredAreaId?: string;

  constructor(options: GoalDoorControllerOptions) {
    this.sceneEvents = options.sceneEvents;
    this.getAreaState = options.getAreaState;
    this.getPlayerPosition = options.getPlayerPosition;
    this.getScore = options.getScore;
    this.runTimer = options.runTimer;
  }

  update() {
    const area = this.getAreaState();
    if (!area) {
      return;
    }

    if (this.triggeredAreaId === area.definition.id) {
      return;
    }

    const goalDoor = this.resolveGoalDoor(area);
    if (!goalDoor) {
      return;
    }

    const player = this.getPlayerPosition();
    if (!player) {
      return;
    }

    if (!isWithinBounds(player, goalDoor.bounds)) {
      return;
    }

    this.triggeredAreaId = area.definition.id;
    this.runTimer.stop();
    this.sceneEvents.emit('goal:reached', {
      score: this.getScore(),
      timeMs: this.runTimer.getElapsedMs(),
      doorId: goalDoor.door.id,
      areaId: area.definition.id,
    });
  }

  handleAreaChanged() {
    this.triggeredAreaId = undefined;
  }

  private resolveGoalDoor(area: LoadedArea): GoalDoorMetadata | undefined {
    const doorId = area.definition.goal?.doorId;
    const doors = area.definition.doors ?? [];

    let targetDoor: AreaDoorDefinition | undefined;
    if (doorId) {
      targetDoor = doors.find((door) => door.id === doorId);
    }

    if (!targetDoor) {
      targetDoor = doors.find((door) => door.type === 'goal');
    }

    if (!targetDoor) {
      return undefined;
    }

    const tileSize = area.definition.tileSize;
    const half = tileSize / 2;
    const centerX = targetDoor.tile.column * tileSize + half;
    const centerY = targetDoor.tile.row * tileSize + half;

    return {
      door: targetDoor,
      bounds: {
        minX: centerX - half,
        maxX: centerX + half,
        minY: centerY - half,
        maxY: centerY + half,
      },
    } satisfies GoalDoorMetadata;
  }
}

interface GoalDoorMetadata {
  door: AreaDoorDefinition;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

function isWithinBounds(point: Vector2, bounds: GoalDoorMetadata['bounds']) {
  return (
    point.x >= bounds.minX &&
    point.x <= bounds.maxX &&
    point.y >= bounds.minY &&
    point.y <= bounds.maxY
  );
}
