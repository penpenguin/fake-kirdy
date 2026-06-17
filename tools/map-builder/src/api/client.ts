import { normalizeBuilderProject } from '../domain/loadGodotProject';
import type { BuilderProject, SaveResult } from '../domain/project';

export async function loadProject(): Promise<BuilderProject> {
  const response = await fetch('/api/map-builder/project');
  const payload = await response.json() as unknown;

  if (!response.ok) {
    throw new Error(readError(payload, 'Failed to load Godot project data.'));
  }

  return normalizeBuilderProject(payload);
}

export async function saveProject(project: BuilderProject, runChecks = true): Promise<SaveResult> {
  const response = await fetch('/api/map-builder/save', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      stageManifest: project.stageManifest,
      proceduralLevelOverrides: project.proceduralLevelOverrides,
      authoredScenes: project.authoredScenes,
      uiState: project.uiState,
      runChecks,
    }),
  });
  const payload = await response.json() as SaveResult;

  if (!response.ok && payload.commandResults === undefined) {
    throw new Error(readError(payload, 'Failed to save Godot project data.'));
  }

  return payload;
}

function readError(payload: unknown, fallback: string): string {
  if (typeof payload === 'object' && payload !== null && 'error' in payload) {
    return String(payload.error);
  }

  return fallback;
}
