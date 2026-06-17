import type {
  AuthoredSceneRoom,
  CatalogLevel,
  JsonObject,
  RectPayload,
  RuntimeContent,
  RuntimeLayout,
  StageDefinition,
  Vector2,
} from './project';

type ParsedNode = {
  name: string;
  type: string;
  parent: string;
  props: JsonObject;
  scriptPath: string | null;
  markerType: MarkerType | null;
  startLine: number;
  endLine: number;
};

type MarkerType =
  | 'player_spawn'
  | 'door'
  | 'enemy_spawn'
  | 'heal'
  | 'collectible'
  | 'hazard'
  | 'ability_gate'
  | 'goal'
  | 'camera_bounds';

type ParseArgs = {
  catalogLevel: Pick<CatalogLevel, 'id' | 'scene_path' | 'stage_id'>;
  stage?: StageDefinition;
  sceneText: string;
};

const markerScriptPaths: Record<MarkerType, string> = {
  player_spawn: 'res://scripts/level/markers/PlayerSpawn.gd',
  door: 'res://scripts/level/markers/DoorMarker.gd',
  enemy_spawn: 'res://scripts/level/markers/EnemySpawnMarker.gd',
  heal: 'res://scripts/level/markers/HealMarker.gd',
  collectible: 'res://scripts/level/markers/CollectibleMarker.gd',
  hazard: 'res://scripts/level/markers/HazardMarker.gd',
  ability_gate: 'res://scripts/level/markers/AbilityGateMarker.gd',
  goal: 'res://scripts/level/markers/GoalMarker.gd',
  camera_bounds: 'res://scripts/level/markers/CameraBoundsMarker.gd',
};

const contentCollectionByMarkerType = {
  enemy_spawn: 'enemies',
  heal: 'heals',
  collectible: 'collectibles',
  hazard: 'hazards',
  ability_gate: 'ability_gates',
  goal: 'goals',
} as const;

export function parseAuthoredSceneRoom({ catalogLevel, stage, sceneText }: ParseArgs): AuthoredSceneRoom {
  const extResources = parseExtResources(sceneText);
  const rectangleSizes = parseRectangleShapeSizes(sceneText);
  const nodes = parseNodes(sceneText, extResources);
  const tileMap = nodes.find((node) => node.type === 'TileMap');
  const camera = nodes.find((node) => node.markerType === 'camera_bounds');
  const surfaces = parseRectSurfaces(nodes, rectangleSizes);
  const content = parseContent(nodes);
  const layout = {
    rows: numberProp(tileMap?.props.rows) ?? stage?.layout.rows ?? 12,
    columns: numberProp(tileMap?.props.columns) ?? stage?.layout.columns ?? 18,
    tile_size: vectorProp(tileMap?.props.metadata_tile_size)?.x ?? stage?.layout.tile_size ?? 32,
  };
  const cameraBounds = camera === undefined
    ? undefined
    : {
        position: vectorProp(camera.props.position) ?? { x: 0, y: 0 },
        size: vectorProp(camera.props.size) ?? { x: 840, y: 540 },
      };
  const runtimeLayout: RuntimeLayout = {
    tile_size: { x: layout.tile_size, y: layout.tile_size },
    grid: { rows: layout.rows, columns: layout.columns },
    room: inferRoomBounds(layout, cameraBounds, surfaces),
    camera_bounds: cameraBounds,
    spawns: Object.fromEntries(nodes
      .filter((node) => node.markerType === 'player_spawn')
      .map((node) => [stringProp(node.props.spawn_id, 'default'), vectorProp(node.props.position) ?? { x: 0, y: 0 }])),
    doors: Object.fromEntries(nodes
      .filter((node) => node.markerType === 'door')
      .map((node) => [stringProp(node.props.door_id, node.name), vectorProp(node.props.position) ?? { x: 0, y: 0 }])),
    floor_segments: surfaces,
    content,
  };

  return {
    id: catalogLevel.id,
    ...(catalogLevel.stage_id !== undefined ? { stage_id: catalogLevel.stage_id } : {}),
    name: stage?.name ?? humanizeId(catalogLevel.id),
    scene_path: catalogLevel.scene_path,
    source: 'authored_scene',
    layout,
    runtime_layout: runtimeLayout,
    warnings: [],
  };
}

