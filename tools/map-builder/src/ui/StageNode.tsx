import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { WorldGraphNodeData } from '../domain/buildWorldGraph';

export function StageNode({ data, selected }: NodeProps): JSX.Element {
  const nodeData = data as WorldGraphNodeData;
  const isDynamic = nodeData.origin === 'dynamic';

  return (
    <div className={`stage-node ${selected ? 'is-selected' : ''} ${isDynamic ? 'is-dynamic' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <div className="stage-node__title">{nodeData.label}</div>
      <div className="stage-node__meta">{nodeData.stageId}</div>
      <div className="stage-node__badges">
        <span>{nodeData.origin === 'generated_schema' ? 'GENERATED' : nodeData.origin === 'dynamic' ? 'DYNAMIC' : 'AUTHORED'}</span>
        {!isDynamic && <span>difficulty {nodeData.difficulty}</span>}
        {!isDynamic && <span>{nodeData.cluster}</span>}
        {nodeData.validationErrorCount > 0 && <span className="stage-node__error">{nodeData.validationErrorCount} errors</span>}
      </div>
      {!isDynamic && (
        <div className="stage-node__stats">
          {nodeData.doorCount} doors / {nodeData.deadEndCount} dead ends / {nodeData.collectibleCount} items
        </div>
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
