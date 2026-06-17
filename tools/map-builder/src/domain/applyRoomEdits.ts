import type {
  EditableRuntimeLayoutKey,
  GeneratedLevel,
  ProceduralLevelOverridesSource,
  RuntimeContent,
  RuntimeLayout,
  RuntimeLayoutOverride,
} from './project';

export function getEffectiveRuntimeLayout(level: GeneratedLevel, overrides: ProceduralLevelOverridesSource): RuntimeLayout {
  const override = overrides.levels[level.stage_id]?.runtime_layout ?? {};
  return {
    ...level.runtime_layout,
    ...override,
  };
}

export function updateRuntimeLayoutSection(
  overrides: ProceduralLevelOverridesSource,
  stageId: string,
  key: EditableRuntimeLayoutKey,
  value: RuntimeLayoutOverride[EditableRuntimeLayoutKey],
): ProceduralLevelOverridesSource {
  const currentLevelOverride = overrides.levels[stageId] ?? {};
  return {
    ...overrides,
    levels: {
      ...overrides.levels,
      [stageId]: {
        ...currentLevelOverride,
        runtime_layout: {
          ...(currentLevelOverride.runtime_layout ?? {}),
          [key]: value,
        },
      },
    },
  };
}

export function updateRuntimeContent(
  overrides: ProceduralLevelOverridesSource,
  level: GeneratedLevel,
  content: RuntimeContent,
): ProceduralLevelOverridesSource {
  const effectiveLayout = getEffectiveRuntimeLayout(level, overrides);
  return updateRuntimeLayoutSection(overrides, level.stage_id, 'content', {
    ...(effectiveLayout.content ?? {}),
    ...content,
  });
}

export function removeRuntimeOverrideSection(
  overrides: ProceduralLevelOverridesSource,
  stageId: string,
  key: EditableRuntimeLayoutKey,
): ProceduralLevelOverridesSource {
  const currentLevelOverride = overrides.levels[stageId];
  if (currentLevelOverride === undefined) {
    return overrides;
  }

  const nextRuntimeLayout = { ...(currentLevelOverride.runtime_layout ?? {}) };
  delete nextRuntimeLayout[key];

  return {
    ...overrides,
    levels: {
      ...overrides.levels,
      [stageId]: {
        ...currentLevelOverride,
        runtime_layout: nextRuntimeLayout,
      },
    },
  };
}