export function patchAuthoredSceneRoom(sceneText: string, room: AuthoredSceneRoom): string {
  const parsed = parseSceneForPatch(sceneText);
  const lines = parsed.lines;
  const existingNodes = parsed.nodes;
  const existingNodeNames = new Set(existingNodes.map((node) => node.name));
  const rectangleSizeUpdates = new Map<string, Vector2>();
  const surfaceTargets = new Map(surfacePayloads(room.runtime_layout).map((surface) => [String(surface.id), surface]));

  for (const node of existingNodes) {
    if (node.markerType === 'player_spawn') {
      const spawnId = stringProp(node.props.spawn_id, 'default');
      patchNodePosition(lines, existingNodes, node, room.runtime_layout.spawns?.[spawnId]);
      continue;
    }

    if (node.markerType === 'door') {
      const doorId = stringProp(node.props.door_id, node.name);
      patchNodePosition(lines, existingNodes, node, room.runtime_layout.doors?.[doorId]);
      continue;
    }

    if (node.markerType === 'camera_bounds') {
      patchNodePosition(lines, existingNodes, node, room.runtime_layout.camera_bounds?.position);
      patchNodeProperty(lines, existingNodes, node, 'size', room.runtime_layout.camera_bounds?.size);
      continue;
    }

    const markerCollection = node.markerType === null ? undefined : contentCollectionByMarkerType[node.markerType as keyof typeof contentCollectionByMarkerType];
    if (markerCollection !== undefined) {
      const marker = (room.runtime_layout.content?.[markerCollection] ?? [])
        .find((candidate) => String(candidate.id) === node.name || markerIdFromProps(node.markerType, node.props) === markerIdFromProps(node.markerType, candidate));
      patchNodeFromMarker(lines, existingNodes, node, marker as JsonObject | undefined);
      continue;
    }

    if (node.type === 'StaticBody2D' && node.parent === '.' && surfaceTargets.has(node.name)) {
      const surface = surfaceTargets.get(node.name);
      patchNodePosition(lines, existingNodes, node, surface?.position);
      const shapeResourceId = findCollisionShapeResourceId(node.name, existingNodes);
      if (shapeResourceId !== null && surface?.size !== undefined) {
        rectangleSizeUpdates.set(shapeResourceId, surface.size);
      }
    }
  }

  let patchedText = lines.join('\n');
  for (const [resourceId, size] of rectangleSizeUpdates) {
    patchedText = patchRectangleShapeSize(patchedText, resourceId, size);
  }

  patchedText = removeOmittedSupportedNodes(patchedText, room);
  const additionNodeNames = new Set(parseSceneForPatch(patchedText).nodes.map((node) => node.name));
  const resourceAdditions: string[] = [];
  const nodeAdditions: string[] = [];
  const resourceIds = collectExtResourceIds(patchedText);
  const subResourceIds = collectSubResourceIds(patchedText);
  for (const [spawnId, position] of Object.entries(room.runtime_layout.spawns ?? {})) {
    const existing = existingNodes.some((node) => node.markerType === 'player_spawn' && stringProp(node.props.spawn_id, 'default') === spawnId);
    if (!existing) {
      nodeAdditions.push(...buildMarkerNode({
        nodeName: uniqueNodeName(`PlayerSpawn${toPascal(spawnId)}`, additionNodeNames),
        markerType: 'player_spawn',
        position,
        props: { spawn_id: spawnId },
        resourceIds,
      }));
    }
  }

  for (const [doorId, position] of Object.entries(room.runtime_layout.doors ?? {})) {
    const existing = existingNodes.some((node) => node.markerType === 'door' && stringProp(node.props.door_id, node.name) === doorId);
    if (!existing) {
      nodeAdditions.push(...buildMarkerNode({
        nodeName: uniqueNodeName(toPascal(doorId), additionNodeNames),
        markerType: 'door',
        position,
        props: { door_id: doorId, target_level_id: '', target_spawn_id: 'default', trigger_radius: 48 },
        resourceIds,
      }));
    }
  }

  for (const surface of surfacePayloads(room.runtime_layout)) {
    if (surface.id === undefined || existingNodes.some((node) => node.type === 'StaticBody2D' && node.name === surface.id)) {
      continue;
    }
    const surfaceAddition = buildSurfaceNode(surface, additionNodeNames, subResourceIds);
    resourceAdditions.push(...surfaceAddition.resourceLines);
    nodeAdditions.push(...surfaceAddition.nodeLines);
  }

  for (const marker of flattenContent(room.runtime_layout.content ?? {})) {
    if (hasExistingContentMarker(existingNodes, marker)) {
      continue;
    }
    nodeAdditions.push(...buildMarkerNode({
      nodeName: uniqueNodeName(marker.id, additionNodeNames),
      markerType: marker.markerType,
      position: marker.position ?? { x: 0, y: 0 },
      props: marker.props,
      resourceIds,
    }));
  }

  if (resourceAdditions.length > 0) {
    patchedText = insertSubResourcesBeforeFirstNode(patchedText, resourceAdditions);
  }
  if (nodeAdditions.length > 0) {
    patchedText = `${patchedText.trimEnd()}\n\n${nodeAdditions.join('\n')}\n`;
  }
  if (resourceAdditions.length > 0 || nodeAdditions.length > 0) {
    patchedText = ensureExtResources(patchedText, resourceIds);
    patchedText = updateLoadSteps(patchedText);
  }

  return patchedText;
}

