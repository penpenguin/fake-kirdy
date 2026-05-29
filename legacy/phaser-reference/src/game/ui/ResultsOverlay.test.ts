import { describe, expect, it, vi } from 'vitest';
import { ResultsOverlay } from './ResultsOverlay';

function createSceneStub() {
  return {
    add: {
      container: vi.fn(() => ({ add: vi.fn(), setVisible: vi.fn(), setAlpha: vi.fn() })),
      rectangle: vi.fn(() => ({ setScrollFactor: vi.fn(), setDepth: vi.fn(), setOrigin: vi.fn() })),
      text: vi.fn(() => ({ setScrollFactor: vi.fn(), setDepth: vi.fn(), setOrigin: vi.fn(), setText: vi.fn() })),
    },
    input: {
      keyboard: {
        on: vi.fn(),
        off: vi.fn(),
      },
    },
    time: {
      delayedCall: vi.fn(() => ({ remove: vi.fn() })),
    },
  } as any;
}

describe('ResultsOverlay', () => {
  it('invokes completion callback with the latest payload', () => {
    const scene = createSceneStub();
    const onComplete = vi.fn();
    const overlay = new ResultsOverlay(scene, { onComplete });

    overlay.show({ score: 1200, timeMs: 3210 });
    overlay.complete();

    expect(onComplete).toHaveBeenCalledWith({ score: 1200, timeMs: 3210 });
  });

  it('only completes once per payload', () => {
    const scene = createSceneStub();
    const onComplete = vi.fn();
    const overlay = new ResultsOverlay(scene, { onComplete });

    overlay.show({ score: 200, timeMs: 1000 });
    overlay.complete();
    overlay.complete();

    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
