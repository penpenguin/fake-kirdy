import { describe, expect, it, vi } from 'vitest';
import { configureProjectileHitbox, resolveForwardSpawnPosition } from './projectilePlacement';

describe('projectilePlacement', () => {
  it('places spawn point beyond body bounds in facing direction', () => {
    const anchor = {
      x: 999,
      y: 999,
      body: {
        bounds: {
          min: { x: 10, y: 20 },
          max: { x: 50, y: 80 },
        },
      },
    };

    const result = resolveForwardSpawnPosition(anchor, 1);

    expect(result.x).toBeGreaterThan(50);
    expect(result.y).toBeLessThan(80);
  });

  it('mirrors spawn direction for left-facing anchors', () => {
    const anchor = {
      body: {
        bounds: {
          min: { x: -40, y: 0 },
          max: { x: -8, y: 60 },
        },
      },
    };

    const right = resolveForwardSpawnPosition(anchor, 1);
    const left = resolveForwardSpawnPosition(anchor, -1);

    expect(left.x).toBeLessThan(anchor.body.bounds.min.x);
    expect(right.x).toBeGreaterThan(anchor.body.bounds.max.x);
    expect(left.y).toBe(right.y);
  });

  describe('configureProjectileHitbox', () => {
    it('aligns hitboxes to the sprite display dimensions when rectangle bodies are supported', () => {
      const sprite = {
        displayWidth: 80,
        displayHeight: 48,
        setRectangle: vi.fn(),
      } as { displayWidth: number; displayHeight: number; setRectangle: ReturnType<typeof vi.fn> };

      configureProjectileHitbox(sprite as any);

      expect(sprite.setRectangle).toHaveBeenCalledWith(80, 48);
    });

    it('falls back to circular bodies when rectangle APIs are unavailable', () => {
      const sprite = {
        displayWidth: 72,
        displayHeight: 60,
        setCircle: vi.fn(),
      } as { displayWidth: number; displayHeight: number; setCircle: ReturnType<typeof vi.fn> };

      configureProjectileHitbox(sprite as any);

      // With diameter matching the sprite's max dimension, the radius should be half of it.
      expect(sprite.setCircle).toHaveBeenCalledWith(36);
    });

    it('uses fallback sizes when sprite metrics are missing', () => {
      const sprite = {
        setRectangle: vi.fn(),
        displayWidth: undefined,
        displayHeight: undefined,
      } as { setRectangle: ReturnType<typeof vi.fn>; displayWidth?: number; displayHeight?: number };

      configureProjectileHitbox(sprite as any);

      expect(sprite.setRectangle).toHaveBeenCalledWith(64, 64);
    });
  });
});
