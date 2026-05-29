export class RunTimer {
  private readonly now: () => number;
  private startTimestamp = 0;
  private accumulated = 0;
  private running = false;

  constructor(nowProvider: () => number = () => Date.now()) {
    this.now = nowProvider;
  }

  start(startTime = this.now()) {
    if (this.running) {
      return;
    }

    this.startTimestamp = startTime;
    this.running = true;
  }

  stop(stopTime = this.now()) {
    if (!this.running) {
      return;
    }

    this.accumulated += Math.max(0, stopTime - this.startTimestamp);
    this.running = false;
    this.startTimestamp = stopTime;
  }

  reset() {
    this.running = false;
    this.accumulated = 0;
    this.startTimestamp = 0;
  }

  getElapsedMs(currentTime = this.now()) {
    if (this.running) {
      return this.accumulated + Math.max(0, currentTime - this.startTimestamp);
    }

    return this.accumulated;
  }
}
