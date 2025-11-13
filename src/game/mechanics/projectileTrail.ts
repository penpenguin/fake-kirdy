import type Phaser from 'phaser';

type ParticleEffect = {
  startFollow?: (
    target: Phaser.Types.Math.Vector2Like,
    offsetX?: number,
    offsetY?: number,
    trackVisible?: boolean,
  ) => unknown;
  stop?: (kill?: boolean) => unknown;
  destroy?: (fromScene?: boolean) => unknown;
  setDepth?: (value: number) => unknown;
};

export type ProjectileTrailOptions = {
  textureKeys?: readonly string[];
  depth?: number;
};

const DEFAULT_PARTICLE_KEYS = ['inhale-sparkle', 'kirdy-inhale', 'kirdy'] as const;
const DEFAULT_TRAIL_DEPTH = 900;

export function attachProjectileTrail(
  scene: Phaser.Scene,
  projectile: Phaser.Physics.Matter.Sprite | Phaser.GameObjects.GameObject,
  options: ProjectileTrailOptions = {},
) {
  const particleFactory = scene?.add?.particles;
  if (typeof particleFactory !== 'function') {
    return undefined;
  }

  const candidates = options.textureKeys?.length ? options.textureKeys : DEFAULT_PARTICLE_KEYS;
  let effect: ParticleEffect | undefined;

  for (const key of candidates) {
    try {
      const created = particleFactory.call(scene.add, 0, 0, key);
      if (created) {
        effect = created as ParticleEffect;
        break;
      }
    } catch {
      // try next candidate
    }
  }

  if (!effect) {
    return undefined;
  }

  effect.setDepth?.(options.depth ?? DEFAULT_TRAIL_DEPTH);
  effect.startFollow?.(projectile as Phaser.Types.Math.Vector2Like);

  const teardown = () => {
    effect?.stop?.(true);
    effect?.destroy?.();
    effect = undefined;
  };

  if (typeof (projectile as Phaser.GameObjects.GameObject).once === 'function') {
    (projectile as Phaser.GameObjects.GameObject).once('destroy', () => teardown());
  }

  return teardown;
}