function removeOmittedSupportedNodes(sceneText: string, room: AuthoredSceneRoom): string {
  const parsed = parseSceneForPatch(sceneText);
  const removeRootNames = new Set<string>();

  for (const node of parsed.nodes) {
    if (shouldRemoveSupportedNode(node, parsed.nodes, room)) {
      removeRootNames.add(node.name);
    }
  }

  if (removeRootNames.size === 0) {
    return sceneText;
  }

  const removedLines = new Set<number>();
  for (const node of parsed.nodes) {
    if (!removeRootNames.has(node.name) && !isDescendantOfRemovedRoot(node, removeRootNames)) {
      continue;
    }
    for (let line = node.startLine; line < node.endLine; line += 1) {
      removedLines.add(line);
    }
  }

  return parsed.lines.filter((_line, index) => !removedLines.has(index)).join('\n');
}

function shouldRemoveSupportedNode(node: ParsedNode, nodes: ParsedNode[], room: AuthoredSceneRoom): boolean {
  if (node.markerType === 'player_spawn') {
    return room.runtime_layout.spawns?.[stringProp(node.props.spawn_id, 'default')] === undefined;
  }
  if (node.markerType === 'door') {
    return room.runtime_layout.doors?.[stringProp(node.props.door_id, node.name)] === undefined;
  }
  if (node.markerType !== null && node.markerType in contentCollectionByMarkerType) {
    const collectionName = contentCollectionByMarkerType[node.markerType as keyof typeof contentCollectionByMarkerType];
    return !(room.runtime_layout.content?.[collectionName] ?? []).some((marker) =>
      String(marker.id) === node.name || markerIdFromProps(node.markerType, marker) === markerIdFromProps(node.markerType, node.props));
  }
  if (node.type === 'StaticBody2D' && node.parent === '.' && findCollisionShapeResourceId(node.name, nodes) !== null) {
    return !surfacePayloads(room.runtime_layout).some((surface) => surface.id === node.name);
  }
  return false;
}

function isDescendantOfRemovedRoot(node: ParsedNode, rootNames: Set<string>): boolean {
  for (const rootName of rootNames) {
    if (node.parent === rootName || node.parent.startsWith(`${rootName}/`)) {
      return true;
    }
  }
  return false;
}

