import { useMemo, useState } from 'react';
import { getEffectiveRuntimeLayout, updateRuntimeContent, updateRuntimeLayoutSection } from '../domain/applyRoomEdits';
import { getMarkerFieldInputType, parseMarkerFieldInputValue } from '../domain/markerFieldValues';
import { buildRoomOptions, type BuilderRoomOption, updateAuthoredRoomLayout } from '../domain/roomIndex';
import type { BuilderProject, JsonObject, RectPayload, RuntimeContent, RuntimeLayout, Vector2 } from '../domain/project';
import { ObjectPalette } from './ObjectPalette';
import { RoomCanvas } from './RoomCanvas';

type Props = {
  project: BuilderProject;
  onProjectChange: (project: BuilderProject) => void;
};

const markerCollections = ['enemies', 'heals', 'collectibles', 'hazards', 'ability_gates', 'goals'] as const;

export function RoomEditor({ project, onProjectChange }: Props): JSX.Element {
  const rooms = useMemo(() => buildRoomOptions(project), [project]);
  const [selectedRoomKey, setSelectedRoomKey] = useState(rooms[0]?.key ?? '');
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const selectedRoom = rooms.find((room) => room.key === selectedRoomKey) ?? rooms[0];
  const layout = selectedRoom?.layout ?? {};

  const updateLayout = (nextLayout: RuntimeLayout): void => {
    if (selectedRoom === undefined) {
      return;
    }
    if (selectedRoom.source === 'authored_scene') {
      onProjectChange(updateAuthoredRoomLayout(project, selectedRoom.key, nextLayout));
      return;
    }

    if (selectedRoom.generatedLevel === undefined) {
      return;
    }

    onProjectChange({
      ...project,
      proceduralLevelOverrides: {
        ...project.proceduralLevelOverrides,
        levels: {
          ...project.proceduralLevelOverrides.levels,
          [selectedRoom.generatedLevel.stage_id]: {
            ...(project.proceduralLevelOverrides.levels[selectedRoom.generatedLevel.stage_id] ?? {}),
            runtime_layout: {
              ...(getEffectiveRuntimeLayout(selectedRoom.generatedLevel, project.proceduralLevelOverrides) ?? {}),
              ...nextLayout,
            },
          },
        },
      },
    });
  };

  const updateLayoutSection = <K extends keyof RuntimeLayout>(key: K, value: RuntimeLayout[K]): void => {
    if (selectedRoom?.source === 'generated_schema' && selectedRoom.generatedLevel !== undefined) {
      onProjectChange({
        ...project,
        proceduralLevelOverrides: updateRuntimeLayoutSection(project.proceduralLevelOverrides, selectedRoom.generatedLevel.stage_id, key as never, value as never),
      });
      return;
    }

    updateLayout({
      ...layout,
      [key]: value,
    });
  };

  const updateContent = (content: RuntimeContent): void => {
    if (selectedRoom?.source === 'generated_schema' && selectedRoom.generatedLevel !== undefined) {
      onProjectChange({
        ...project,
        proceduralLevelOverrides: updateRuntimeContent(project.proceduralLevelOverrides, selectedRoom.generatedLevel, content),
      });
      return;
    }

    updateLayout({
      ...layout,
      content,
    });
  };

  const addSpawn = (): void => {
    const key = uniqueRecordKey(layout.spawns ?? {}, 'builder_spawn');
    updateLayoutSection('spawns', {
      ...(layout.spawns ?? {}),
      [key]: { x: 96, y: 368 },
    });
  };

  const addDoor = (): void => {
    const key = uniqueRecordKey(layout.doors ?? {}, 'builder_door');
    updateLayoutSection('doors', {
      ...(layout.doors ?? {}),
      [key]: { x: 704, y: 368 },
    });
  };

  const addRect = (key: 'floor_segments' | 'platforms'): void => {
    const collection = layout[key] ?? [];
    const id = uniqueRectId(collection, key === 'floor_segments' ? 'BuilderFloor' : 'BuilderPlatform');
    updateLayoutSection(key, [
      ...collection,
      {
        id,
        position: { x: 380, y: key === 'floor_segments' ? 432 : 320 },
        size: { x: key === 'floor_segments' ? 240 : 144, y: 24 },
      },
    ]);
  };

  const moveObject = (objectId: string, position: Vector2): void => {
    const selected = findSelectedObject(layout, objectId);
    if (objectId === 'camera_bounds') {
      updateLayoutSection('camera_bounds', {
        ...(layout.camera_bounds ?? {}),
        position,
      });
      return;
    }
    if (selected === null) {
      return;
    }
    if (selected.kind === 'spawn') {
      updateLayoutSection('spawns', {
        ...(layout.spawns ?? {}),
        [selected.key]: position,
      });
      return;
    }
    if (selected.kind === 'door') {
      updateLayoutSection('doors', {
        ...(layout.doors ?? {}),
        [selected.key]: position,
      });
      return;
    }
    if (selected.kind === 'floor' || selected.kind === 'floor_segment' || selected.kind === 'platform') {
      updateRect(layout, selected.kind, selected.key, {
        ...(selected.value as RectPayload),
        position,
      }, updateLayoutSection);
      return;
    }

    const content = layout.content ?? {};
    const collection = selected.kind as typeof markerCollections[number];
    updateContent({
      ...content,
      [collection]: (content[collection] ?? []).map((candidate) =>
        String(candidate.id) === selected.key
          ? { ...candidate, position }
          : candidate,
      ),
    });
  };

  const resizeObject = (objectId: string, size: Vector2): void => {
    const selected = findSelectedObject(layout, objectId);
    if (objectId === 'camera_bounds') {
      updateLayoutSection('camera_bounds', {
        ...(layout.camera_bounds ?? {}),
        size,
      });
      return;
    }
    if (selected === null || !(selected.kind === 'floor' || selected.kind === 'floor_segment' || selected.kind === 'platform')) {
      return;
    }
    updateRect(layout, selected.kind, selected.key, {
      ...(selected.value as RectPayload),
      size,
    }, updateLayoutSection);
  };

  if (selectedRoom === undefined) {
    return (
      <section className="room-editor">
        <div className="room-editor__empty">No rooms found.</div>
      </section>
    );
  }

  return (
    <section className="room-editor">
      <div className="room-editor__toolbar">
        <div className="room-editor__toolbar-main">
          <label>
            Room
            <select
              value={selectedRoom.key}
              onChange={(event) => {
                setSelectedRoomKey(event.target.value);
                setSelectedObjectId(null);
              }}
            >
              {rooms.map((room) => (
                <option key={room.key} value={room.key}>
                  {room.source === 'generated_schema' ? 'GENERATED' : 'AUTHORED'} / {room.id} / {room.cluster}
                </option>
              ))}
            </select>
          </label>
          <span className={`room-source-pill ${selectedRoom.source === 'generated_schema' ? 'generated' : 'authored'}`}>
            {selectedRoom.source === 'generated_schema' ? 'GENERATED' : 'AUTHORED'}
          </span>
        </div>
        <div className="layout-palette" aria-label="Layout palette">
          <button type="button" onClick={addSpawn}>Add spawn</button>
          <button type="button" onClick={addDoor}>Add door</button>
          <button type="button" onClick={() => addRect('floor_segments')}>Add floor</button>
          <button type="button" onClick={() => addRect('platforms')}>Add platform</button>
        </div>
        <ObjectPalette content={layout.content ?? {}} onChange={updateContent} />
      </div>
      <div className="room-editor__body">
        <RoomCanvas
          layout={layout}
          selectedObjectId={selectedObjectId}
          onSelectObject={setSelectedObjectId}
          onMoveObject={moveObject}
          onResizeObject={resizeObject}
        />
        <RoomObjectInspector
          room={selectedRoom}
          layout={layout}
          selectedObjectId={selectedObjectId}
          onLayoutChange={updateLayoutSection}
          onContentChange={updateContent}
        />
      </div>
    </section>
  );
}

