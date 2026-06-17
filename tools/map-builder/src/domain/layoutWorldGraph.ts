import type { Edge } from '@xyflow/react';
import ELK, { type ElkExtendedEdge, type ElkNode } from 'elkjs/lib/elk.bundled.js';
import type { WorldGraph, WorldGraphNodeData } from './buildWorldGraph';
import type { MapBuilderUiState, Vector2 } from './project';

export const worldGraphLayoutNodeSize = {
  width: 190,
  height: 112,
} as const;

const elk = new ELK();

const layoutOptions = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.spacing.nodeNode': '56',
  'elk.spacing.componentComponent': '160',
  'elk.layered.spacing.nodeNodeBetweenLayers': '180',
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
  'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
};

export async function layoutWorldGraph(graph: WorldGraph, uiState: MapBuilderUiState): Promise<MapBuilderUiState> {
  const children = [...graph.nodes]
    .sort(compareWorldNodes)
    .map((node): ElkNode => ({
      id: node.id,
      width: worldGraphLayoutNodeSize.width,
      height: worldGraphLayoutNodeSize.height,
    }));
  const nodeIds = new Set(children.map((node) => node.id));
  const edges = graph.edges
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
    .sort(compareEdges)
    .map((edge): ElkExtendedEdge => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    }));
  const layout = await elk.layout({
    id: 'world-graph',
    layoutOptions,
    children,
    edges,
  });

  return {
    ...uiState,
    nodes: normalizeLayoutPositions(layout.children ?? []),
  };
}

function normalizeLayoutPositions(nodes: ElkNode[]): Record<string, Vector2> {
  return Object.fromEntries(
    nodes
      .filter((node) => node.x !== undefined && node.y !== undefined)
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((node) => [node.id, {
        x: Math.round(node.x ?? 0),
        y: Math.round(node.y ?? 0),
      }]),
  );
}

function compareWorldNodes(left: { id: string; data: WorldGraphNodeData }, right: { id: string; data: WorldGraphNodeData }): number {
  return compareNodeData(left.data, right.data) || left.id.localeCompare(right.id);
}

function compareNodeData(left: WorldGraphNodeData, right: WorldGraphNodeData): number {
  return clusterRank(left.cluster) - clusterRank(right.cluster)
    || left.index - right.index
    || left.origin.localeCompare(right.origin)
    || left.stageId.localeCompare(right.stageId);
}

function compareEdges(left: Edge, right: Edge): number {
  return left.source.localeCompare(right.source)
    || String(left.label ?? '').localeCompare(String(right.label ?? ''))
    || left.target.localeCompare(right.target)
    || left.id.localeCompare(right.id);
}

function clusterRank(cluster: string): number {
  const order: Record<string, number> = {
    hub: 0,
    forest: 1,
    ice: 2,
    fire: 3,
    ruins: 4,
    sky: 5,
    void: 6,
  };

  return order[cluster] ?? order.void;
}
