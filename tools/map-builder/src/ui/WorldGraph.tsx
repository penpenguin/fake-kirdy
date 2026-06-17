import '@xyflow/react/dist/style.css';
import {
  Background,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  applyEdgeChanges,
  applyNodeChanges,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type ReactFlowInstance,
  type Viewport,
} from '@xyflow/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildWorldGraph, type WorldGraphNodeData } from '../domain/buildWorldGraph';
import { applyNodePosition, applyViewport } from '../domain/applyWorldGraphEdits';
import { layoutWorldGraph } from '../domain/layoutWorldGraph';
import type { BuilderProject, ValidationIssue } from '../domain/project';
import { StageNode } from './StageNode';

type Props = {
  project: BuilderProject;
  validationIssues: ValidationIssue[];
  selectedStageId: string | null;
  onSelectStage: (stageId: string | null) => void;
  onProjectChange: (project: BuilderProject) => void;
};

const nodeTypes = {
  stage: StageNode,
};

export function WorldGraph({
  project,
  validationIssues,
  selectedStageId,
  onSelectStage,
  onProjectChange,
}: Props): JSX.Element {
  const graph = useMemo(() => buildWorldGraph(project, validationIssues), [project, validationIssues]);
  const [nodes, setNodes] = useState<Array<Node<WorldGraphNodeData>>>(graph.nodes);
  const [edges, setEdges] = useState<Edge[]>(graph.edges);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance<Node<WorldGraphNodeData>, Edge> | null>(null);
  const [isLayouting, setIsLayouting] = useState(false);
  const [layoutError, setLayoutError] = useState<string | null>(null);
  const initialLayoutProjectRef = useRef<BuilderProject | null>(null);

  useEffect(() => {
    setNodes(graph.nodes);
    setEdges(graph.edges);
  }, [graph]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((currentNodes) => applyNodeChanges(changes, currentNodes) as Array<Node<WorldGraphNodeData>>);

    for (const change of changes) {
      if (change.type === 'position' && change.position !== undefined) {
        onProjectChange({
          ...project,
          uiState: applyNodePosition(project.uiState, change.id, change.position),
        });
      }
    }
  }, [onProjectChange, project]);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((currentEdges) => applyEdgeChanges(changes, currentEdges));
  }, []);

  const onMoveEnd = useCallback((_event: MouseEvent | TouchEvent | null, viewport: Viewport) => {
    onProjectChange({
      ...project,
      uiState: applyViewport(project.uiState, viewport),
    });
  }, [onProjectChange, project]);

  const applyAutoLayout = useCallback(async (sourceProject: BuilderProject, sourceGraph = graph): Promise<void> => {
    setIsLayouting(true);
    setLayoutError(null);
    try {
      const uiState = await layoutWorldGraph(sourceGraph, sourceProject.uiState);
      onProjectChange({
        ...sourceProject,
        uiState,
      });
      window.requestAnimationFrame(() => {
        void reactFlowInstance?.fitView({ padding: 0.16, duration: 250 });
      });
    } catch (error) {
      setLayoutError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLayouting(false);
    }
  }, [graph, onProjectChange, reactFlowInstance]);

  useEffect(() => {
    if (Object.keys(project.uiState.nodes).length > 0 || initialLayoutProjectRef.current === project) {
      return;
    }

    initialLayoutProjectRef.current = project;
    void applyAutoLayout(project);
  }, [applyAutoLayout, project]);

  return (
    <div className="world-graph" aria-label="World graph editor">
      <ReactFlow
        nodes={nodes.map((node) => ({ ...node, selected: node.id === selectedStageId }))}
        edges={edges}
        nodeTypes={nodeTypes}
        onInit={setReactFlowInstance}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onMoveEnd={onMoveEnd}
        onNodeClick={(_event, node) => onSelectStage(node.id.startsWith('dynamic:') ? null : node.id)}
        onPaneClick={() => onSelectStage(null)}
        defaultViewport={graph.viewport}
        fitView
      >
        <Panel position="top-left" className="world-graph__panel">
          <button type="button" onClick={() => void applyAutoLayout(project)} disabled={isLayouting}>
            {isLayouting ? 'Layouting' : 'Auto layout'}
          </button>
          {layoutError !== null ? <span className="world-graph__error" role="status">{layoutError}</span> : null}
        </Panel>
        <Background gap={24} />
        <MiniMap pannable zoomable />
        <Controls />
      </ReactFlow>
    </div>
  );
}
