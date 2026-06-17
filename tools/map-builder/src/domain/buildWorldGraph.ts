import type { Edge, Node, Viewport } from '@xyflow/react';
import { stageIdToGodotId } from './ids';
import type { BuilderProject, CatalogLevel, GeneratedLevel, StageDefinition, ValidationIssue } from './project';

export type WorldGraphNodeData = {
  label: string;
  stageId: string;
  godotId: string;
  origin: string;
  cluster: string;
  difficulty: number;
  index: number;
  rows: number;
  columns: number;
  tileSize: number;
  deadEndCount: number;
  collectibleCount: number;
  doorCount: number;
  catalogLevel?: CatalogLevel;
  generatedLevel?: GeneratedLevel;
  validationErrorCount: number;
  dynamicExpression?: string;
};

export type WorldGraph = {
  nodes: Array<Node<WorldGraphNodeData>>;
  edges: Edge[];
  viewport: Viewport;
};

const clusterColors: Record<string, { background: string; border: string }> = {
  hub: { background: '#e8eef6', border: '#5b6f91' },
  forest: { background: '#e7f4e8', border: '#3b7a46' },
  ice: { background: '#e4f3fb', border: '#397d9b' },
  fire: { background: '#fae8e1', border: '#a5533f' },
  ruins: { background: '#ebe8df', border: '#6f6a5d' },
  sky: { background: '#eceafb', border: '#615a9c' },
  void: { background: '#e7e8ed', border: '#474b59' },
};

export function buildWorldGraph(project: BuilderProject, validationIssues: ValidationIssue[] = []): WorldGraph {
  const catalogByStageId = new Map<string, CatalogLevel>();
  for (const level of project.catalogSource.levels) {
    if (level.stage_id !== undefined) {
      catalogByStageId.set(level.stage_id, level);
    }
  }

  const generatedByStageId = new Map(project.proceduralLevels.levels.map((level) => [level.stage_id, level]));
  const stagesById = new Map(project.stageManifest.stages.map((stage) => [stage.id, stage]));
  const nodes: Array<Node<WorldGraphNodeData>> = project.stageManifest.stages.map((stage, index) => {
    const metadata = stage.metadata ?? {};
    const stageIssues = validationIssues.filter((issue) => issue.severity === 'error' && issue.path.includes(stage.id));
    const fallbackPosition = defaultStagePosition(stage, index);
    const savedPosition = project.uiState.nodes[stage.id] ?? fallbackPosition;
    const cluster = String(metadata.cluster ?? 'void');
    const colors = clusterColors[cluster] ?? clusterColors.void;

    return {
      id: stage.id,
      type: 'stage',
      position: savedPosition,
      data: {
        label: stage.name,
        stageId: stage.id,
        godotId: stageIdToGodotId(stage.id),
        origin: stage.origin ?? 'authored',
        cluster,
        difficulty: Number(metadata.difficulty ?? 1),
        index: Number(metadata.index ?? index),
        rows: stage.layout.rows,
        columns: stage.layout.columns,
        tileSize: stage.layout.tile_size,
        deadEndCount: stage.dead_ends?.length ?? 0,
        collectibleCount: stage.collectibles?.length ?? 0,
        doorCount: Object.keys(stage.neighbors ?? {}).length,
        catalogLevel: catalogByStageId.get(stage.id),
        generatedLevel: generatedByStageId.get(stage.id),
        validationErrorCount: stageIssues.length,
      },
      style: {
        background: colors.background,
        borderColor: colors.border,
      },
    };
  });

  for (const stage of project.stageManifest.stages) {
    for (const [direction, expression] of Object.entries(stage.dynamic_neighbors ?? {})) {
      const id = `dynamic:${stage.id}:${direction}`;
      const position = project.uiState.nodes[id] ?? {
        x: (project.uiState.nodes[stage.id]?.x ?? defaultStagePosition(stage, 0).x) + 220,
        y: (project.uiState.nodes[stage.id]?.y ?? defaultStagePosition(stage, 0).y) + 72,
      };
      nodes.push({
        id,
        type: 'stage',
        position,
        data: {
          label: expression,
          stageId: id,
          godotId: expression,
          origin: 'dynamic',
          cluster: 'void',
          difficulty: 0,
          index: 0,
          rows: 0,
          columns: 0,
          tileSize: 0,
          deadEndCount: 0,
          collectibleCount: 0,
          doorCount: 0,
          validationErrorCount: 0,
          dynamicExpression: expression,
        },
        draggable: false,
        selectable: false,
      });
    }
  }

  const edges: Edge[] = [];
  for (const stage of project.stageManifest.stages) {
    for (const [direction, targetStageId] of Object.entries(stage.neighbors ?? {})) {
      if (!stagesById.has(targetStageId)) {
        continue;
      }
      edges.push({
        id: `${stage.id}:${direction}:${targetStageId}`,
        source: stage.id,
        target: targetStageId,
        label: direction,
        animated: false,
      });
    }

    for (const [direction] of Object.entries(stage.dynamic_neighbors ?? {})) {
      edges.push({
        id: `${stage.id}:dynamic:${direction}`,
        source: stage.id,
        target: `dynamic:${stage.id}:${direction}`,
        label: direction,
        animated: true,
        style: { strokeDasharray: '6 4' },
      });
    }
  }

  return {
    nodes,
    edges,
    viewport: project.uiState.viewport,
  };
}

function defaultStagePosition(stage: StageDefinition, index: number): { x: number; y: number } {
  const clusterOrder: Record<string, number> = {
    hub: 0,
    forest: 1,
    ice: 2,
    fire: 3,
    ruins: 4,
    sky: 5,
    void: 6,
  };
  const metadata = stage.metadata ?? {};
  const cluster = String(metadata.cluster ?? 'void');
  const column = clusterOrder[cluster] ?? 6;
  const localIndex = Number(metadata.index ?? index);

  return {
    x: (column * 260) - 520,
    y: (localIndex % 24) * 92,
  };
}