function parseSceneForPatch(sceneText: string): { lines: string[]; nodes: ParsedNode[] } {
  const extResources = parseExtResources(sceneText);
  const lines = sceneText.split(/\r?\n/);
  return {
    lines,
    nodes: parseNodes(sceneText, extResources),
  };
}

function parseExtResources(sceneText: string): Map<string, string> {
  const resources = new Map<string, string>();
  for (const line of sceneText.split(/\r?\n/)) {
    if (!line.startsWith('[ext_resource ')) {
      continue;
    }
    const attributes = parseHeaderAttributes(line);
    if (typeof attributes.id === 'string' && typeof attributes.path === 'string') {
      resources.set(attributes.id, attributes.path);
    }
  }
  return resources;
}

function parseRectangleShapeSizes(sceneText: string): Map<string, Vector2> {
  const sizes = new Map<string, Vector2>();
  const pattern = /\[sub_resource type="RectangleShape2D" id="([^"]+)"\]([\s\S]*?)(?=\n\[|$)/g;
  for (const match of sceneText.matchAll(pattern)) {
    const size = parseVectorValue(match[2].match(/size = (Vector2\([^)]+\))/)?.[1]);
    if (size !== null) {
      sizes.set(match[1], size);
    }
  }
  return sizes;
}

function parseNodes(sceneText: string, extResources: Map<string, string>): ParsedNode[] {
  const lines = sceneText.split(/\r?\n/);
  const nodes: ParsedNode[] = [];
  let current: { header: Record<string, string>; props: JsonObject; startLine: number } | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith('[node ')) {
      if (current !== null) {
        nodes.push(finalizeNode(current, extResources, index));
      }
      current = {
        header: parseHeaderAttributes(line),
        props: {},
        startLine: index,
      };
      continue;
    }
    if (line.startsWith('[')) {
      if (current !== null) {
        nodes.push(finalizeNode(current, extResources, index));
        current = null;
      }
      continue;
    }
    if (current === null) {
      continue;
    }
    const property = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.+)$/);
    if (property !== null) {
      current.props[property[1]] = parseGodotValue(property[2]);
    }
  }

  if (current !== null) {
    nodes.push(finalizeNode(current, extResources, lines.length));
  }

  return nodes;
}

function finalizeNode(
  current: { header: Record<string, string>; props: JsonObject; startLine: number },
  extResources: Map<string, string>,
  endLine: number,
): ParsedNode {
  const scriptResourceId = resourceIdProp(current.props.script);
  const scriptPath = scriptResourceId === null ? null : extResources.get(scriptResourceId) ?? null;
  return {
    name: current.header.name ?? '<unnamed>',
    type: current.header.type ?? 'Node',
    parent: current.header.parent ?? '.',
    props: current.props,
    scriptPath,
    markerType: markerTypeFromScriptPath(scriptPath),
    startLine: current.startLine,
    endLine,
  };
}

function parseHeaderAttributes(line: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const match of line.matchAll(/([A-Za-z0-9_]+)="([^"]*)"/g)) {
    attributes[match[1]] = match[2];
  }
  return attributes;
}

function parseGodotValue(rawValue: string): unknown {
  const value = rawValue.trim();
  const extResource = value.match(/^ExtResource\("([^"]+)"\)$/);
  if (extResource !== null) {
    return { resource_id: extResource[1] };
  }
  const subResource = value.match(/^SubResource\("([^"]+)"\)$/);
  if (subResource !== null) {
    return { sub_resource_id: subResource[1] };
  }
  const vector = parseVectorValue(value);
  if (vector !== null) {
    return vector;
  }
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  if (/^-?\d+(?:\.\d+)?$/.test(value)) {
    return Number(value);
  }
  return value;
}

