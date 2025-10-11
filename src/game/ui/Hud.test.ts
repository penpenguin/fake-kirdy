import { describe, expect, it, vi } from 'vitest';
import { Hud } from './Hud';
import { HUD_SAFE_AREA_HEIGHT } from './hud-layout';

function createSceneStubs() {
  const containerDestroy = vi.fn();
  const containerAdd = vi.fn();
  const containerSetDepth = vi.fn().mockReturnThis();
  const containerSetScrollFactor = vi.fn().mockReturnThis();
  const containerSetVisible = vi.fn().mockReturnThis();

  const container = {
    add: containerAdd,
    setDepth: containerSetDepth,
    setScrollFactor: containerSetScrollFactor,
    setVisible: containerSetVisible,
    destroy: containerDestroy,
  };

  const createRectangle = () => ({
    setOrigin: vi.fn().mockReturnThis(),
    setScrollFactor: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    setFillStyle: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  });

  const hudBackground = createRectangle();
  const hudBorder = createRectangle();

  const hpFill = {
    setScale: vi.fn().mockReturnThis(),
    setOrigin: vi.fn().mockReturnThis(),
    setScrollFactor: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  };

  const hpBar = {
    setScrollFactor: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    setOrigin: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  };

  const createText = () => ({
    setScrollFactor: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    setText: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  });

  const hpLabel = createText();
  const abilityLabel = createText();
  const scoreLabel = createText();

  let rectangleCall = 0;
  const addRectangle = vi.fn(() => {
    switch (rectangleCall) {
      case 0:
        rectangleCall += 1;
        return hudBackground;
      case 1:
        rectangleCall += 1;
        return hudBorder;
      case 2:
        rectangleCall += 1;
        return hpBar;
      case 3:
        rectangleCall += 1;
        return hpFill;
      default:
        rectangleCall += 1;
        return createRectangle();
    }
  });

  const addText = vi
    .fn()
    .mockImplementationOnce(() => hpLabel)
    .mockImplementationOnce(() => abilityLabel)
    .mockImplementationOnce(() => scoreLabel);

  const scene = {
    add: {
      container: vi.fn(() => container),
      rectangle: addRectangle,
      text: addText,
    },
    scale: { width: 800, height: 600 },
  } as any;

  return {
    scene,
    container,
    hudBackground,
    hudBorder,
    hpFill,
    hpBar,
    hpLabel,
    abilityLabel,
    scoreLabel,
  };
}

describe('Hud', () => {
  it('updates the HP bar ratio and label', () => {
    const { scene, hpFill, hpLabel } = createSceneStubs();
    const hud = new Hud(scene);

    hud.updateHP({ current: 3, max: 6 });

    expect(hpFill.setScale).toHaveBeenCalledWith(0.5, 1);
    expect(hpLabel.setText).toHaveBeenCalledWith('HP 3 / 6');

    hud.updateHP({ current: 6, max: 6 });
    expect(hpFill.setScale).toHaveBeenLastCalledWith(1, 1);
    expect(hpLabel.setText).toHaveBeenLastCalledWith('HP 6 / 6');
  });

  it('displays the current ability type in uppercase, falling back to None', () => {
    const { scene, abilityLabel } = createSceneStubs();
    const hud = new Hud(scene);

    hud.updateAbility('fire');
    expect(abilityLabel.setText).toHaveBeenCalledWith('Ability: FIRE');

    hud.updateAbility(undefined);
    expect(abilityLabel.setText).toHaveBeenLastCalledWith('Ability: None');
  });

  it('renders the score as a zero-padded value', () => {
    const { scene, scoreLabel } = createSceneStubs();
    const hud = new Hud(scene);

    hud.updateScore(1500);
    expect(scoreLabel.setText).toHaveBeenCalledWith('Score: 001500');

    hud.updateScore(20);
    expect(scoreLabel.setText).toHaveBeenLastCalledWith('Score: 000020');
  });

  it('HUDには操作説明を表示しない', () => {
    const { scene } = createSceneStubs();
    // eslint-disable-next-line no-new
    new Hud(scene);

    const addTextMock = scene.add.text as ReturnType<typeof vi.fn>;
    const createdTexts = addTextMock.mock.calls.map(([, , text]) => text);

    expect(addTextMock).toHaveBeenCalledTimes(3);
    expect(createdTexts).not.toContain(expect.stringContaining('Controls:'));
    expect(createdTexts).not.toContain(expect.stringContaining('Touch:'));
  });

  it('HUDに背景パネルを配置してゲーム画面上に独自領域を確保する', () => {
    const { scene, hudBackground, hudBorder } = createSceneStubs();
    // eslint-disable-next-line no-new
    new Hud(scene);

    const addRectangleMock = scene.add.rectangle as ReturnType<typeof vi.fn>;
    const [x, y, width, height, color, alpha] = addRectangleMock.mock.calls[0] ?? [];
    const borderArgs = addRectangleMock.mock.calls[1];

    expect(addRectangleMock).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
    );
    expect(x).toBe(0);
    expect(y).toBe(0);
    expect(width).toBe(scene.scale.width);
    expect(height).toBe(HUD_SAFE_AREA_HEIGHT);
    expect(color).toBe(0x121212);
    expect(alpha).toBe(1);
    expect(hudBackground.setOrigin).toHaveBeenCalledWith(0, 0);
    expect(hudBackground.setScrollFactor).toHaveBeenCalledWith(0, 0);
    expect(hudBackground.setDepth).toHaveBeenCalledWith(0);
    expect(borderArgs?.[0]).toBe(0);
    expect(borderArgs?.[1]).toBe(HUD_SAFE_AREA_HEIGHT - 2);
    expect(borderArgs?.[2]).toBe(scene.scale.width);
    expect(borderArgs?.[3]).toBe(2);
    expect(borderArgs?.[4]).toBe(0x000000);
    expect(borderArgs?.[5]).toBe(1);
    expect(hudBorder.setDepth).toHaveBeenCalledWith(1);
  });

  it('destroys all created objects when disposed', () => {
    const { scene, container, hudBackground, hudBorder, hpBar, hpFill, hpLabel, abilityLabel, scoreLabel } = createSceneStubs();
    const hud = new Hud(scene);

    hud.destroy();

    expect(hudBackground.destroy).toHaveBeenCalled();
    expect(hudBorder.destroy).toHaveBeenCalled();
    expect(hpLabel.destroy).toHaveBeenCalled();
    expect(abilityLabel.destroy).toHaveBeenCalled();
    expect(scoreLabel.destroy).toHaveBeenCalled();
    expect(hpFill.destroy).toHaveBeenCalled();
    expect(hpBar.destroy).toHaveBeenCalled();
    expect(container.destroy).toHaveBeenCalled();
  });
});
