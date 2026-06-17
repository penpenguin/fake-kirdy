import { useMemo, useState } from 'react';
import { applyStagePatch, removeNeighbor, upsertNeighbor } from '../domain/applyWorldGraphEdits';
import { stageIdToGodotId } from '../domain/ids';
import type { BuilderProject, StageDefinition, ValidationIssue } from '../domain/project';

type Props = {
  project: BuilderProject;
  selectedStageId: string | null;
  validationIssues: ValidationIssue[];
  onProjectChange: (project: BuilderProject) => void;
};

export function StageInspector({
  project,
  selectedStageId,
  validationIssues,
  onProjectChange,
}: Props): JSX.Element {
  const [newNeighborDirection, setNewNeighborDirection] = useState('east');
  const [newNeighborTarget, setNewNeighborTarget] = useState('');
  const stage = project.stageManifest.stages.find((candidate) => candidate.id === selectedStageId) ?? null;
  const stageIds = useMemo(() => project.stageManifest.stages.map((candidate) => candidate.id), [project.stageManifest.stages]);
  const issues = validationIssues.filter((issue) => stage !== null && issue.path.includes(stage.id));

  if (stage === null) {
    return (
      <aside className="inspector">
        <h2>Inspector</h2>
        <p className="muted">Select a stage node to edit topology and metadata.</p>
      </aside>
    );
  }

  const updateStage = (patch: Parameters<typeof applyStagePatch>[2]): void => {
    onProjectChange({
      ...project,
      stageManifest: applyStagePatch(project.stageManifest, stage.id, patch),
    });
  };

  return (
    <aside className="inspector">
      <h2>{stage.name}</h2>
      <dl className="detail-list">
        <dt>ID</dt>
        <dd>{stage.id}</dd>
        <dt>Godot ID</dt>
        <dd>{stageIdToGodotId(stage.id)}</dd>
        <dt>Origin</dt>
        <dd>{stage.origin ?? 'authored'}</dd>
      </dl>

      <label>
        Name
        <input value={stage.name} onChange={(event) => updateStage({ name: event.target.value })} />
      </label>
      <label>
        Cluster
        <select
          value={String(stage.metadata?.cluster ?? 'void')}
          onChange={(event) => updateStage({ cluster: event.target.value })}
        >
          {['hub', 'forest', 'ice', 'fire', 'ruins', 'sky', 'void'].map((cluster) => (
            <option key={cluster} value={cluster}>{cluster}</option>
          ))}
        </select>
      </label>
      <div className="field-row">
        <label>
          Difficulty
          <input
            type="number"
            min={1}
            max={5}
            value={Number(stage.metadata?.difficulty ?? 1)}
            onChange={(event) => updateStage({ difficulty: event.target.valueAsNumber })}
          />
        </label>
        <label>
          Index
          <input
            type="number"
            value={Number(stage.metadata?.index ?? 0)}
            onChange={(event) => updateStage({ index: event.target.valueAsNumber })}
          />
        </label>
      </div>
      <div className="field-row">
        <label>
          Rows
          <input
            type="number"
            min={1}
            value={stage.layout.rows}
            onChange={(event) => updateStage({ layout: { rows: event.target.valueAsNumber } })}
          />
        </label>
        <label>
          Columns
          <input
            type="number"
            min={1}
            value={stage.layout.columns}
            onChange={(event) => updateStage({ layout: { columns: event.target.valueAsNumber } })}
          />
        </label>
        <label>
          Tile
          <input
            type="number"
            min={8}
            value={stage.layout.tile_size}
            onChange={(event) => updateStage({ layout: { tile_size: event.target.valueAsNumber } })}
          />
        </label>
      </div>

      <section className="inspector-section">
        <h3>Neighbors</h3>
        <NeighborList
          stage={stage}
          onRemove={(direction) => {
            onProjectChange({
              ...project,
              stageManifest: removeNeighbor(project.stageManifest, stage.id, direction),
            });
          }}
        />
        <div className="field-row">
          <input value={newNeighborDirection} onChange={(event) => setNewNeighborDirection(event.target.value)} aria-label="New neighbor direction" />
          <select value={newNeighborTarget} onChange={(event) => setNewNeighborTarget(event.target.value)} aria-label="New neighbor target">
            <option value="">Target stage</option>
            {stageIds.filter((stageId) => stageId !== stage.id).map((stageId) => (
              <option key={stageId} value={stageId}>{stageId}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              if (newNeighborTarget.length === 0 || newNeighborDirection.length === 0) {
                return;
              }
              onProjectChange({
                ...project,
                stageManifest: upsertNeighbor(project.stageManifest, stage.id, newNeighborDirection, newNeighborTarget),
              });
            }}
          >
            Add
          </button>
        </div>
      </section>

      <StageArrayEditor
        title="Dead Ends"
        values={stage.dead_ends ?? []}
        createValue={() => ({ id: `dead-end-${stage.dead_ends?.length ?? 0}`, column: 1, row: 1, reward: 'health' })}
        onChange={(deadEnds) => updateStage({ dead_ends: deadEnds })}
      />
      <StageArrayEditor
        title="Collectibles"
        values={stage.collectibles ?? []}
        createValue={() => ({ id: `collectible-${stage.collectibles?.length ?? 0}`, itemId: 'health', column: 1, row: 1 })}
        onChange={(collectibles) => updateStage({ collectibles })}
      />

      {issues.length > 0 && (
        <section className="inspector-section">
          <h3>Warnings</h3>
          <ul className="issue-list">
            {issues.map((issue) => (
              <li key={`${issue.path}:${issue.message}`}>{issue.message}</li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}

function NeighborList({ stage, onRemove }: {
  stage: StageDefinition;
  onRemove: (direction: string) => void;
}): JSX.Element {
  const entries = Object.entries(stage.neighbors ?? {});
  if (entries.length === 0) {
    return <p className="muted">No static neighbors.</p>;
  }

  return (
    <ul className="compact-list">
      {entries.map(([direction, target]) => (
        <li key={direction}>
          <span>{direction} {'->'} {target}</span>
          <button type="button" onClick={() => onRemove(direction)}>Remove</button>
        </li>
      ))}
    </ul>
  );
}

function StageArrayEditor<T extends Record<string, string | number>>({
  title,
  values,
  createValue,
  onChange,
}: {
  title: string;
  values: T[];
  createValue: () => T;
  onChange: (values: T[]) => void;
}): JSX.Element {
  const keys = values[0] === undefined ? Object.keys(createValue()) : Object.keys(values[0]);

  return (
    <section className="inspector-section">
      <div className="section-heading">
        <h3>{title}</h3>
        <button type="button" onClick={() => onChange([...values, createValue()])}>Add</button>
      </div>
      {values.length === 0 ? <p className="muted">None.</p> : values.map((value, index) => (
        <div className="array-editor" key={`${title}-${index}`}>
          {keys.map((key) => (
            <label key={key}>
              {key}
              <input
                value={String(value[key] ?? '')}
                type={typeof value[key] === 'number' ? 'number' : 'text'}
                onChange={(event) => {
                  const nextValues = [...values];
                  nextValues[index] = {
                    ...value,
                    [key]: typeof value[key] === 'number' ? event.target.valueAsNumber : event.target.value,
                  };
                  onChange(nextValues);
                }}
              />
            </label>
          ))}
          <button type="button" onClick={() => onChange(values.filter((_, valueIndex) => valueIndex !== index))}>Remove</button>
        </div>
      ))}
    </section>
  );
}
