import { describe, expect, it, vi } from 'vitest';
import { PerformanceMonitor } from './PerformanceMonitor';

describe('PerformanceMonitor', () => {
  it('集計ウィンドウごとにFPSと平均フレーム時間を算出する', () => {
    const onSample = vi.fn();
    const monitor = new PerformanceMonitor({
      sampleWindowMs: 100,
      onSample,
    });

    monitor.update(50);
    expect(onSample).not.toHaveBeenCalled();

    monitor.update(50);
    expect(onSample).toHaveBeenCalledTimes(1);

    const metrics = onSample.mock.calls[0][0];
    expect(metrics.frameCount).toBe(2);
    expect(metrics.durationMs).toBe(100);
    expect(metrics.averageFps).toBeCloseTo(20, 5);
    expect(metrics.averageFrameTimeMs).toBeCloseTo(50, 5);
    expect(monitor.getLatestMetrics()).toEqual(metrics);
  });

  it('低FPSが所定回数続いたときにコールバックを発火する', () => {
    const onLowFps = vi.fn();
    const monitor = new PerformanceMonitor({
      sampleWindowMs: 100,
      lowFpsThreshold: 30,
      lowFpsSampleCount: 2,
      onLowFps,
    });

    // 高FPSサンプルでカウンターがリセットされることを確認
    for (let i = 0; i < 10; i += 1) {
      monitor.update(10);
    }
    expect(onLowFps).not.toHaveBeenCalled();

    // 低FPSサンプル1回目
    monitor.update(100);
    expect(onLowFps).not.toHaveBeenCalled();

    // 低FPSサンプル2回目で通知
    monitor.update(100);
    expect(onLowFps).toHaveBeenCalledTimes(1);
    const lowFpsMetrics = onLowFps.mock.calls[0][0];
    expect(lowFpsMetrics.averageFps).toBeLessThan(30);
  });

  it('高FPSサンプルで低FPS連続カウンターをリセットする', () => {
    const onLowFps = vi.fn();
    const monitor = new PerformanceMonitor({
      sampleWindowMs: 100,
      lowFpsThreshold: 30,
      lowFpsSampleCount: 2,
      onLowFps,
    });

    monitor.update(100);
    expect(onLowFps).not.toHaveBeenCalled();

    // ここで高FPSサンプルを挟むことでカウンターがリセットされる想定
    for (let i = 0; i < 10; i += 1) {
      monitor.update(10);
    }

    monitor.update(100);
    expect(onLowFps).not.toHaveBeenCalled();
  });
});
