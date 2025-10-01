import { describe, expect, it, vi } from 'vitest';
import { ObjectPool } from './ObjectPool';

describe('ObjectPool', () => {
  it('空のプールから取得するとファクトリーで生成する', () => {
    const factory = vi.fn(() => ({ id: Symbol('item') }));
    const pool = new ObjectPool({ create: factory });

    const instance = pool.acquire();

    expect(instance).toBeDefined();
    expect(factory).toHaveBeenCalledTimes(1);
    expect(pool.size()).toBe(0);
  });

  it('解放したインスタンスを再利用する', () => {
    const factory = vi.fn(() => ({ id: Symbol('item') }));
    const onAcquire = vi.fn();
    const onRelease = vi.fn();
    const pool = new ObjectPool({ create: factory, onAcquire, onRelease });

    const first = pool.acquire();
    pool.release(first);

    expect(onRelease).toHaveBeenCalledWith(first);
    expect(pool.size()).toBe(1);

    const second = pool.acquire();

    expect(second).toBe(first);
    expect(onAcquire).toHaveBeenCalledWith(first);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(pool.size()).toBe(0);
  });

  it('最大サイズを超える解放は破棄する', () => {
    const factory = vi.fn(() => ({ id: Symbol('item') }));
    const pool = new ObjectPool({ create: factory, maxSize: 1 });

    const first = pool.acquire();
    const second = pool.acquire();
    pool.release(first);
    pool.release(second);

    expect(pool.size()).toBe(1);
  });
});
