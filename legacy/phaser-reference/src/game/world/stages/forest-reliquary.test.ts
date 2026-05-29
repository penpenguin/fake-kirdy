import { describe, expect, it } from 'vitest';
import { forestReliquary } from './forest-reliquary';

type TileCoord = { column: number; row: number };

const walkableSymbols = new Set(['.', 'D']);

function toTile(position: { x: number; y: number }, tileSize: number): TileCoord {
  return {
    column: Math.floor(position.x / tileSize),
    row: Math.floor(position.y / tileSize),
  };
}

function isWalkable(column: number, row: number): boolean {
  const symbol = forestReliquary.layout[row]?.[column];
  return walkableSymbols.has(symbol);
}

function hasPath(start: TileCoord, goal: TileCoord): boolean {
  const queue: TileCoord[] = [start];
  const visited = new Set([`${start.column},${start.row}`]);
  const deltas: TileCoord[] = [
    { column: 1, row: 0 },
    { column: -1, row: 0 },
    { column: 0, row: 1 },
    { column: 0, row: -1 },
  ];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    if (current.column === goal.column && current.row === goal.row) {
      return true;
    }

    deltas.forEach((delta) => {
      const next = { column: current.column + delta.column, row: current.row + delta.row } as TileCoord;
      const key = `${next.column},${next.row}`;
      if (visited.has(key)) {
        return;
      }

      if (!isWalkable(next.column, next.row)) {
        return;
      }

      visited.add(key);
      queue.push(next);
    });
  }

  return false;
}

describe('forestReliquary layout', () => {
  it('allows reaching the forest keystone from the west entry', () => {
    const westEntry = forestReliquary.entryPoints.west;
    expect(westEntry).toBeDefined();

    const collectible = forestReliquary.collectibles?.find((item) => item.itemId === 'forest-keystone');
    expect(collectible).toBeDefined();

    if (!westEntry || !collectible) {
      throw new Error('Forest reliquary is missing required data');
    }

    const tileSize = forestReliquary.tileSize;
    const start = toTile(westEntry.position, tileSize);
    const goal = toTile(collectible.position, tileSize);

    expect(isWalkable(start.column, start.row)).toBe(true);
    expect(isWalkable(goal.column, goal.row)).toBe(true);
    expect(hasPath(start, goal)).toBe(true);
  });
});
