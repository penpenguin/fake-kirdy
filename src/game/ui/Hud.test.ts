import { describe, expect, it, vi } from 'vitest';
import { Hud } from './Hud';

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

  const addRectangle = vi.fn().mockImplementationOnce(() => hpBar).mockImplementationOnce(() => hpFill);
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

  it('destroys all created objects when disposed', () => {
    const { scene, container, hpBar, hpFill, hpLabel, abilityLabel, scoreLabel } = createSceneStubs();
    const hud = new Hud(scene);

    hud.destroy();

    expect(hpLabel.destroy).toHaveBeenCalled();
    expect(abilityLabel.destroy).toHaveBeenCalled();
    expect(scoreLabel.destroy).toHaveBeenCalled();
    expect(hpFill.destroy).toHaveBeenCalled();
    expect(hpBar.destroy).toHaveBeenCalled();
    expect(container.destroy).toHaveBeenCalled();
  });
});
