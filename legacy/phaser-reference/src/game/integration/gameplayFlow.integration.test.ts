import { describe, expect, it } from 'vitest';
import { createGameplayHarness, actionState } from './testHarness';

describe('統合: ゲームプレイフロー', () => {
  it('引き寄せ→吸収→能力使用が連鎖し、能力攻撃が生成される', () => {
    const harness = createGameplayHarness({ abilityType: 'fire' });

    const inhaleAction = actionState({ inhale: { isDown: true, justPressed: true } });
    harness.inhaleSystem.update(inhaleAction);

    expect(harness.kirdy.getMouthContent()).toBe(harness.enemy);

    const swallowAction = actionState({ swallow: { isDown: true, justPressed: true } });
    harness.swallowSystem.update(swallowAction);
    const payload = harness.swallowSystem.consumeSwallowedPayload();
    harness.abilitySystem.applySwallowedPayload(payload);

    const abilityAction = actionState({ spit: { isDown: true, justPressed: true } });
    harness.abilitySystem.update(abilityAction);

    expect(harness.scene.events.emit).toHaveBeenCalledWith('ability-acquired', { abilityType: 'fire' });
    expect(harness.physicsSystem.registerPlayerAttack).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'kirdy-fire-attack' }),
      expect.objectContaining({ damage: 3 }),
    );
    expect(harness.scene.sound.play).toHaveBeenCalledWith('kirdy-swallow');
    expect(harness.scene.sound.play).toHaveBeenCalledWith('ability-fire-attack');
  });

  it('吸い込み中の敵はイベント連携で追従・干渉遮断・能力化される', () => {
    const harness = createGameplayHarness({ abilityType: 'ice' });

    const inhaleAction = actionState({ inhale: { isDown: true, justPressed: true } });
    harness.inhaleSystem.update(inhaleAction);

    expect(harness.enemy.getData('inMouth')).toBe(true);
    expect(harness.scene.events.emit).toHaveBeenCalledWith('enemy-captured', { sprite: harness.enemy });

    const swallowAction = actionState({ swallow: { isDown: true, justPressed: true } });
    harness.swallowSystem.update(swallowAction);

    expect(harness.scene.events.emit).toHaveBeenCalledWith('enemy-capture-released', { sprite: harness.enemy });
    expect(harness.scene.events.emit).toHaveBeenCalledWith('enemy-swallowed', {
      sprite: harness.enemy,
      abilityType: 'ice',
      ability: expect.objectContaining({ type: 'ice' }),
    });
    expect(harness.enemy.destroyed).toBe(true);
  });

  it('放出アクション中に物理破棄が失敗してもゲームは継続する', () => {
    const harness = createGameplayHarness({ abilityType: 'fire' });

    harness.physicsSystem.destroyProjectile.mockImplementation(() => {
      throw new Error('destroy failed');
    });

    const inhaleAction = actionState({ inhale: { isDown: true, justPressed: true } });
    harness.inhaleSystem.update(inhaleAction);

    const spitAction = actionState({ spit: { isDown: true, justPressed: true } });
    expect(() => harness.swallowSystem.update(spitAction)).not.toThrow();

    expect(() => harness.scene.runAllTimers()).not.toThrow();
  });
});
