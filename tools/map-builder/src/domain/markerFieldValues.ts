export type MarkerFieldInputType = 'checkbox' | 'number' | 'text';

export function getMarkerFieldInputType(value: unknown): MarkerFieldInputType {
  if (typeof value === 'boolean') {
    return 'checkbox';
  }
  if (typeof value === 'number') {
    return 'number';
  }
  return 'text';
}

export function parseMarkerFieldInputValue(
  previousValue: unknown,
  textValue: string,
  numberValue: number,
  checkedValue: boolean,
): unknown {
  if (typeof previousValue === 'boolean') {
    return checkedValue;
  }
  if (typeof previousValue === 'number') {
    return numberValue;
  }
  return textValue;
}
