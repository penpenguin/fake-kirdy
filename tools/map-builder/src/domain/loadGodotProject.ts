import { z } from 'zod';
import type {
  BuilderProject,
  AuthoredScenesSource,
  LevelCatalogSource,
  MapBuilderUiState,
  ProceduralLevelOverridesSource,
  ProceduralLevels,
  StageManifest,
} from './project';

const vectorSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const uiStateSchema = z.object({
  version: z.literal(1),
  nodes: z.record(z.string(), vectorSchema),
  viewport: z.object({
    x: z.number(),
    y: z.number(),
    zoom: z.number(),
  }),
});

const stageManifestSchema = z.object({
  version: z.literal(1),
  stages: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    layout: z.object({
      rows: z.number(),
      columns: z.number(),
      tile_size: z.number(),
    }),
    neighbors: z.record(z.string(), z.string()).default({}),
    dynamic_neighbors: z.record(z.string(), z.string()).optional(),
    metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
    dead_ends: z.array(z.object({
      id: z.string(),
      column: z.number(),
      row: z.number(),
      reward: z.string(),
    })).optional(),
    collectibles: z.array(z.object({
      id: z.string(),
      itemId: z.string(),
      column: z.number(),
      row: z.number(),
    })).optional(),
    origin: z.string().optional(),
  })),
  canonical_source: z.string().optional(),
});

const catalogSourceSchema = z.object({
  version: z.literal(1),
  levels: z.array(z.object({
    id: z.string(),
    scene_path: z.string(),
    tags: z.array(z.string()).optional(),
    coverage_status: z.string().optional(),
    source_ref: z.string().optional(),
    stage_id: z.string().optional(),
    expected_neighbors: z.array(z.string()).optional(),
    expected_collectibles: z.array(z.string()).optional(),
    expected_dead_end_rewards: z.array(z.string()).optional(),
    expected_metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  })),
});

const proceduralLevelsSchema = z.object({
  version: z.literal(1),
  generated_from: z.string(),
  validation: z.record(z.string(), z.unknown()).optional(),
  levels: z.array(z.object({
    id: z.string(),
    stage_id: z.string(),
    name: z.string(),
    layout: z.object({
      rows: z.number(),
      columns: z.number(),
      tile_size: z.number(),
    }),
    metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
    runtime_layout: z.record(z.string(), z.unknown()),
    stage_neighbors: z.record(z.string(), z.string()),
    neighbors: z.record(z.string(), z.string()),
    scene_strategy: z.string(),
  })),
});

const overridesSchema = z.object({
  version: z.literal(1),
  levels: z.record(z.string(), z.object({
    runtime_layout: z.record(z.string(), z.unknown()).optional(),
  })),
});

const authoredScenesSchema = z.object({
  version: z.literal(1),
  scenes: z.array(z.object({
    id: z.string(),
    stage_id: z.string().optional(),
    name: z.string(),
    scene_path: z.string(),
    source: z.literal('authored_scene'),
    layout: z.object({
      rows: z.number(),
      columns: z.number(),
      tile_size: z.number(),
    }),
    runtime_layout: z.record(z.string(), z.unknown()),
    warnings: z.array(z.string()).optional(),
  })),
});

const projectPayloadSchema = z.object({
  stageManifest: stageManifestSchema,
  catalogSource: catalogSourceSchema,
  proceduralLevels: proceduralLevelsSchema,
  proceduralLevelOverrides: overridesSchema,
  authoredScenes: authoredScenesSchema.optional().default({ version: 1, scenes: [] }),
  uiState: uiStateSchema,
});

export function normalizeBuilderProject(payload: unknown): BuilderProject {
  const parsed = projectPayloadSchema.parse(payload);
  return {
    stageManifest: parsed.stageManifest as StageManifest,
    catalogSource: parsed.catalogSource as LevelCatalogSource,
    proceduralLevels: parsed.proceduralLevels as ProceduralLevels,
    proceduralLevelOverrides: parsed.proceduralLevelOverrides as ProceduralLevelOverridesSource,
    authoredScenes: parsed.authoredScenes as AuthoredScenesSource,
    uiState: parsed.uiState as MapBuilderUiState,
  };
}
