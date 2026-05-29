export interface PerformanceMetrics {
  frameCount: number;
  durationMs: number;
  averageFps: number;
  averageFrameTimeMs: number;
  timestamp: number;
}

export interface PerformanceMonitorOptions {
  sampleWindowMs?: number;
  lowFpsThreshold?: number;
  lowFpsSampleCount?: number;
  onSample?: (metrics: PerformanceMetrics) => void;
  onLowFps?: (metrics: PerformanceMetrics) => void;
}

const DEFAULT_SAMPLE_WINDOW_MS = 1000;
const DEFAULT_LOW_FPS_THRESHOLD = 30;
const DEFAULT_LOW_FPS_SAMPLE_COUNT = 3;

function now() {
  if (typeof globalThis !== 'undefined' && typeof globalThis.performance?.now === 'function') {
    return globalThis.performance.now();
  }

  return Date.now();
}

export class PerformanceMonitor {
  private readonly sampleWindowMs: number;
  private readonly lowFpsThreshold: number;
  private readonly lowFpsSampleCount: number;
  private readonly onSample?: (metrics: PerformanceMetrics) => void;
  private readonly onLowFps?: (metrics: PerformanceMetrics) => void;
  private accumulatedFrames = 0;
  private accumulatedDurationMs = 0;
  private consecutiveLowFpsSamples = 0;
  private lowFpsNotified = false;
  private latestMetrics?: PerformanceMetrics;

  constructor(options: PerformanceMonitorOptions = {}) {
    this.sampleWindowMs = Math.max(16, Math.floor(options.sampleWindowMs ?? DEFAULT_SAMPLE_WINDOW_MS));
    this.lowFpsThreshold = Math.max(1, Math.floor(options.lowFpsThreshold ?? DEFAULT_LOW_FPS_THRESHOLD));
    this.lowFpsSampleCount = Math.max(1, Math.floor(options.lowFpsSampleCount ?? DEFAULT_LOW_FPS_SAMPLE_COUNT));
    this.onSample = options.onSample;
    this.onLowFps = options.onLowFps;
  }

  update(deltaMs: number | undefined | null) {
    if (!Number.isFinite(deltaMs ?? NaN)) {
      return;
    }

    const normalizedDelta = Math.max(0, Number(deltaMs));
    this.accumulatedFrames += 1;
    this.accumulatedDurationMs += normalizedDelta;

    if (this.accumulatedDurationMs < this.sampleWindowMs) {
      return;
    }

    const metrics = this.createMetrics();
    this.latestMetrics = metrics;
    this.onSample?.(metrics);
    this.evaluateLowFps(metrics);
    this.resetAccumulation();
  }

  getLatestMetrics(): PerformanceMetrics | undefined {
    return this.latestMetrics;
  }

  reset() {
    this.accumulatedFrames = 0;
    this.accumulatedDurationMs = 0;
    this.consecutiveLowFpsSamples = 0;
    this.lowFpsNotified = false;
    this.latestMetrics = undefined;
  }

  private createMetrics(): PerformanceMetrics {
    const durationMs = this.accumulatedDurationMs;
    const frameCount = this.accumulatedFrames;
    const averageFps = durationMs > 0 ? (frameCount * 1000) / durationMs : 0;
    const averageFrameTimeMs = frameCount > 0 ? durationMs / frameCount : durationMs;

    return {
      frameCount,
      durationMs,
      averageFps,
      averageFrameTimeMs,
      timestamp: now(),
    };
  }

  private evaluateLowFps(metrics: PerformanceMetrics) {
    if (metrics.averageFps < this.lowFpsThreshold) {
      this.consecutiveLowFpsSamples += 1;
      if (this.consecutiveLowFpsSamples >= this.lowFpsSampleCount) {
        if (!this.lowFpsNotified) {
          this.onLowFps?.(metrics);
          this.lowFpsNotified = true;
        }
      }
    } else {
      this.consecutiveLowFpsSamples = 0;
      this.lowFpsNotified = false;
    }
  }

  private resetAccumulation() {
    this.accumulatedFrames = 0;
    this.accumulatedDurationMs = 0;
  }
}
