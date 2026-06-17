import type { MapBuilderUiState, StageDefinition, StageManifest, Vector2 } from './project';

export type StagePatch = {
  name?: string;
  cluster?: string;
  difficulty?: number;
  index?: number;
  layout?: Partial<StageDefinition['layout']>;
  neighbors?: Record<string, string>;
  dead_ends?: StageDefinition['dead_ends'];
  collectibles?: StageDefinition['collectibles'];
};

export function applyStagePatch(manifest: StageManifest, stageId: string, patch: StagePatch): StageManifest {
  return {
    ...manifest,
    stages: manifest.stages.map((stage) => {
      if (stage.id !== stageId) {
        return stage;
      }

      return {
        ...stage,
        name: patch.name ?? stage.name,
        layout: {
          ...stage.layout,
          ...(patch.layout ?? {}),
        },
        metadata: {
          ...(stage.metadata ?? {}),
          ...(patch.cluster !== undefined ? { cluster: patch.cluster } : {}),
          ...(patch.difficulty !== undefined ? { difficulty: patch.difficulty } : {}),
          ...(patch.index !== undefined ? { index: patch.index } : {}),
        },
        ...(patch.neighbors !== undefined ? { neighbors: sortRecord(patch.neighbors) } : {}),
        ...(patch.dead_ends !== undefined ? { dead_ends: patch.dead_ends } : {}),
        ...(patch.collectibles !== undefined ? { collectibles: patch.collectibles } : {}),
      };
    }),
  };
}

export function upsertNeighbor(manifest: StageManifest, stageId: string, direction: string, targetStageId: string): StageManifest {
  const stage = manifest.stages.find((candidate) => candidate.id === stageId);
  return applyStagePatch(manifest, stageId, {
    neighbors: sortRecord({
      ...(stage?.neighbors ?? {}),
      [direction]: targetStageId,
    }),
  });
}

export function removeNeighbor(manifest: StageManifest, stageId: string, direction: string): StageManifest {
  const stage = manifest.stages.find((candidate) => candidate.id === stageId);
  const nextNeighbors = { ...(stage?.neighbors ?? {}) };
  delete nextNeighbors[direction];
  return applyStagePatch(manifest, stageId, { neighbors: sortRecord(nextNeighbors) });
}

export function applyNodePosition(uiState: MapBuilderUiState, nodeId: string, position: Vector2): MapBuilderUiState {
  return {
    ...uiState,
    nodes: {
      ...uiState.nodes,
      [nodeId]: position,
    },
  };
}

export function applyViewport(uiState: MapBuilderUiState, viewport: MapBuilderUiState['viewport']): MapBuilderUiState {
  return {
    ...uiState,
    viewport,
  };
}

function sortRecord(values: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(values).sort(([left], [right]) => left.localeCompare(right)));
}