function parseVectorValue(value: string | undefined): Vector2 | null {
  const match = value?.match(/^Vector2i?\(([-0-9.]+),\s*([-0-9.]+)\)$/);
  if (match === undefined || match === null) {
    return null;
  }
  return {
    x: Number(match[1]),
    y: Number(match[2]),
  };
}

function markerTypeFromScriptPath(scriptPath: string | null): MarkerType | null {
  if (scriptPath === null) {
    return null;
  }
  if (scriptPath.endsWith('/PlayerSpawn.gd')) return 'player_spawn';
  if (scriptPath.endsWith('/DoorMarker.gd')) return 'door';
  if (scriptPath.endsWith('/EnemySpawnMarker.gd')) return 'enemy_spawn';
  if (scriptPath.endsWith('/HealMarker.gd')) return 'heal';
  if (scriptPath.endsWith('/CollectibleMarker.gd')) return 'collectible';
  if (scriptPath.endsWith('/HazardMarker.gd')) return 'hazard';
  if (scriptPath.endsWith('/AbilityGateMarker.gd')) return 'ability_gate';
  if (scriptPath.endsWith('/GoalMarker.gd') || scriptPath.endsWith('/GoalDoorController.gd')) return 'goal';
  if (scriptPath.endsWith('/CameraBoundsMarker.gd')) return 'camera_bounds';
  return null;
}

function parseRectSurfaces(nodes: ParsedNode[], rectangleSizes: Map<string, Vector2>): RectPayload[] {
  return nodes
    .filter((node) => node.type === 'StaticBody2D' && node.parent === '.')
    .map((node) => {
      const shapeResourceId = findCollisionShapeResourceId(node.name, nodes);
      const size = shapeResourceId === null ? undefined : rectangleSizes.get(shapeResourceId);
      return {
        id: node.name,
        position: vectorProp(node.props.position) ?? { x: 0, y: 0 },
        ...(size !== undefined ? { size } : {}),
      };
    })
    .filter((surface) => surface.size !== undefined);
}

function parseContent(nodes: ParsedNode[]): RuntimeContent {
  const content: RuntimeContent = {};

  for (const node of nodes) {
    if (node.markerType === null || !(node.markerType in contentCollectionByMarkerType)) {
      continue;
    }
    const collectionName = contentCollectionByMarkerType[node.markerType as keyof typeof contentCollectionByMarkerType];
    const marker = propsToMarker(node);
    content[collectionName] = [...(content[collectionName] ?? []), marker];
  }

  return content;
}

function propsToMarker(node: ParsedNode): JsonObject {
  return {
    id: node.name,
    ...Object.fromEntries(Object.entries(node.props)
      .filter(([key]) => key !== 'script' && key !== 'position')
      .map(([key, value]) => [key, serializeParsedValue(value)])),
    position: vectorProp(node.props.position) ?? { x: 0, y: 0 },
  };
}

function serializeParsedValue(value: unknown): unknown {
  if (isVector2(value)) {
    return value;
  }
  if (typeof value === 'object' && value !== null && ('resource_id' in value || 'sub_resource_id' in value)) {
    return undefined;
  }
  return value;
}

function inferRoomBounds(
  layout: { rows: number; columns: number; tile_size: number },
  cameraBounds: { position?: Vector2; size?: Vector2 } | undefined,
  surfaces: RectPayload[],
): JsonObject {
  const tileWidth = layout.columns * layout.tile_size;
  const tileHeight = layout.rows * layout.tile_size;
  const surfaceRight = surfaces.map((surface) => (surface.position?.x ?? 0) + ((surface.size?.x ?? 0) / 2));
  const surfaceBottom = surfaces.map((surface) => (surface.position?.y ?? 0) + ((surface.size?.y ?? 0) / 2));
  return {
    width: Math.max(tileWidth, cameraBounds?.size?.x ?? 0, cameraBounds === undefined ? 0 : (cameraBounds.position?.x ?? 0) + ((cameraBounds.size?.x ?? 0) / 2), ...surfaceRight),
    height: Math.max(tileHeight, cameraBounds?.size?.y ?? 0, cameraBounds === undefined ? 0 : (cameraBounds.position?.y ?? 0) + ((cameraBounds.size?.y ?? 0) / 2), ...surfaceBottom),
    variant: 'authored_scene',
  };
}

