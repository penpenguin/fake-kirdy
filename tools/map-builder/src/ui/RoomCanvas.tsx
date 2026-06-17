import { useRef, type PointerEvent } from 'react';
import { dragRoomObjectPosition, resizeRoomObject, type PointerPoint } from '../domain/roomCanvasInteraction';
import type { RuntimeContent, RuntimeLayout, Vector2 } from '../domain/project';

type Props = {
  layout: RuntimeLayout;
  selectedObjectId: string | null;
  onSelectObject: (objectId: string | null) => void;
  onMoveObject: (objectId: string, position: Vector2) => void;
  onResizeObject: (objectId: string, size: Vector2) => void;
  snapSize?: number;
};

type Interaction =
  | {
      mode: 'move';
      objectId: string;
      startPointer: PointerPoint;
      startPosition: Vector2;
      objectSize?: Vector2;
    }
  | {
      mode: 'resize';
      objectId: string;
      startPointer: PointerPoint;
      startSize: Vector2;
      position: Vector2;
    };

const markerCollections = ['enemies', 'heals', 'collectibles', 'hazards', 'ability_gates', 'goals'] as const;

export function RoomCanvas({
  layout,
  selectedObjectId,
  onSelectObject,
  onMoveObject,
  onResizeObject,
  snapSize = 8,
}: Props): JSX.Element {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const interactionRef = useRef<Interaction | null>(null);
  const room = layout.room ?? {};
  const width = Number(room.width ?? 760);
  const height = Number(room.height ?? 432);
  const content = layout.content ?? {};
  const roomSize = { width, height };

  const beginMove = (objectId: string, position: Vector2 | undefined, objectSize: Vector2 | undefined, event: PointerEvent): void => {
    if (position === undefined) {
      return;
    }
    event.stopPropagation();
    event.preventDefault();
    onSelectObject(objectId);
    event.currentTarget.setPointerCapture(event.pointerId);
    interactionRef.current = {
      mode: 'move',
      objectId,
      startPointer: pointerFromEvent(event),
      startPosition: position,
      objectSize,
    };
  };

  const beginResize = (objectId: string, position: Vector2 | undefined, size: Vector2 | undefined, event: PointerEvent): void => {
    if (position === undefined || size === undefined) {
      return;
    }
    event.stopPropagation();
    event.preventDefault();
    onSelectObject(objectId);
    event.currentTarget.setPointerCapture(event.pointerId);
    interactionRef.current = {
      mode: 'resize',
      objectId,
      startPointer: pointerFromEvent(event),
      startSize: size,
      position,
    };
  };

  const continueInteraction = (event: PointerEvent): void => {
    const interaction = interactionRef.current;
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (interaction === null || canvasRect === undefined) {
      return;
    }

    event.preventDefault();
    if (interaction.mode === 'move') {
      onMoveObject(interaction.objectId, dragRoomObjectPosition({
        startPosition: interaction.startPosition,
        objectSize: interaction.objectSize,
        startPointer: interaction.startPointer,
        currentPointer: pointerFromEvent(event),
        canvasRect,
        roomSize,
        snapSize,
        snap: !event.shiftKey,
      }));
      return;
    }

    onResizeObject(interaction.objectId, resizeRoomObject({
      position: interaction.position,
      startSize: interaction.startSize,
      startPointer: interaction.startPointer,
      currentPointer: pointerFromEvent(event),
      canvasRect,
      roomSize,
      snapSize,
      snap: !event.shiftKey,
    }));
  };

  const endInteraction = (): void => {
    interactionRef.current = null;
  };

  return (
    <div className="room-canvas-wrap">
      <div
        ref={canvasRef}
        className="room-canvas"
        style={{ aspectRatio: `${width} / ${height}` }}
        onPointerMove={continueInteraction}
        onPointerUp={endInteraction}
        onPointerCancel={endInteraction}
        onClick={() => onSelectObject(null)}
      >
        <GridLayer columns={Number(layout.grid?.columns ?? 18)} rows={Number(layout.grid?.rows ?? 12)} />
        {layout.camera_bounds !== undefined ? (
          <RoomRect
            id="camera_bounds"
            label="camera"
            position={layout.camera_bounds.position}
            size={layout.camera_bounds.size}
            className="room-rect camera"
            selectedObjectId={selectedObjectId}
            roomWidth={width}
            roomHeight={height}
            onSelectObject={onSelectObject}
            onBeginMove={beginMove}
            onBeginResize={beginResize}
          />
        ) : null}
        {flattenSurfaces(layout).map((surface) => (
          <RoomRect
            key={surface.objectId}
            id={surface.objectId}
            label={surface.label}
            position={surface.position}
            size={surface.size}
            className={surface.kind === 'floor' || surface.kind === 'floor_segment' ? 'room-rect floor' : 'room-rect platform'}
            selectedObjectId={selectedObjectId}
            roomWidth={width}
            roomHeight={height}
            onSelectObject={onSelectObject}
            onBeginMove={beginMove}
            onBeginResize={beginResize}
          />
        ))}
        {Object.entries(layout.doors ?? {}).map(([direction, position]) => (
          <RoomPoint
            key={`door-${direction}`}
            id={`door:${direction}`}
            label={direction}
            position={position}
            className="room-point door"
            selectedObjectId={selectedObjectId}
            roomWidth={width}
            roomHeight={height}
            onSelectObject={onSelectObject}
            onBeginMove={beginMove}
          />
        ))}
        {Object.entries(layout.spawns ?? {}).map(([spawnId, position]) => (
          <RoomPoint
            key={`spawn-${spawnId}`}
            id={`spawn:${spawnId}`}
            label={spawnId}
            position={position}
            className="room-point spawn"
            selectedObjectId={selectedObjectId}
            roomWidth={width}
            roomHeight={height}
            onSelectObject={onSelectObject}
            onBeginMove={beginMove}
          />
        ))}
        {flattenMarkers(content).map((marker) => (
          <RoomPoint
            key={marker.id}
            id={marker.id}
            label={marker.kind}
            position={marker.position}
            className={`room-point ${marker.kind}`}
            selectedObjectId={selectedObjectId}
            roomWidth={width}
            roomHeight={height}
            onSelectObject={onSelectObject}
            onBeginMove={beginMove}
          />
        ))}
      </div>
    </div>
  );
}

