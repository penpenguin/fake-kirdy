import type { Vector2 } from './project';

export type CanvasRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type RoomSize = {
  width: number;
  height: number;
};

export type PointerPoint = {
  x: number;
  y: number;
};

export type DragRoomObjectOptions = {
  startPosition: Vector2;
  objectSize?: Vector2;
  startPointer: PointerPoint;
  currentPointer: PointerPoint;
  canvasRect: CanvasRect;
  roomSize: RoomSize;
  snapSize: number;
  snap: boolean;
};

export type ResizeRoomObjectOptions = {
  position: Vector2;
  startSize: Vector2;
  startPointer: PointerPoint;
  currentPointer: PointerPoint;
  canvasRect: CanvasRect;
  roomSize: RoomSize;
  snapSize: number;
  snap: boolean;
  minSize?: Vector2;
};

export function dragRoomObjectPosition(options: DragRoomObjectOptions): Vector2 {
  const delta = pointerDeltaToRoomDelta(options.startPointer, options.currentPointer, options.canvasRect, options.roomSize);
  const rawPosition = {
    x: options.startPosition.x + delta.x,
    y: options.startPosition.y + delta.y,
  };
  const snapped = snapVector(rawPosition, options.snapSize, options.snap);

  return clampPosition(snapped, options.roomSize, options.objectSize);
}

export function resizeRoomObject(options: ResizeRoomObjectOptions): Vector2 {
  const delta = pointerDeltaToRoomDelta(options.startPointer, options.currentPointer, options.canvasRect, options.roomSize);
  const minSize = options.minSize ?? { x: 16, y: 16 };
  const maxSize = maxCenteredRectSize(options.position, options.roomSize, minSize);
  const snapped = snapVector({
    x: options.startSize.x + delta.x,
    y: options.startSize.y + delta.y,
  }, options.snapSize, options.snap);

  return {
    x: clamp(snapped.x, minSize.x, maxSize.x),
    y: clamp(snapped.y, minSize.y, maxSize.y),
  };
}

function pointerDeltaToRoomDelta(
  startPointer: PointerPoint,
  currentPointer: PointerPoint,
  canvasRect: CanvasRect,
  roomSize: RoomSize,
): Vector2 {
  return {
    x: ((currentPointer.x - startPointer.x) / canvasRect.width) * roomSize.width,
    y: ((currentPointer.y - startPointer.y) / canvasRect.height) * roomSize.height,
  };
}

function clampPosition(position: Vector2, roomSize: RoomSize, objectSize: Vector2 | undefined): Vector2 {
  if (objectSize === undefined) {
    return {
      x: clamp(position.x, 0, roomSize.width),
      y: clamp(position.y, 0, roomSize.height),
    };
  }

  return {
    x: clamp(position.x, objectSize.x / 2, roomSize.width - (objectSize.x / 2)),
    y: clamp(position.y, objectSize.y / 2, roomSize.height - (objectSize.y / 2)),
  };
}

function maxCenteredRectSize(position: Vector2, roomSize: RoomSize, minSize: Vector2): Vector2 {
  return {
    x: Math.max(minSize.x, 2 * Math.min(position.x, roomSize.width - position.x)),
    y: Math.max(minSize.y, 2 * Math.min(position.y, roomSize.height - position.y)),
  };
}

function snapVector(value: Vector2, snapSize: number, snap: boolean): Vector2 {
  if (!snap || snapSize <= 0) {
    return {
      x: Math.round(value.x),
      y: Math.round(value.y),
    };
  }

  return {
    x: Math.round(value.x / snapSize) * snapSize,
    y: Math.round(value.y / snapSize) * snapSize,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
