import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { PlayerInputManager, type PlayerInputSnapshot } from './PlayerInputManager';

type KeyMock = {
  isDown: boolean;
};

type KeyboardStub = {
  addKey: (code: string) => KeyMock;
};

type ImageStub = {
  setInteractive: () => ImageStub;
  on: (event: string, handler: (pointer?: unknown) => void) => ImageStub;
  off: (event: string, handler: (pointer?: unknown) => void) => ImageStub;
  setScrollFactor: (x: number, y?: number) => ImageStub;
  setAlpha: (value: number) => ImageStub;
  destroy: () => void;
};

type ContainerStub = {
  add: (...children: ImageStub[]) => void;
  setScrollFactor: (x: number, y?: number) => ContainerStub;
  setDepth: (value: number) => ContainerStub;
  destroy: () => void;
};

interface SceneStub {
  input: { keyboard: KeyboardStub };
  add: {
    image: (x: number, y: number, texture: string, frame?: string) => ImageStub;
    container: (x: number, y: number) => ContainerStub;
  };
  textures?: {
    exists: (key: string) => boolean;
  };
}

type SceneFactoryResult = {
  scene: SceneStub;
  keyStore: Record<string, KeyMock>;
  recordedButtons: Array<{
    control?: string;
    events: Record<string, Array<(pointer?: unknown) => void>>;
    setAlpha: ReturnType<typeof vi.fn>;
    offCalls: Array<{ event: string; handler: (pointer?: unknown) => void }>;
    destroy: ReturnType<typeof vi.fn>;
  }>;
  container?: ContainerStub & {
    add: ReturnType<typeof vi.fn>;
    setScrollFactor: ReturnType<typeof vi.fn>;
    setDepth: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  };
};

function createSceneStub(): SceneFactoryResult {
  const keyStore: Record<string, KeyMock> = {};

  const keyboard: KeyboardStub = {
    addKey: (code: string) => {
      if (!keyStore[code]) {
        keyStore[code] = { isDown: false };
      }

      return keyStore[code];
    },
  };

  const recordedButtons: SceneFactoryResult['recordedButtons'] = [];
  let containerInstance: SceneFactoryResult['container'];

  const scene: SceneStub = {
    input: { keyboard },
    add: {
      image: (_x: number, _y: number, _texture: string, frame?: string) => {
        const events: Record<string, Array<(pointer?: unknown) => void>> = {};
        const setAlphaSpy = vi.fn();
        const offCalls: Array<{ event: string; handler: (pointer?: unknown) => void }> = [];
        const destroySpy = vi.fn();

        const imageStub: ImageStub = {
          setInteractive: () => imageStub,
          on: (event: string, handler: (pointer?: unknown) => void) => {
            events[event] = events[event] ?? [];
            events[event].push(handler);
            return imageStub;
          },
          off: (event: string, handler: (pointer?: unknown) => void) => {
            events[event] = (events[event] ?? []).filter((fn) => fn !== handler);
            offCalls.push({ event, handler });
            return imageStub;
          },
          setScrollFactor: () => imageStub,
          setAlpha: (value: number) => {
            setAlphaSpy(value);
            return imageStub;
          },
          destroy: destroySpy,
        };

        recordedButtons.push({ events, setAlpha: setAlphaSpy, control: frame, offCalls, destroy: destroySpy });

        return imageStub;
      },
      container: (_x: number, _y: number) => {
        const container = {
          add: vi.fn(),
          setScrollFactor: vi.fn(),
          setDepth: vi.fn(),
          destroy: vi.fn(),
        } as SceneFactoryResult['container'];

        container.setScrollFactor.mockReturnValue(container);
        container.setDepth.mockReturnValue(container);

        containerInstance = container;

        return container;
      },
    },
    textures: {
      exists: vi.fn().mockReturnValue(true),
    },
  };

  return {
    scene,
    keyStore,
    recordedButtons,
    get container() {
      return containerInstance;
    },
  } as SceneFactoryResult;
}

