import { markerKinds, nextBuilderMarkerId, type MarkerKind } from '../domain/builderMarkerIds';
import type { RuntimeContent } from '../domain/project';

type Props = {
  content: RuntimeContent;
  onChange: (content: RuntimeContent) => void;
};

export function ObjectPalette({ content, onChange }: Props): JSX.Element {
  const addMarker = (kind: MarkerKind): void => {
    const collection = content[kind] ?? [];
    const id = nextBuilderMarkerId(kind, collection);
    onChange({
      ...content,
      [kind]: [
        ...collection,
        {
          id,
          ...defaultPayload(kind, id),
          position: { x: 380, y: 320 },
        },
      ],
    });
  };

  return (
    <div className="object-palette" aria-label="Object palette">
      {markerKinds.map((kind) => (
        <button key={kind} type="button" onClick={() => addMarker(kind)}>
          Add {kind.replace('_', ' ')}
        </button>
      ))}
    </div>
  );
}

function defaultPayload(kind: MarkerKind, id: string): Record<string, string | number> {
  switch (kind) {
    case 'enemies':
      return {
        spawn_id: `${id}_spawn`,
        enemy_type: 'generated_ground',
        ability_type: 'leaf',
        contact_damage: 1,
        attack_damage: 1,
        attack_radius: 112,
        attack_cooldown_ms: 4000,
        patrol_radius: 64,
      };
    case 'heals':
      return {
        heal_id: `${id}_heal`,
        amount: 1,
        reward_type: 'health',
      };
    case 'collectibles':
      return {
        collectible_id: `${id}_collectible`,
        item_id: 'generated-shard',
        trigger_radius: 48,
      };
    case 'hazards':
      return {
        hazard_id: `${id}_hazard`,
        hazard_type: 'spike',
        damage: 1,
        trigger_radius: 40,
      };
    case 'ability_gates':
      return {
        gate_id: `${id}_gate`,
        required_ability_type: 'leaf',
        gate_effect: 'cut_vines',
        trigger_radius: 96,
      };
    case 'goals':
      return {
        goal_id: `${id}_goal`,
        result_label: 'complete',
        trigger_radius: 48,
      };
  }
}
