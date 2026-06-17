import { useEffect, useMemo, useState } from 'react';
import { loadProject, saveProject } from './api/client';
import { validateBuilderProject } from './domain/validateBuilderProject';
import type { BuilderProject, SaveResult } from './domain/project';
import { GeneratedPreview } from './ui/GeneratedPreview';
import { RoomEditor } from './ui/RoomEditor';
import { StageInspector } from './ui/StageInspector';
import { ValidationPanel } from './ui/ValidationPanel';
import { WorldGraph } from './ui/WorldGraph';

type ActiveView = 'world' | 'room';

export default function App(): JSX.Element {
  const [project, setProject] = useState<BuilderProject | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>('world');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<SaveResult | null>(null);

  useEffect(() => {
    loadProject()
      .then(setProject)
      .catch((error: unknown) => setLoadError(error instanceof Error ? error.message : String(error)));
  }, []);

  const validationIssues = useMemo(() => project === null ? [] : validateBuilderProject(project), [project]);

  if (loadError !== null) {
    return (
      <main className="app-shell">
        <section className="load-state">
          <h1>Map Builder</h1>
          <p className="error-text">{loadError}</p>
        </section>
      </main>
    );
  }

  if (project === null) {
    return (
      <main className="app-shell">
        <section className="load-state">
          <h1>Map Builder</h1>
          <p>Loading Godot project data.</p>
        </section>
      </main>
    );
  }

  const onSave = async (): Promise<void> => {
    setIsSaving(true);
    setSaveResult(null);
    try {
      setSaveResult(await saveProject(project, true));
    } catch (error) {
      setSaveResult({
        ok: false,
        commandResults: [],
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="app-shell">
      <header className="app-toolbar">
        <div>
          <h1>Fake Kirdy Map Builder</h1>
          <p>Godot source data editor</p>
        </div>
        <div className="toolbar-actions">
          <div className="segmented-control" aria-label="Editor view">
            <button type="button" className={activeView === 'world' ? 'is-active' : ''} onClick={() => setActiveView('world')}>World</button>
            <button type="button" className={activeView === 'room' ? 'is-active' : ''} onClick={() => setActiveView('room')}>Room</button>
          </div>
          <button type="button" className="primary-action" onClick={() => void onSave()} disabled={isSaving}>
            {isSaving ? 'Saving' : 'Save'}
          </button>
        </div>
      </header>

      <div className="workspace">
        <section className="main-pane">
          {activeView === 'world' ? (
            <WorldGraph
              project={project}
              validationIssues={validationIssues}
              selectedStageId={selectedStageId}
              onSelectStage={setSelectedStageId}
              onProjectChange={setProject}
            />
          ) : (
            <RoomEditor project={project} onProjectChange={setProject} />
          )}
        </section>
        {activeView === 'world' ? (
          <StageInspector
            project={project}
            selectedStageId={selectedStageId}
            validationIssues={validationIssues}
            onProjectChange={setProject}
          />
        ) : null}
      </div>
      <footer className="bottom-pane">
        <ValidationPanel issues={validationIssues} saveResult={saveResult} />
        <GeneratedPreview value={{
          stage_manifest: project.stageManifest,
          procedural_level_overrides: project.proceduralLevelOverrides,
          authored_scenes: project.authoredScenes,
          map_builder_ui: project.uiState,
        }}
        />
      </footer>
    </main>
  );
}
