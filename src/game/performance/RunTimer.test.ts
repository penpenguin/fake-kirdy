import { describe, expect, it } from 'vitest';
import { RunTimer } from './RunTimer';

describe('RunTimer', () => {
  it('tracks elapsed milliseconds while running', () => {
    let now = 0;
    const timer = new RunTimer(() => now);
    timer.start();
    now = 1500;
    expect(timer.getElapsedMs()).toBe(1500);
    now = 2200;
    expect(timer.getElapsedMs()).toBe(2200);
  });

  it('stops accumulating time when stopped', () => {
    let now = 0;
    const timer = new RunTimer(() => now);
    timer.start();
    now = 500;
    timer.stop();
    now = 1200;
    expect(timer.getElapsedMs()).toBe(500);
  });

  it('resets elapsed time', () => {
    let now = 0;
    const timer = new RunTimer(() => now);
    timer.start();
    now = 800;
    timer.stop();
    timer.reset();
    expect(timer.getElapsedMs()).toBe(0);
  });
});
