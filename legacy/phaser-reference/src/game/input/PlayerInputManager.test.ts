import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import {
  PlayerInputManager,
  type PlayerInputSnapshot,
  type PlayerTouchControl,
} from './PlayerInputManager';

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
  setDisplaySize: (width: number, height: number) => ImageStub;
  setName: (value: string) => ImageStub;
  setAlpha: (value: number) => ImageStub;
  destroy: () => void;
};

type ContainerStub = {
  add: (...children: ImageStub[]) => void;
  setScrollFactor: (x: number, y?: number) => ContainerStub;
  setDepth: (value: number) => ContainerStub;
  destroy: () => void;
};

type ContainerMock = ContainerStub & {
  add: ReturnType<typeof vi.fn>;
  setScrollFactor: ReturnType<typeof vi.fn>;
  setDepth: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
};

type TextureFrame = {
  name: string;
  cutX: number;
  cutY: number;
  width: number;
  height: number;
};

type MockFunction<Params extends any[] = any[], Result = unknown> = ReturnType<
  typeof vi.fn<Params, Result>
>;

type ControlTextureStub = {
  getFrameNames: MockFunction<[], string[]>;
  has: MockFunction<[name: string], boolean>;
  hasFrame: MockFunction<[name: string], boolean>;
  getFrame: MockFunction<[name: string], TextureFrame | undefined>;
  add: MockFunction<
    [name: string, sourceIndex: number, cutX: number, cutY: number, width: number, height: number],
    TextureFrame
  >;
  frames: Record<string, TextureFrame>;
  source: Array<{ width: number; height: number }>;
};

type TextureManagerStub = {
  exists: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
};

const REQUIRED_CONTROL_FRAMES = [
  'dpad-up',
  'dpad-left',
  'dpad-down',
  'dpad-right',
  'spit',
  'discard',
  'inhale',
] as const;

type VirtualControlFrame = (typeof REQUIRED_CONTROL_FRAMES)[number];

function createControlTextureStub(options?: { initialFrames?: VirtualControlFrame[] }): ControlTextureStub {
  const frameSize = 96;
  const columns = 4;
  const rows = 2;
  const width = frameSize * columns;
  const height = frameSize * rows;
  const initialFrames = options?.initialFrames ?? REQUIRED_CONTROL_FRAMES;

  const frameSet = new Set<string>(initialFrames);
  const frames: Record<string, TextureFrame> = {
    __BASE: { name: '__BASE', cutX: 0, cutY: 0, width, height },
  };

  initialFrames.forEach((frame, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    frames[frame] = {
      name: frame,
      cutX: column * frameSize,
      cutY: row * frameSize,
      width: frameSize,
      height: frameSize,
    };
  });

  const add = vi.fn<
    [string, number, number, number, number, number],
    TextureFrame
  >((name, _sourceIndex, cutX, cutY, widthArg, heightArg) => {
    frameSet.add(name);
    frames[name] = { name, cutX, cutY, width: widthArg, height: heightArg };
    return frames[name];
  });

  const getFrameNames = vi.fn<[], string[]>(() => Array.from(frameSet));
  const has = vi.fn<[string], boolean>((name) => frameSet.has(name));
  const hasFrame = vi.fn<[string], boolean>((name) => frameSet.has(name));
  const getFrame = vi.fn<[string], TextureFrame | undefined>((name) => frames[name]);

  return {
    getFrameNames,
    has,
    hasFrame,
    getFrame,
    add,
    frames,
    source: [{ width, height }],
  };
}

interface SceneStub {
  input: { keyboard: KeyboardStub };
  add: {
    image: (x: number, y: number, texture: string, frame?: string) => ImageStub;
    container: (x: number, y: number) => ContainerStub;
  };
  textures: TextureManagerStub;
}

type SceneFactoryResult = {
  scene: SceneStub;
  keyStore: Record<string, KeyMock>;
  recordedButtons: Array<{
    control?: string;
    events: Record<string, Array<(pointer?: unknown) => void>>;
    setAlpha: ReturnType<typeof vi.fn>;
    setDisplaySize: ReturnType<typeof vi.fn>;
    setName: ReturnType<typeof vi.fn>;
    offCalls: Array<{ event: string; handler: (pointer?: unknown) => void }>;
    destroy: ReturnType<typeof vi.fn>;
    x: number;
    y: number;
  }>;
  container?: ContainerMock;
  controlTexture: ControlTextureStub;
};

