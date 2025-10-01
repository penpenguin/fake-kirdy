export interface ObjectPoolConfig<T> {
  create: () => T;
  onAcquire?: (item: T) => void;
  onRelease?: (item: T) => void;
  maxSize?: number;
}

export class ObjectPool<T> {
  private readonly create: () => T;
  private readonly onAcquire?: (item: T) => void;
  private readonly onRelease?: (item: T) => void;
  private readonly maxSize: number;
  private readonly available: T[] = [];

  constructor(config: ObjectPoolConfig<T>) {
    if (typeof config.create !== 'function') {
      throw new Error('ObjectPool requires a create function.');
    }

    this.create = config.create;
    this.onAcquire = config.onAcquire;
    this.onRelease = config.onRelease;
    this.maxSize = Number.isFinite(config.maxSize) && (config.maxSize ?? 0) > 0 ? Math.floor(config.maxSize!) : Infinity;
  }

  acquire(): T {
    const instance = this.available.pop() ?? this.create();
    this.onAcquire?.(instance);
    return instance;
  }

  release(item: T) {
    this.onRelease?.(item);
    if (this.available.length >= this.maxSize) {
      return;
    }
    this.available.push(item);
  }

  size() {
    return this.available.length;
  }

  clear() {
    this.available.length = 0;
  }
}
