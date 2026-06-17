import type { RuntimeContent } from './project';

export const markerKinds = ['enemies', 'heals', 'collectibles', 'hazards', 'ability_gates', 'goals'] as const;

export type MarkerKind = typeof markerKinds[number];

export function nextBuilderMarkerId(kind: MarkerKind, collection: RuntimeContent[MarkerKind] = []): string {
  const prefix = `Builder${toPascal(kind)}`;
  const nextIndex = collection.reduce((highest, marker) => {
    const id = String(marker.id ?? '');
    const match = id.match(new RegExp(`^${prefix}(\\d+)$`));
    return match === null ? highest : Math.max(highest, Number(match[1]));
  }, 0) + 1;
  return `${prefix}${nextIndex}`;
}

function toPascal(value: string): string {
  return value
    .split('_')
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join('');
}