function createSceneStub(options?: { initialControlFrames?: VirtualControlFrame[] }): SceneFactoryResult {
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
  let containerInstance: ContainerMock | undefined;

  const controlTexture = createControlTextureStub({ initialFrames: options?.initialControlFrames });

  const textures: TextureManagerStub = {
    exists: vi.fn().mockReturnValue(true),
    get: vi.fn().mockImplementation((key: string) =>
      key === 'virtual-controls' ? controlTexture : undefined,
    ),
  };

  const scene: SceneStub = {
    input: { keyboard },
    add: {
      image: (x: number, y: number, _texture: string, frame?: string) => {
        const events: Record<string, Array<(pointer?: unknown) => void>> = {};
        const setAlphaSpy = vi.fn();
        const setDisplaySizeSpy = vi.fn();
        const setNameSpy = vi.fn();
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
          setDisplaySize: (width: number, height: number) => {
            setDisplaySizeSpy(width, height);
            return imageStub;
          },
          setName: (value: string) => {
            setNameSpy(value);
            return imageStub;
          },
          setAlpha: (value: number) => {
            setAlphaSpy(value);
            return imageStub;
          },
          destroy: destroySpy,
        };

        recordedButtons.push({
          events,
          setAlpha: setAlphaSpy,
          setDisplaySize: setDisplaySizeSpy,
          setName: setNameSpy,
          control: frame,
          offCalls,
          destroy: destroySpy,
          x,
          y,
        });

        return imageStub;
      },
      container: (_x: number, _y: number) => {
        const container: ContainerMock = {
          add: vi.fn() as unknown as ContainerMock['add'],
          setScrollFactor: vi.fn() as unknown as ContainerMock['setScrollFactor'],
          setDepth: vi.fn() as unknown as ContainerMock['setDepth'],
          destroy: vi.fn() as unknown as ContainerMock['destroy'],
        };

        container.setScrollFactor.mockReturnValue(container);
        container.setDepth.mockReturnValue(container);

        containerInstance = container;

        return container;
      },
    },
    textures,
  };

  return {
    scene,
    keyStore,
    recordedButtons,
    get container() {
      return containerInstance;
    },
    controlTexture,
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

  it('treats UP と W の長押しでもホバリング入力を有効にする', () => {
    const manager = createManager();
    const upKey = sceneFactory.keyStore['UP'];
    const wKey = sceneFactory.keyStore['W'];

    expect(upKey).toBeDefined();
    expect(wKey).toBeDefined();

    upKey.isDown = true;
    let snapshot = manager.update();
    expect(snapshot.kirdy.jumpPressed).toBe(true);
    expect(snapshot.kirdy.hoverPressed).toBe(true);

    upKey.isDown = false;
    wKey.isDown = true;
    snapshot = manager.update();
    expect(snapshot.kirdy.jumpPressed).toBe(true);
    expect(snapshot.kirdy.hoverPressed).toBe(true);
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
      get: vi.fn().mockReturnValue(undefined),
    };

    createManager();

    expect(sceneFactory.recordedButtons.length).toBe(0);
  });

  it('virtual-controlsテクスチャのフレームを利用してボタンを配置する', () => {
    createManager();

    expect(sceneFactory.recordedButtons).toHaveLength(7);
    sceneFactory.recordedButtons.forEach((button) => {
      expect(button.setDisplaySize).toHaveBeenCalledWith(80, 80);
      expect(button.setName).toHaveBeenCalledWith(expect.stringMatching(/^touch-/));
      expect(button.control).toBeDefined();
    });

    const frames = sceneFactory.recordedButtons.map((button) => button.control);
    expect(frames).toEqual(
      expect.arrayContaining(['dpad-up', 'dpad-left', 'dpad-down', 'dpad-right', 'spit', 'discard', 'inhale']),
    );
  });

  it('spritesheetメタデータが無くても仮想ボタン用フレームを補完する', () => {
    sceneFactory = createSceneStub({ initialControlFrames: [] });

    createManager();

    expect(sceneFactory.recordedButtons).toHaveLength(7);
    sceneFactory.recordedButtons.forEach((button) => {
      expect(button.control).toBeDefined();
      expect(button.setDisplaySize).toHaveBeenCalledWith(80, 80);
    });

    const addedFrames = sceneFactory.controlTexture.add.mock.calls.map((args) => args[0]);
    REQUIRED_CONTROL_FRAMES.forEach((frame) => {
      expect(addedFrames).toContain(frame);
    });
  });

  it('左側の十字ボタンがWASD入力と連動する', () => {
    const manager = createManager();

    const leftButton = sceneFactory.recordedButtons.find((button) => button.control === 'dpad-left');
    const rightButton = sceneFactory.recordedButtons.find((button) => button.control === 'dpad-right');
    const upButton = sceneFactory.recordedButtons.find((button) => button.control === 'dpad-up');
    const downButton = sceneFactory.recordedButtons.find((button) => button.control === 'dpad-down');

    expect(leftButton).toBeDefined();
    expect(rightButton).toBeDefined();
    expect(upButton).toBeDefined();
    expect(downButton).toBeDefined();

    const leftDown = leftButton?.events['pointerdown']?.[0];
    const leftUp = leftButton?.events['pointerup']?.[0];
    expect(leftDown).toBeInstanceOf(Function);
    expect(leftUp).toBeInstanceOf(Function);
    leftDown?.();
    let snapshot = manager.update();
    expect(snapshot.kirdy.left).toBe(true);
    leftUp?.();
    snapshot = manager.update();
    expect(snapshot.kirdy.left).toBe(false);

    const rightDown = rightButton?.events['pointerdown']?.[0];
    const rightUp = rightButton?.events['pointerup']?.[0];
    expect(rightDown).toBeInstanceOf(Function);
    expect(rightUp).toBeInstanceOf(Function);
    rightDown?.();
    snapshot = manager.update();
    expect(snapshot.kirdy.right).toBe(true);
    rightUp?.();
    snapshot = manager.update();
    expect(snapshot.kirdy.right).toBe(false);

    const upDown = upButton?.events['pointerdown']?.[0];
    const upUp = upButton?.events['pointerup']?.[0];
    expect(upDown).toBeInstanceOf(Function);
    expect(upUp).toBeInstanceOf(Function);
    upDown?.();
    snapshot = manager.update();
    expect(snapshot.kirdy.jumpPressed).toBe(true);
    expect(snapshot.kirdy.hoverPressed).toBe(true);
    upUp?.();
    snapshot = manager.update();
    expect(snapshot.kirdy.jumpPressed).toBe(false);
    expect(snapshot.kirdy.hoverPressed).toBe(false);

    const downDown = downButton?.events['pointerdown']?.[0];
    const downUp = downButton?.events['pointerup']?.[0];
    expect(downDown).toBeInstanceOf(Function);
    expect(downUp).toBeInstanceOf(Function);
    downDown?.();
    snapshot = manager.update();
    expect(snapshot.actions.swallow.isDown).toBe(true);
    expect(snapshot.actions.swallow.justPressed).toBe(true);
    snapshot = manager.update();
    expect(snapshot.actions.swallow.isDown).toBe(true);
    expect(snapshot.actions.swallow.justPressed).toBe(false);
    downUp?.();
    snapshot = manager.update();
    expect(snapshot.actions.swallow.isDown).toBe(false);
  });

  it('右側アクションボタンを左下から右上への対角線上に配置する', () => {
    createManager();

    const spit = sceneFactory.recordedButtons.find((button) => button.control === 'spit');
    const discard = sceneFactory.recordedButtons.find((button) => button.control === 'discard');
    const inhale = sceneFactory.recordedButtons.find((button) => button.control === 'inhale');

    expect(spit).toBeDefined();
    expect(discard).toBeDefined();
    expect(inhale).toBeDefined();

    expect(spit!.x).toBeLessThan(discard!.x);
    expect(discard!.x).toBeLessThan(inhale!.x);
    expect(spit!.y).toBeGreaterThan(discard!.y);
    expect(discard!.y).toBeGreaterThan(inhale!.y);
  });

  it('DOWNキーは吸い込み許可時のみ動作し、長押しでもjustPressedを再発火させない', () => {
    const manager = createManager();
    const downKey = sceneFactory.keyStore['DOWN'];
    expect(downKey).toBeDefined();

    downKey.isDown = true;
    let snapshot = manager.update();
    expect(snapshot.actions.swallow.isDown).toBe(false);
    expect(snapshot.actions.swallow.justPressed).toBe(false);

    manager.setSwallowDownEnabled(true);
    snapshot = manager.update();
    expect(snapshot.actions.swallow.isDown).toBe(true);
    expect(snapshot.actions.swallow.justPressed).toBe(true);

    snapshot = manager.update();
    expect(snapshot.actions.swallow.isDown).toBe(true);
    expect(snapshot.actions.swallow.justPressed).toBe(false);

    manager.setSwallowDownEnabled(false);
    snapshot = manager.update();
    expect(snapshot.actions.swallow.isDown).toBe(false);
    expect(snapshot.actions.swallow.justPressed).toBe(false);
  });

  it('applies visual feedback when virtual buttons are pressed', () => {
    createManager();

    const spitButton = sceneFactory.recordedButtons.find((button) => button.control === 'spit');
    expect(spitButton).toBeDefined();

    const downHandler = spitButton?.events['pointerdown']?.[0];
    const upHandler = spitButton?.events['pointerup']?.[0];
    const upOutsideHandler = spitButton?.events['pointerupoutside']?.[0];

    expect(downHandler).toBeInstanceOf(Function);
    expect(upHandler).toBeInstanceOf(Function);
    expect(upOutsideHandler).toBeInstanceOf(Function);

    downHandler?.();
    expect(spitButton?.setAlpha).toHaveBeenCalledWith(0.6);

    spitButton?.setAlpha.mockClear();
    upHandler?.();
    expect(spitButton?.setAlpha).toHaveBeenCalledWith(1);

    spitButton?.setAlpha.mockClear();
    upOutsideHandler?.();
    expect(spitButton?.setAlpha).toHaveBeenCalledWith(1);
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
