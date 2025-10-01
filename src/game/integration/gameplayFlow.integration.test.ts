import { describe, expect, it } from 'vitest';
import { createGameplayHarness, actionState } from './testHarness';

describe('統合: ゲームプレイフロー', () => {
  it('吸い込み→飲み込み→能力使用が連鎖し、能力攻撃が生成される', () => {
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
      expect.objectContaining({ damage: 2 }),
    );
    expect(harness.scene.sound.play).toHaveBeenCalledWith('kirdy-swallow');
    expect(harness.scene.sound.play).toHaveBeenCalledWith('ability-fire-attack');
  });
});