function RoomObjectInspector({
  room,
  layout,
  selectedObjectId,
  onLayoutChange,
  onContentChange,
}: {
  room: BuilderRoomOption;
  layout: RuntimeLayout;
  selectedObjectId: string | null;
  onLayoutChange: <K extends keyof RuntimeLayout>(key: K, value: RuntimeLayout[K]) => void;
  onContentChange: (content: RuntimeContent) => void;
}): JSX.Element {
  const selected = findSelectedObject(layout, selectedObjectId);

  if (selected === null) {
    return (
      <aside className="room-object-inspector">
        <h2>{room.id}</h2>
        <dl className="detail-list">
          <dt>Source</dt>
          <dd>{room.source === 'generated_schema' ? 'generated schema' : room.scenePath}</dd>
          <dt>Stage</dt>
          <dd>{room.stageId ?? 'catalog-only'}</dd>
        </dl>
        <p className="muted">Select a surface, spawn, door, or content marker.</p>
        <CameraEditor layout={layout} onLayoutChange={onLayoutChange} />
      </aside>
    );
  }

  return (
    <aside className="room-object-inspector">
      <h2>{selectedObjectId}</h2>
      {selected.kind === 'spawn' || selected.kind === 'door' ? (
        <PointEditor
          label={selected.key}
          value={selected.value as Vector2}
          onChange={(position) => {
            const section = selected.kind === 'spawn' ? 'spawns' : 'doors';
            onLayoutChange(section, {
              ...(layout[section] ?? {}),
              [selected.key]: position,
            });
          }}
        />
      ) : selected.kind === 'floor' || selected.kind === 'floor_segment' || selected.kind === 'platform' ? (
        <RectEditor
          rect={selected.value as RectPayload}
          onChange={(rect) => updateRect(layout, selected.kind, selected.key, rect, onLayoutChange)}
          onRemove={() => removeRect(layout, selected.kind, selected.key, onLayoutChange)}
        />
      ) : selected.kind === 'camera_bounds' ? (
        <CameraBoundsEditor
          camera={selected.value as NonNullable<RuntimeLayout['camera_bounds']>}
          onChange={(camera) => onLayoutChange('camera_bounds', camera)}
        />
      ) : (
        <MarkerEditor
          marker={selected.value as JsonObject}
          onChange={(marker) => {
            const content = layout.content ?? {};
            const collection = selected.kind as typeof markerCollections[number];
            onContentChange({
              ...content,
              [collection]: (content[collection] ?? []).map((candidate) =>
                String(candidate.id) === selected.key ? marker : candidate,
              ),
            });
          }}
          onRemove={() => {
            const content = layout.content ?? {};
            const collection = selected.kind as typeof markerCollections[number];
            onContentChange({
              ...content,
              [collection]: (content[collection] ?? []).filter((candidate) => String(candidate.id) !== selectedObjectId),
            });
          }}
        />
      )}
      <CameraEditor layout={layout} onLayoutChange={onLayoutChange} />
    </aside>
  );
}