function surfacePayloads(layout: RuntimeLayout): RectPayload[] {
  const surfaces = [
    ...(layout.floor !== undefined ? [layout.floor] : []),
    ...(layout.floor_segments ?? []),
    ...(layout.platforms ?? []),
  ];
  const seen = new Set<string>();
  return surfaces.filter((surface) => {
    const key = String(surface.id ?? `${surface.position?.x}:${surface.position?.y}`);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return surface.id !== undefined && surface.position !== undefined && surface.size !== undefined;
  });
}

function flattenContent(content: RuntimeContent): Array<{
  id: string;
  markerType: MarkerType;
  position?: Vector2;
  props: JsonObject;
}> {
  return [
    ...content.enemies ?? [],
    ...content.heals ?? [],
    ...content.collectibles ?? [],
    ...content.hazards ?? [],
    ...content.ability_gates ?? [],
    ...content.goals ?? [],
  ].map((marker) => ({
    id: String(marker.id ?? 'BuilderMarker'),
    markerType: markerTypeFromMarkerPayload(marker),
    position: vectorProp(marker.position),
    props: Object.fromEntries(Object.entries(marker).filter(([key]) => key !== 'id' && key !== 'position')),
  }));
}

function markerTypeFromMarkerPayload(marker: JsonObject): MarkerType {
  if ('enemy_type' in marker || 'spawn_id' in marker) return 'enemy_spawn';
  if ('heal_id' in marker || 'reward_type' in marker) return 'heal';
  if ('collectible_id' in marker || 'item_id' in marker) return 'collectible';
  if ('hazard_id' in marker || 'hazard_type' in marker) return 'hazard';
  if ('gate_id' in marker || 'required_ability_type' in marker) return 'ability_gate';
  return 'goal';
}

function hasExistingContentMarker(
  nodes: ParsedNode[],
  marker: { id: string; markerType: MarkerType; props: JsonObject },
): boolean {
  const semanticId = markerIdFromProps(marker.markerType, marker.props);
  return nodes.some((node) => {
    if (node.name === marker.id) {
      return true;
    }
    if (node.markerType !== marker.markerType || semanticId.length === 0) {
      return false;
    }
    return markerIdFromProps(node.markerType, node.props) === semanticId;
  });
}

function patchNodePosition(lines: string[], nodes: ParsedNode[], node: ParsedNode, position: Vector2 | undefined): void {
  if (position === undefined) {
    return;
  }
  patchNodeProperty(lines, nodes, node, 'position', position);
}

function patchNodeFromMarker(lines: string[], nodes: ParsedNode[], node: ParsedNode, marker: JsonObject | undefined): void {
  if (marker === undefined) {
    return;
  }
  patchNodePosition(lines, nodes, node, vectorProp(marker.position));
  for (const [key, value] of Object.entries(marker)) {
    if (key === 'id' || key === 'position') {
      continue;
    }
    patchNodeProperty(lines, nodes, node, key, value);
  }
}

function patchNodeProperty(lines: string[], nodes: ParsedNode[], node: ParsedNode, key: string, value: unknown): void {
  if (value === undefined) {
    return;
  }
  const formatted = formatGodotValue(value);
  for (let index = node.startLine + 1; index < node.endLine; index += 1) {
    if (lines[index].startsWith(`${key} = `)) {
      lines[index] = `${key} = ${formatted}`;
      return;
    }
  }
  lines.splice(node.endLine, 0, `${key} = ${formatted}`);
  shiftNodeLineRangesAfterInsert(nodes, node.endLine, 1);
}

function shiftNodeLineRangesAfterInsert(nodes: ParsedNode[], insertLine: number, insertedLineCount: number): void {
  for (const node of nodes) {
    if (node.startLine >= insertLine) {
      node.startLine += insertedLineCount;
      node.endLine += insertedLineCount;
      continue;
    }
    if (node.endLine >= insertLine) {
      node.endLine += insertedLineCount;
    }
  }
}

