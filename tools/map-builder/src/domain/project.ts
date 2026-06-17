export type JsonObject = Record<string, unknown>;

export type Vector2 = {
  x: number;
  y: number;
};

export type LayoutSpec = {
  rows: number;
  columns: number;
  tile_size: number;
};

export type StageMetadata = {
  cluster?: string;
  difficulty?: number;
  index?: number;
  [key: string]: string | number | boolean | undefined;
};

export type StageDeadEnd = {
  id: string;
  column: number;
  row: number;
  reward: string;
};

export type StageCollectible = {
  id: string;
  itemId: string;
  column: number;
  row: number;
};

export type StageDefinition = {
  id: string;
  name: string;
  layout: LayoutSpec;
  neighbors: Record<string, string>;
  dynamic_neighbors?: Record<string, string>;
  metadata?: StageMetadata;
  dead_ends?: StageDeadEnd[];
  collectibles?: StageCollectible[];
  origin?: 'authored' | 'generated_schema' | string;
};

export type StageManifest = {
  version: 1;
  stages: StageDefinition[];
  canonical_source?: string;
};

export type CatalogLevel = {
  id: string;
  scene_path: string;
  tags?: string[];
  coverage_status?: string;
  source_ref?: string;
  stage_id?: string;
  expected_neighbors?: string[];
  expected_collectibles?: string[];
  expected_dead_end_rewards?: string[];
  expected_metadata?: Record<string, string | number | boolean>;
};

export type LevelCatalogSource = {
  version: 1;
  levels: CatalogLevel[];
};

export type RectPayload = {
  id?: string;
  position?: Vector2;
  size?: Vector2;
};

export type RuntimeContent = {
  objective?: JsonObject;
  enemies?: JsonObject[];
  heals?: JsonObject[];
  collectibles?: JsonObject[];
  hazards?: JsonObject[];
  ability_gates?: JsonObject[];
  goals?: JsonObject[];
};

export type RuntimeLayout = {
  tile_size?: Vector2;
  grid?: { rows?: number; columns?: number };
  room?: JsonObject;
  camera_bounds?: { position?: Vector2; size?: Vector2 };
  spawns?: Record<string, Vector2>;
  doors?: Record<string, Vector2>;
  safety?: JsonObject;
  floor?: RectPayload;
  floor_segments?: RectPayload[];
  platforms?: RectPayload[];
  branch_exit_rules?: JsonObject[];
  content?: RuntimeContent;
  visuals?: JsonObject;
};

export type AuthoredSceneRoom = {
  id: string;
  stage_id?: string;
  name: string;
  scene_path: string;
  source: 'authored_scene';
  layout: LayoutSpec;
  runtime_layout: RuntimeLayout;
  warnings?: string[];
};

export type AuthoredScenesSource = {
  version: 1;
  scenes: AuthoredSceneRoom[];
};

export type GeneratedLevel = {
  id: string;
  stage_id: string;
  name: string;
  layout: LayoutSpec;
  metadata?: StageMetadata;
  runtime_layout: RuntimeLayout;
  stage_neighbors: Record<string, string>;
  neighbors: Record<string, string>;
  scene_strategy: 'generated_schema' | string;
};

export type ProceduralLevels = {
  version: 1;
  generated_from: string;
  validation?: JsonObject;
  levels: GeneratedLevel[];
};

export type RuntimeLayoutOverride = Partial<Pick<RuntimeLayout,
  | 'camera_bounds'
  | 'spawns'
  | 'doors'
  | 'safety'
  | 'floor'
  | 'floor_segments'
  | 'platforms'
  | 'content'
  | 'visuals'
>>;

export type ProceduralLevelOverride = {
  runtime_layout?: RuntimeLayoutOverride;
};

export type ProceduralLevelOverridesSource = {
  version: 1;
  levels: Record<string, ProceduralLevelOverride>;
};

export type MapBuilderUiState = {
  version: 1;
  nodes: Record<string, Vector2>;
  viewport: {
    x: number;
    y: number;
    zoom: number;
  };
};

export type BuilderProject = {
  stageManifest: StageManifest;
  catalogSource: LevelCatalogSource;
  proceduralLevels: ProceduralLevels;
  proceduralLevelOverrides: ProceduralLevelOverridesSource;
  authoredScenes: AuthoredScenesSource;
  uiState: MapBuilderUiState;
};

export type ValidationIssue = {
  severity: 'error' | 'warning';
  path: string;
  message: string;
};

export type SaveCommandResult = {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type SaveResult = {
  ok: boolean;
  commandResults: SaveCommandResult[];
  error?: string;
};

export const editableRuntimeLayoutKeys = [
  'camera_bounds',
  'spawns',
  'doors',
  'safety',
  'floor',
  'floor_segments',
  'platforms',
  'content',
  'visuals',
] as const;

export type EditableRuntimeLayoutKey = typeof editableRuntimeLayoutKeys[number];