function CameraBoundsEditor({
  camera,
  onChange,
}: {
  camera: NonNullable<RuntimeLayout['camera_bounds']>;
  onChange: (camera: NonNullable<RuntimeLayout['camera_bounds']>) => void;
}): JSX.Element {
  return (
    <div className="marker-editor">
      <PointEditor label="position" value={camera.position ?? { x: 380, y: 178 }} onChange={(position) => onChange({ ...camera, position })} />
      <PointEditor label="size" value={camera.size ?? { x: 840, y: 540 }} onChange={(size) => onChange({ ...camera, size })} />
    </div>
  );
}

function CameraEditor({
  layout,
  onLayoutChange,
}: {
  layout: RuntimeLayout;
  onLayoutChange: <K extends keyof RuntimeLayout>(key: K, value: RuntimeLayout[K]) => void;
}): JSX.Element {
  const camera = layout.camera_bounds ?? {
    position: { x: 380, y: 178 },
    size: { x: 840, y: 540 },
  };

  return (
    <section className="inspector-section">
      <h3>Camera Bounds</h3>
      <PointEditor
        label="position"
        value={camera.position ?? { x: 380, y: 178 }}
        onChange={(position) => onLayoutChange('camera_bounds', { ...camera, position })}
      />
      <PointEditor
        label="size"
        value={camera.size ?? { x: 840, y: 540 }}
        onChange={(size) => onLayoutChange('camera_bounds', { ...camera, size })}
      />
    </section>
  );
}

function PointEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Vector2;
  onChange: (value: Vector2) => void;
}): JSX.Element {
  return (
    <div className="field-row">
      <label>
        {label}.x
        <input type="number" value={value.x} onChange={(event) => onChange({ ...value, x: event.target.valueAsNumber })} />
      </label>
      <label>
        {label}.y
        <input type="number" value={value.y} onChange={(event) => onChange({ ...value, y: event.target.valueAsNumber })} />
      </label>
    </div>
  );
}

function RectEditor({
  rect,
  onChange,
  onRemove,
}: {
  rect: RectPayload;
  onChange: (rect: RectPayload) => void;
  onRemove: () => void;
}): JSX.Element {
  return (
    <div className="marker-editor">
      <label>
        id
        <input value={rect.id ?? ''} onChange={(event) => onChange({ ...rect, id: event.target.value })} />
      </label>
      <PointEditor label="position" value={rect.position ?? { x: 0, y: 0 }} onChange={(position) => onChange({ ...rect, position })} />
      <PointEditor label="size" value={rect.size ?? { x: 128, y: 24 }} onChange={(size) => onChange({ ...rect, size })} />
      <button type="button" onClick={onRemove}>Remove surface</button>
    </div>
  );
}