function GridLayer({ columns, rows }: { columns: number; rows: number }): JSX.Element {
  return (
    <div
      className="room-grid"
      style={{
        backgroundSize: `${100 / columns}% ${100 / rows}%`,
      }}
    />
  );
}

function RoomRect({
  id,
  label,
  position,
  size,
  className,
  selectedObjectId,
  roomWidth,
  roomHeight,
  onSelectObject,
  onBeginMove,
  onBeginResize,
}: {
  id: string;
  label: string;
  position?: Vector2;
  size?: Vector2;
  className: string;
  selectedObjectId: string | null;
  roomWidth: number;
  roomHeight: number;
  onSelectObject: (objectId: string | null) => void;
  onBeginMove: (objectId: string, position: Vector2 | undefined, objectSize: Vector2 | undefined, event: PointerEvent) => void;
  onBeginResize: (objectId: string, position: Vector2 | undefined, size: Vector2 | undefined, event: PointerEvent) => void;
}): JSX.Element | null {
  if (position === undefined || size === undefined) {
    return null;
  }

  return (
    <button
      type="button"
      className={`${className} ${selectedObjectId === id ? 'is-selected' : ''}`}
      style={{
        left: `${((position.x - (size.x / 2)) / roomWidth) * 100}%`,
        top: `${((position.y - (size.y / 2)) / roomHeight) * 100}%`,
        width: `${(size.x / roomWidth) * 100}%`,
        height: `${(size.y / roomHeight) * 100}%`,
      }}
      title={id}
      onPointerDown={(event) => onBeginMove(id, position, size, event)}
      onClick={(event) => {
        event.stopPropagation();
        onSelectObject(id);
      }}
    >
      {label}
      <span
        className="room-resize-handle"
        aria-hidden="true"
        onPointerDown={(event) => onBeginResize(id, position, size, event)}
      />
    </button>
  );
}

function RoomPoint({
  id,
  label,
  position,
  className,
  selectedObjectId,
  roomWidth,
  roomHeight,
  onSelectObject,
  onBeginMove,
}: {
  id: string;
  label: string;
  position?: Vector2;
  className: string;
  selectedObjectId: string | null;
  roomWidth: number;
  roomHeight: number;
  onSelectObject: (objectId: string | null) => void;
  onBeginMove: (objectId: string, position: Vector2 | undefined, objectSize: Vector2 | undefined, event: PointerEvent) => void;
}): JSX.Element | null {
  if (position === undefined) {
    return null;
  }

  return (
    <button
      type="button"
      className={`${className} ${selectedObjectId === id ? 'is-selected' : ''}`}
      style={{
        left: `${(position.x / roomWidth) * 100}%`,
        top: `${(position.y / roomHeight) * 100}%`,
      }}
      title={id}
      onPointerDown={(event) => onBeginMove(id, position, undefined, event)}
      onClick={(event) => {
        event.stopPropagation();
        onSelectObject(id);
      }}
    >
      {label}
    </button>
  );
}

function pointerFromEvent(event: PointerEvent): PointerPoint {
  return {
    x: event.clientX,
    y: event.clientY,
  };
}

function flattenMarkers(content: RuntimeContent): Array<{ id: string; kind: string; position?: Vector2 }> {
  return markerCollections.flatMap((kind) =>
    (content[kind] ?? []).map((marker) => ({
      id: String(marker.id ?? marker[`${kind.slice(0, -1)}_id`] ?? `${kind}.unknown`),
      kind,
      position: marker.position as Vector2 | undefined,
    })),
  );
}

function flattenSurfaces(layout: RuntimeLayout): Array<{
  objectId: string;
  label: string;
  kind: 'floor' | 'floor_segment' | 'platform';
  position?: Vector2;
  size?: Vector2;
}> {
  const surfaces = [
    ...(layout.floor === undefined ? [] : [{
      objectId: `floor:${layout.floor.id ?? 'floor'}`,
      label: layout.floor.id ?? 'floor',
      kind: 'floor' as const,
      ...layout.floor,
    }]),
    ...(layout.floor_segments ?? []).map((surface, index) => ({
      objectId: `floor_segment:${surface.id ?? index}`,
      label: surface.id ?? `floor ${index + 1}`,
      kind: 'floor_segment' as const,
      ...surface,
    })),
    ...(layout.platforms ?? []).map((surface, index) => ({
      objectId: `platform:${surface.id ?? index}`,
      label: surface.id ?? `platform ${index + 1}`,
      kind: 'platform' as const,
      ...surface,
    })),
  ];
  const seen = new Set<string>();

  return surfaces.filter((surface) => {
    if (seen.has(surface.objectId)) {
      return false;
    }
    seen.add(surface.objectId);
    return true;
  });
}