function patchRectangleShapeSize(sceneText: string, resourceId: string, size: Vector2): string {
  const pattern = new RegExp(`(\\[sub_resource type="RectangleShape2D" id="${escapeRegExp(resourceId)}"\\][\\s\\S]*?size = )Vector2\\([^)]+\\)`);
  return sceneText.replace(pattern, `$1${formatVector(size)}`);
}

function buildMarkerNode({
  nodeName,
  markerType,
  position,
  props,
  resourceIds,
}: {
  nodeName: string;
  markerType: MarkerType;
  position: Vector2;
  props: JsonObject;
  resourceIds: Map<string, string>;
}): string[] {
  const resourceId = ensureResourceId(resourceIds, markerScriptPaths[markerType], `${markerType}_script`);
  return [
    `[node name="${nodeName}" type="Node2D" parent="."]`,
    `position = ${formatVector(position)}`,
    `script = ExtResource("${resourceId}")`,
    ...Object.entries(props).map(([key, value]) => `${key} = ${formatGodotValue(value)}`),
    '',
  ];
}

function buildSurfaceNode(surface: RectPayload, existingNodeNames: Set<string>, subResourceIds: Set<string>): { resourceLines: string[]; nodeLines: string[] } {
  const nodeName = uniqueNodeName(String(surface.id), existingNodeNames);
  const shapeId = uniqueSubResourceId(`RectangleShape2D_${nodeName}`, subResourceIds);
  return {
    resourceLines: [
      `[sub_resource type="RectangleShape2D" id="${shapeId}"]`,
      `size = ${formatVector(surface.size ?? { x: 128, y: 24 })}`,
      '',
    ],
    nodeLines: [
      `[node name="${nodeName}" type="StaticBody2D" parent="."]`,
      `position = ${formatVector(surface.position ?? { x: 0, y: 0 })}`,
      '',
      `[node name="CollisionShape2D" type="CollisionShape2D" parent="${nodeName}"]`,
      `shape = SubResource("${shapeId}")`,
      '',
      `[node name="PlatformVisual" type="Polygon2D" parent="${nodeName}"]`,
      'color = Color(0.30, 0.36, 0.42, 1)',
      'polygon = PackedVector2Array(-64, -12, 64, -12, 64, 12, -64, 12)',
      '',
    ],
  };
}

function insertSubResourcesBeforeFirstNode(sceneText: string, resourceLines: string[]): string {
  const lines = sceneText.split(/\r?\n/);
  const firstNodeIndex = lines.findIndex((line) => line.startsWith('[node '));
  const insertIndex = firstNodeIndex === -1 ? lines.length : firstNodeIndex;
  const insertion = [...resourceLines];
  if (insertIndex > 0 && lines[insertIndex - 1] !== '' && insertion[0] !== '') {
    insertion.unshift('');
  }
  lines.splice(insertIndex, 0, ...insertion);
  return lines.join('\n');
}

function ensureExtResources(sceneText: string, resourceIds: Map<string, string>): string {
  const existingPaths = new Set(collectExtResourceIds(sceneText).values());
  const missing = [...resourceIds.entries()].filter(([, path]) => !existingPaths.has(path));
  if (missing.length === 0) {
    return sceneText;
  }

  const lines = sceneText.split(/\r?\n/);
  const insertIndex = Math.max(1, ...lines.map((line, index) => line.startsWith('[ext_resource ') ? index + 1 : 1));
  lines.splice(insertIndex, 0, ...missing.map(([id, path]) => `[ext_resource type="Script" path="${path}" id="${id}"]`));
  return lines.join('\n');
}

function collectExtResourceIds(sceneText: string): Map<string, string> {
  return parseExtResources(sceneText);
}

