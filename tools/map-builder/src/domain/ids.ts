export function stageIdToGodotId(stageId: string): string {
  return stageId.split('-').join('_');
}

export function isKebabCaseStageId(stageId: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(stageId);
}

export function toPascalLabel(value: string): string {
  return value
    .split('-').join(' ')
    .split('_').join(' ')
    .split(' ')
    .filter((part) => part.length > 0)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}
