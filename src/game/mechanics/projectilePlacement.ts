const FALLBACK_SIZE = 64;
const HORIZONTAL_RATIO = 0.45;
const VERTICAL_RATIO = 0.14;
const MIN_HORIZONTAL_OFFSET = 24;
const MIN_VERTICAL_OFFSET = 10;

export type ProjectileAnchor = {
  x?: number;
  y?: number;
  displayWidth?: number;
  displayHeight?: number;
  width?: number;
  height?: number;
  body?: unknown;
};

type HitboxSprite = {
  displayWidth?: number;
  displayHeight?: number;
  width?: number;
  height?: number;
  setCircle?: (radius: number, options?: any) => unknown;
  setBody?: (config: any, options?: any) => unknown;
  setRectangle?: (width: number, height: number) => unknown;
};

type Bounds = {
  min: { x: number; y: number };
  max: { x: number; y: number };
};

function isBoundsCandidate(candidate: unknown): candidate is { bounds?: Bounds } {
  if (!candidate || typeof candidate !== 'object') {
    return false;
  }
  const bounds = (candidate as { bounds?: Bounds }).bounds;
  if (!bounds) {
    return false;
  }
  const { min, max } = bounds;
  if (!min || !max) {
    return false;
  }
  return (
    typeof min.x === 'number' &&
    typeof min.y === 'number' &&
    typeof max.x === 'number' &&
    typeof max.y === 'number'
  );
}

function normalizeDimension(value?: number) {
  if (!Number.isFinite(value) || (value ?? 0) <= 0) {
    return FALLBACK_SIZE;
  }
  return value as number;
}

function resolveMetrics(anchor: ProjectileAnchor | undefined, direction: number) {
  const bounds = isBoundsCandidate(anchor?.body) ? anchor?.body?.bounds : undefined;
  const widthSource = bounds ? bounds.max.x - bounds.min.x : anchor?.displayWidth ?? anchor?.width;
  const heightSource = bounds ? bounds.max.y - bounds.min.y : anchor?.displayHeight ?? anchor?.height;
  const width = normalizeDimension(widthSource);
  const height = normalizeDimension(heightSource);
  const baseX = bounds
    ? direction >= 0
      ? bounds.max.x
      : bounds.min.x
    : anchor?.x ?? 0;
  const baseY = bounds ? (bounds.min.y + bounds.max.y) / 2 : anchor?.y ?? 0;
  return { width, height, baseX, baseY };
}

export function resolveForwardSpawnPosition(anchor: ProjectileAnchor | undefined, direction: number) {
  const { width, height, baseX, baseY } = resolveMetrics(anchor, direction);
  const offsetX = Math.max(MIN_HORIZONTAL_OFFSET, Math.round(width * HORIZONTAL_RATIO));
  const offsetY = -Math.max(MIN_VERTICAL_OFFSET, Math.round(height * VERTICAL_RATIO));
  return {
    x: baseX + direction * offsetX,
    y: baseY + offsetY,
  };
}

export function configureProjectileHitbox(sprite: HitboxSprite | undefined) {
  if (!sprite) {
    return;
  }

  const width = normalizeDimension(sprite.displayWidth ?? sprite.width);
  const height = normalizeDimension(sprite.displayHeight ?? sprite.height);

  if (typeof sprite.setRectangle === 'function') {
    sprite.setRectangle(width, height);
    return;
  }

  if (typeof sprite.setBody === 'function') {
    sprite.setBody({ type: 'rectangle', width, height });
    return;
  }

  const diameter = Math.max(width, height);
  const radius = Math.max(4, Math.round(diameter / 2));

  if (typeof sprite.setCircle === 'function') {
    (sprite.setCircle as (radius: number, options?: unknown) => unknown).call(sprite, radius);
  }
}