function MarkerEditor({
  marker,
  onChange,
  onRemove,
}: {
  marker: JsonObject;
  onChange: (marker: JsonObject) => void;
  onRemove: () => void;
}): JSX.Element {
  const position = marker.position as Vector2 | undefined ?? { x: 0, y: 0 };
  return (
    <div className="marker-editor">
      {Object.entries(marker).filter(([key]) => key !== 'position').map(([key, value]) => {
        const inputType = getMarkerFieldInputType(value);
        const isBoolean = inputType === 'checkbox';
        return (
          <label key={key}>
            {key}
            <input
              checked={isBoolean ? Boolean(value) : undefined}
              value={isBoolean ? undefined : String(value)}
              type={inputType}
              onChange={(event) => onChange({
                ...marker,
                [key]: parseMarkerFieldInputValue(value, event.target.value, event.target.valueAsNumber, event.target.checked),
              })}
            />
          </label>
        );
      })}
      <PointEditor label="position" value={position} onChange={(nextPosition) => onChange({ ...marker, position: nextPosition })} />
      <button type="button" onClick={onRemove}>Remove marker</button>
    </div>
  );
}

function findSelectedObject(layout: RuntimeLayout, selectedObjectId: string | null): {
  kind: string;
  key: string;
  value: unknown;
} | null {
  if (selectedObjectId === null) {
    return null;
  }

  if (selectedObjectId === 'camera_bounds') {
    return layout.camera_bounds === undefined ? null : { kind: 'camera_bounds', key: 'camera_bounds', value: layout.camera_bounds };
  }

  const [kind, key] = selectedObjectId.split(':');
  if (kind === 'spawn') {
    const value = layout.spawns?.[key];
    return value === undefined ? null : { kind, key, value };
  }
  if (kind === 'door') {
    const value = layout.doors?.[key];
    return value === undefined ? null : { kind, key, value };
  }
  if (kind === 'floor') {
    return layout.floor === undefined ? null : { kind, key, value: layout.floor };
  }
  if (kind === 'floor_segment') {
    const value = (layout.floor_segments ?? []).find((rect) => String(rect.id) === key);
    return value === undefined ? null : { kind, key, value };
  }
  if (kind === 'platform') {
    const value = (layout.platforms ?? []).find((rect) => String(rect.id) === key);
    return value === undefined ? null : { kind, key, value };
  }

  for (const collectionName of markerCollections) {
    const marker = (layout.content?.[collectionName] ?? []).find((candidate) => String(candidate.id) === selectedObjectId);
    if (marker !== undefined) {
      return { kind: collectionName, key: selectedObjectId, value: marker };
    }
  }

  return null;
}

function updateRect(
  layout: RuntimeLayout,
  kind: string,
  key: string,
  rect: RectPayload,
  onLayoutChange: <K extends keyof RuntimeLayout>(field: K, value: RuntimeLayout[K]) => void,
): void {
  if (kind === 'floor') {
    onLayoutChange('floor', rect);
    return;
  }
  if (kind === 'floor_segment') {
    onLayoutChange('floor_segments', (layout.floor_segments ?? []).map((candidate) => String(candidate.id) === key ? rect : candidate));
    return;
  }
  if (kind === 'platform') {
    onLayoutChange('platforms', (layout.platforms ?? []).map((candidate) => String(candidate.id) === key ? rect : candidate));
  }
}

function removeRect(
  layout: RuntimeLayout,
  kind: string,
  key: string,
  onLayoutChange: <K extends keyof RuntimeLayout>(field: K, value: RuntimeLayout[K]) => void,
): void {
  if (kind === 'floor') {
    onLayoutChange('floor', undefined);
    return;
  }
  if (kind === 'floor_segment') {
    onLayoutChange('floor_segments', (layout.floor_segments ?? []).filter((candidate) => String(candidate.id) !== key));
    return;
  }
  if (kind === 'platform') {
    onLayoutChange('platforms', (layout.platforms ?? []).filter((candidate) => String(candidate.id) !== key));
  }
}

function uniqueRecordKey(record: Record<string, unknown>, base: string): string {
  let index = 1;
  let candidate = `${base}_${index}`;
  while (record[candidate] !== undefined) {
    index += 1;
    candidate = `${base}_${index}`;
  }
  return candidate;
}

function uniqueRectId(collection: RectPayload[], base: string): string {
  const ids = new Set(collection.map((rect) => rect.id));
  let index = 1;
  let candidate = `${base}${index}`;
  while (ids.has(candidate)) {
    index += 1;
    candidate = `${base}${index}`;
  }
  return candidate;
}