function collectSubResourceIds(sceneText: string): Set<string> {
  const ids = new Set<string>();
  for (const match of sceneText.matchAll(/\[sub_resource [^\]]*id="([^"]+)"\]/g)) {
    ids.add(match[1]);
  }
  return ids;
}

function ensureResourceId(resourceIds: Map<string, string>, resourcePath: string, idHint: string): string {
  for (const [id, path] of resourceIds.entries()) {
    if (path === resourcePath) {
      return id;
    }
  }
  const id = uniqueResourceId(idHint, new Set(resourceIds.keys()));
  resourceIds.set(id, resourcePath);
  return id;
}

function uniqueResourceId(base: string, existing: Set<string>): string {
  let candidate = base;
  let index = 1;
  while (existing.has(candidate)) {
    index += 1;
    candidate = `${base}_${index}`;
  }
  existing.add(candidate);
  return candidate;
}

function uniqueSubResourceId(base: string, existing: Set<string>): string {
  let candidate = base.replace(/[^A-Za-z0-9_]/g, '_');
  let index = 1;
  while (existing.has(candidate)) {
    index += 1;
    candidate = `${base}_${index}`;
  }
  existing.add(candidate);
  return candidate;
}

function uniqueNodeName(base: string, existing: Set<string>): string {
  let candidate = base.replace(/[^A-Za-z0-9_]/g, '_');
  let index = 1;
  while (existing.has(candidate)) {
    index += 1;
    candidate = `${base}${index}`;
  }
  existing.add(candidate);
  return candidate;
}

function updateLoadSteps(sceneText: string): string {
  const loadStepCount = (sceneText.match(/\[(?:ext_resource|sub_resource) /g) ?? []).length + 1;
  return sceneText.replace(/(\[gd_scene[^\]]*load_steps=)\d+/, `$1${loadStepCount}`);
}

function findCollisionShapeResourceId(surfaceName: string, nodes: ParsedNode[]): string | null {
  const collisionShape = nodes.find((node) =>
    node.type === 'CollisionShape2D'
    && (node.parent === surfaceName || node.parent.endsWith(`/${surfaceName}`) || node.parent.startsWith(`${surfaceName}/`)));
  return collisionShape === undefined ? null : subResourceIdProp(collisionShape.props.shape);
}

function markerIdFromProps(markerType: MarkerType | null, props: JsonObject): string {
  switch (markerType) {
    case 'enemy_spawn':
    case 'player_spawn':
      return stringProp(props.spawn_id, '');
    case 'door':
      return stringProp(props.door_id, '');
    case 'heal':
      return stringProp(props.heal_id, '');
    case 'collectible':
      return stringProp(props.collectible_id, '');
    case 'hazard':
      return stringProp(props.hazard_id, '');
    case 'ability_gate':
      return stringProp(props.gate_id, '');
    case 'goal':
      return stringProp(props.goal_id, '');
    default:
      return '';
  }
}

function resourceIdProp(value: unknown): string | null {
  return typeof value === 'object' && value !== null && 'resource_id' in value ? String(value.resource_id) : null;
}

function subResourceIdProp(value: unknown): string | null {
  return typeof value === 'object' && value !== null && 'sub_resource_id' in value ? String(value.sub_resource_id) : null;
}

function vectorProp(value: unknown): Vector2 | undefined {
  return isVector2(value) ? value : undefined;
}

function numberProp(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function stringProp(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function isVector2(value: unknown): value is Vector2 {
  return typeof value === 'object'
    && value !== null
    && typeof (value as Vector2).x === 'number'
    && typeof (value as Vector2).y === 'number';
}

function formatGodotValue(value: unknown): string {
  if (isVector2(value)) {
    return formatVector(value);
  }
  if (typeof value === 'number') {
    return formatNumber(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

function formatVector(value: Vector2): string {
  return `Vector2(${formatNumber(value.x)}, ${formatNumber(value.y)})`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function humanizeId(id: string): string {
  return id
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function toPascal(value: string): string {
  return value
    .split(/[-_:]/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join('');
}
