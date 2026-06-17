import { getEffectiveRuntimeLayout } from './applyRoomEdits';
import type { AuthoredSceneRoom, BuilderProject, GeneratedLevel, RuntimeLayout } from './project';

export type BuilderRoomOption = {
  key: string;
  source: 'generated_schema' | 'authored_scene';
  id: string;
  name: string;
  stageId?: string;
  scenePath?: string;
  cluster: string;
  sortIndex: number;
  layout: RuntimeLayout;
  generatedLevel?: GeneratedLevel;
  authoredScene?: AuthoredSceneRoom;
};

export function buildRoomOptions(project: BuilderProject): BuilderRoomOption[] {
  const stageOrder = new Map(project.stageManifest.stages.map((stage, index) => [stage.id, index]));
  const generatedRooms: BuilderRoomOption[] = project.proceduralLevels.levels.map((level) => ({
    key: `generated:${level.stage_id}`,
    source: 'generated_schema',
    id: level.id,
    name: level.name,
    stageId: level.stage_id,
    cluster: String(level.metadata?.cluster ?? 'void'),
    sortIndex: stageOrder.get(level.stage_id) ?? Number(level.metadata?.index ?? 10000),
    layout: getEffectiveRuntimeLayout(level, project.proceduralLevelOverrides),
    generatedLevel: level,
  }));
  const authoredRooms: BuilderRoomOption[] = project.authoredScenes.scenes.map((scene, index) => ({
    key: `authored:${scene.id}`,
    source: 'authored_scene',
    id: scene.id,
    name: scene.name,
    ...(scene.stage_id !== undefined ? { stageId: scene.stage_id } : {}),
    scenePath: scene.scene_path,
    cluster: String(scene.runtime_layout.visuals?.cluster ?? project.stageManifest.stages.find((stage) => stage.id === scene.stage_id)?.metadata?.cluster ?? 'catalog'),
    sortIndex: scene.stage_id === undefined ? 20000 + index : stageOrder.get(scene.stage_id) ?? 15000 + index,
    layout: scene.runtime_layout,
    authoredScene: scene,
  }));

  return [...generatedRooms, ...authoredRooms]
    .sort((left, right) => left.sortIndex - right.sortIndex || sourceRank(left.source) - sourceRank(right.source) || left.id.localeCompare(right.id));
}

export function updateAuthoredRoomLayout(project: BuilderProject, roomKey: string, layout: RuntimeLayout): BuilderProject {
  const sceneId = roomKey.replace(/^authored:/, '');
  return {
    ...project,
    authoredScenes: {
      ...project.authoredScenes,
      scenes: project.authoredScenes.scenes.map((scene) =>
        scene.id === sceneId
          ? { ...scene, runtime_layout: layout }
          : scene,
      ),
    },
  };
}

function sourceRank(source: BuilderRoomOption['source']): number {
  return source === 'authored_scene' ? 0 : 1;
}