describe('PlayerInputManager', () => {
  let sceneFactory: SceneFactoryResult;

  beforeEach(() => {
    sceneFactory = createSceneStub();
  });

  function createManager() {
    return new PlayerInputManager(sceneFactory.scene as unknown as Phaser.Scene);
  }

  it('merges cursor and WASD keys when building the Kirdy input snapshot', () => {
    const manager = createManager();
    const leftKey = sceneFactory.keyStore['LEFT'];
    const rightKey = sceneFactory.keyStore['RIGHT'];
    const aKey = sceneFactory.keyStore['A'];
    const dKey = sceneFactory.keyStore['D'];

    expect(leftKey).toBeDefined();
    expect(rightKey).toBeDefined();
    expect(aKey).toBeDefined();
    expect(dKey).toBeDefined();

    aKey.isDown = true;
    let snapshot = manager.update();
    expect(snapshot.kirdy.left).toBe(true);

    aKey.isDown = false;
    leftKey.isDown = true;
    snapshot = manager.update();
    expect(snapshot.kirdy.left).toBe(true);

    leftKey.isDown = false;
    dKey.isDown = true;
    snapshot = manager.update();
    expect(snapshot.kirdy.right).toBe(true);

    dKey.isDown = false;
    rightKey.isDown = true;
    snapshot = manager.update();
    expect(snapshot.kirdy.right).toBe(true);
  });

  it('tracks justPressed state for primary actions', () => {
    const manager = createManager();
    const spaceKey = sceneFactory.keyStore['SPACE'];
    const cKey = sceneFactory.keyStore['C'];

    expect(spaceKey).toBeDefined();
    expect(cKey).toBeDefined();

    spaceKey.isDown = true;
    let snapshot = manager.update();
    expect(snapshot.kirdy.jumpPressed).toBe(true);
    expect(snapshot.kirdy.hoverPressed).toBe(true);

    cKey.isDown = true;
    snapshot = manager.update();
    expect(snapshot.actions.inhale.isDown).toBe(true);
    expect(snapshot.actions.inhale.justPressed).toBe(true);

    snapshot = manager.update();
    expect(snapshot.actions.inhale.isDown).toBe(true);
    expect(snapshot.actions.inhale.justPressed).toBe(false);

    cKey.isDown = false;
    snapshot = manager.update();
    expect(snapshot.actions.inhale.isDown).toBe(false);
    expect(snapshot.actions.inhale.justPressed).toBe(false);
  });

  it('can be driven by simulated touch controls', () => {
    const manager = createManager();

    manager.simulateTouch('left', true);
    let snapshot: PlayerInputSnapshot = manager.update();
    expect(snapshot.kirdy.left).toBe(true);

    manager.simulateTouch('left', false);
    manager.simulateTouch('jump', true);
    snapshot = manager.update();
    expect(snapshot.kirdy.jumpPressed).toBe(true);
    expect(snapshot.kirdy.hoverPressed).toBe(true);

    manager.simulateTouch('jump', false);
    manager.simulateTouch('inhale', true);
    snapshot = manager.update();
    expect(snapshot.actions.inhale.isDown).toBe(true);
    expect(snapshot.actions.inhale.justPressed).toBe(true);
  });

  it('resets justPressed for touch input after initial activation', () => {
    const manager = createManager();

    manager.simulateTouch('inhale', true);
    let snapshot = manager.update();
    expect(snapshot.actions.inhale.justPressed).toBe(true);

    snapshot = manager.update();
    expect(snapshot.actions.inhale.justPressed).toBe(false);

    manager.simulateTouch('inhale', false);
    snapshot = manager.update();
    expect(snapshot.actions.inhale.isDown).toBe(false);
  });

  it('仮想ボタン用テクスチャが未ロードの場合はタッチUIを生成しない', () => {
    (sceneFactory.scene as any).textures = {
      exists: vi.fn().mockReturnValue(false),
    };

    createManager();

    expect(sceneFactory.recordedButtons.length).toBe(0);
  });

  it('applies visual feedback when virtual buttons are pressed', () => {
    createManager();

    const jumpButton = sceneFactory.recordedButtons.find((button) => button.control === 'jump');
    expect(jumpButton).toBeDefined();

    const downHandler = jumpButton?.events['pointerdown']?.[0];
    const upHandler = jumpButton?.events['pointerup']?.[0];
    const upOutsideHandler = jumpButton?.events['pointerupoutside']?.[0];

    expect(downHandler).toBeInstanceOf(Function);
    expect(upHandler).toBeInstanceOf(Function);
    expect(upOutsideHandler).toBeInstanceOf(Function);

    downHandler?.();
    expect(jumpButton?.setAlpha).toHaveBeenCalledWith(0.6);

    jumpButton?.setAlpha.mockClear();
    upHandler?.();
    expect(jumpButton?.setAlpha).toHaveBeenCalledWith(1);

    jumpButton?.setAlpha.mockClear();
    upOutsideHandler?.();
    expect(jumpButton?.setAlpha).toHaveBeenCalledWith(1);
  });

  it('unregisters touch handlers and destroys the virtual controls on dispose', () => {
    const manager = createManager();

    const button = sceneFactory.recordedButtons[0];
    expect(button).toBeDefined();

    const downHandler = button.events['pointerdown']?.[0];
    const upHandler = button.events['pointerup']?.[0];
    const outHandler = button.events['pointerout']?.[0];
    const upOutsideHandler = button.events['pointerupoutside']?.[0];

    manager.destroy();

    expect(button.offCalls).toEqual(
      expect.arrayContaining([
        { event: 'pointerdown', handler: downHandler },
        { event: 'pointerup', handler: upHandler },
        { event: 'pointerout', handler: outHandler },
        { event: 'pointerupoutside', handler: upOutsideHandler },
      ]),
    );
    expect(button.destroy).toHaveBeenCalled();
    expect(sceneFactory.container?.destroy).toHaveBeenCalled();
  });
});
