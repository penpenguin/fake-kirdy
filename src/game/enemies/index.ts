import type Phaser from 'phaser';
import type { AbilityType } from '../mechanics/AbilitySystem';
import { KIRDY_MOVE_SPEED } from '../characters/Kirdy';

const DEFAULT_ENEMY_SPEED = Math.max(1, KIRDY_MOVE_SPEED * 0.4);
const WABBLE_CHASE_SPEED = DEFAULT_ENEMY_SPEED * 1.125;
const FROST_WABBLE_PATROL_SPEED = DEFAULT_ENEMY_SPEED * 0.9;
const FROST_WABBLE_CHASE_SPEED = DEFAULT_ENEMY_SPEED;
const DRONTO_CHARGE_SPEED = DEFAULT_ENEMY_SPEED * 1.125;
const GLACIO_DURT_CHARGE_SPEED = DEFAULT_ENEMY_SPEED * 0.95;

export type EnemyType =
  | 'wabble-bee'
  | 'dronto-durt'
  | 'frost-wabble'
  | 'glacio-durt'
  | 'vine-hopper'
  | 'thorn-roller'
  | 'sap-spitter'
  | 'chill-wisp'
  | 'glacier-golem'
  | 'frost-archer'
  | 'ember-imp'
  | 'magma-crab'
  | 'blaze-strider'
  | 'stone-sentinel'
  | 'curse-bat'
  | 'relic-thief'
  | 'gale-kite'
  | 'nimbus-knight'
  | 'prism-wraith';

type WabbleBeeEnemyType = Extract<EnemyType, 'wabble-bee' | 'frost-wabble'>;
type DrontoDurtEnemyType = Extract<EnemyType, 'dronto-durt' | 'glacio-durt'>;

export interface EnemySpawn {
  x: number;
  y: number;
}

const WABBLE_BEE_SCALE = 0.65;
const DRONTO_DURT_SCALE = 0.75;
const WABBLE_BEE_BODY = { width: 42, height: 36 };
const DRONTO_DURT_BODY = { width: 48, height: 48 };

type TargetPosition = { x: number; y: number };

type EnemyDisperseContext = { x: number; y: number };

type TargetProvider = () => TargetPosition | undefined;

export interface EnemyCommonOptions {
  maxHP?: number;
  abilityType?: AbilityType;
  getPlayerPosition?: TargetProvider;
}

export interface Enemy {
  sprite: Phaser.Physics.Matter.Sprite;
  update(delta: number): void;
  takeDamage(amount: number): void;
  getHP(): number;
  isDefeated(): boolean;
  getEnemyType(): EnemyType;
  getAbilityType(): AbilityType | undefined;
  onDisperse?(context: EnemyDisperseContext): void;
}

interface BaseEnemyConfig extends EnemyCommonOptions {
  defaultHP: number;
  defaultAbility?: AbilityType;
}

interface WabbleBeeVariantConfig {
  enemyType: WabbleBeeEnemyType;
  displayName: string;
  defaultAbility: AbilityType;
  tint?: number;
}

interface DrontoDurtVariantConfig {
  enemyType: DrontoDurtEnemyType;
  displayName: string;
  defaultAbility: AbilityType;
  tint?: number;
}

abstract class BaseEnemy implements Enemy {
  public readonly sprite: Phaser.Physics.Matter.Sprite;
  protected readonly scene: Phaser.Scene;
  protected readonly getPlayerPosition?: TargetProvider;
  private readonly enemyType: EnemyType;
  private readonly abilityType?: AbilityType;
  private hp: number;
  private defeated = false;

  constructor(scene: Phaser.Scene, sprite: Phaser.Physics.Matter.Sprite, enemyType: EnemyType, config: BaseEnemyConfig) {
    this.scene = scene;
    this.sprite = sprite;
    this.enemyType = enemyType;
    this.getPlayerPosition = config.getPlayerPosition;

    const maxHP = Math.max(1, config.maxHP ?? config.defaultHP);
    this.hp = maxHP;

    const abilityType = config.abilityType ?? config.defaultAbility;
    this.abilityType = abilityType;

    this.sprite.setData?.('enemyType', enemyType);
    this.sprite.setData?.('maxHP', maxHP);
    this.sprite.setData?.('hp', this.hp);

    if (abilityType) {
      this.sprite.setData?.('abilityType', abilityType);
    }
  }

  update(delta: number) {
    if (this.defeated) {
      return;
    }

    this.updateAI(delta);
  }

  takeDamage(amount: number) {
    if (this.defeated) {
      return;
    }

    const clamped = Math.max(0, Math.floor(amount));
    if (clamped <= 0) {
      return;
    }

    this.hp = Math.max(0, this.hp - clamped);
    this.sprite.setData?.('hp', this.hp);

    if (this.hp <= 0) {
      this.handleDefeat();
    }
  }

  getHP() {
    return this.hp;
  }

  isDefeated() {
    return this.defeated;
  }

  getAbilityType() {
    return this.abilityType;
  }

  getEnemyType() {
    return this.enemyType;
  }

  protected abstract updateAI(delta: number): void;

  protected handleDefeat() {
    if (this.defeated) {
      return;
    }

    this.defeated = true;
    this.sprite.setActive?.(false);
    this.sprite.setVisible?.(false);
    this.sprite.destroy?.();
    this.scene.events?.emit?.('enemy-defeated', {
      enemyType: this.enemyType,
      abilityType: this.abilityType,
      sprite: this.sprite,
    });
  }

  onDisperse(_context: EnemyDisperseContext) {
    // default no-op
  }
}

export interface WabbleBeeOptions extends EnemyCommonOptions {
  patrolRadius?: number;
  patrolSpeed?: number;
  detectionRange?: number;
  chaseSpeed?: number;
}

class WabbleBee extends BaseEnemy {
  private spawnX: number;
  private readonly patrolRadius: number;
  private readonly patrolSpeed: number;
  private readonly detectionRange: number;
  private readonly chaseSpeed: number;
  private patrolDirection = 1;
  private disperseRecoveryMs = 0;
  private readonly disperseChaseLockMs = 2000;

  constructor(
    scene: Phaser.Scene,
    sprite: Phaser.Physics.Matter.Sprite,
    spawn: EnemySpawn,
    options: WabbleBeeOptions = {},
    variant: WabbleBeeVariantConfig = { enemyType: 'wabble-bee', displayName: 'Wabble Bee', defaultAbility: 'fire' },
  ) {
    const resolvedAbility = options.abilityType ?? variant.defaultAbility;
    const defaultHP = Math.max(1, options.maxHP ?? 1);
    super(scene, sprite, variant.enemyType, {
      defaultHP,
      defaultAbility: resolvedAbility,
      getPlayerPosition: options.getPlayerPosition,
      abilityType: resolvedAbility,
      maxHP: options.maxHP,
    });

    this.spawnX = spawn.x;
    this.patrolRadius = options.patrolRadius ?? 64;
    this.patrolSpeed = options.patrolSpeed ?? DEFAULT_ENEMY_SPEED;
    this.detectionRange = options.detectionRange ?? 160;
    this.chaseSpeed = options.chaseSpeed ?? WABBLE_CHASE_SPEED;

    sprite.setName?.(variant.displayName);
    if (variant.tint !== undefined) {
      sprite.setTint?.(variant.tint);
    } else {
      sprite.clearTint?.();
    }
  }

  protected updateAI(_delta: number) {
    if (Number.isFinite(_delta) && _delta > 0) {
      this.disperseRecoveryMs = Math.max(0, this.disperseRecoveryMs - _delta);
    }

    const sprite = this.sprite;
    const spriteX = sprite?.x ?? sprite?.body?.position?.x ?? 0;
    const target = this.getPlayerPosition?.();

    if (target && this.disperseRecoveryMs <= 0) {
      const deltaX = target.x - spriteX;
      if (Math.abs(deltaX) <= this.detectionRange) {
        const direction = deltaX < 0 ? -1 : deltaX > 0 ? 1 : 0;
        if (direction !== 0) {
          this.sprite.setVelocityX?.(direction * this.chaseSpeed);
          this.sprite.setFlipX?.(direction < 0);
          return;
        }
      }
    }

    const offsetFromSpawn = spriteX - this.spawnX;
    if (offsetFromSpawn >= this.patrolRadius) {
      this.patrolDirection = -1;
    } else if (offsetFromSpawn <= -this.patrolRadius) {
      this.patrolDirection = 1;
    }

    this.sprite.setVelocityX?.(this.patrolDirection * this.patrolSpeed);
    this.sprite.setFlipX?.(this.patrolDirection < 0);
  }

  onDisperse(context: EnemyDisperseContext) {
    this.spawnX = context.x;
    this.patrolDirection = 1;
    this.disperseRecoveryMs = this.disperseChaseLockMs;
  }
}

export interface DrontoDurtOptions extends EnemyCommonOptions {
  detectionRange?: number;
  chargeSpeed?: number;
}

class DrontoDurt extends BaseEnemy {
  private readonly detectionRange: number;
  private readonly chargeSpeed: number;

  constructor(
    scene: Phaser.Scene,
    sprite: Phaser.Physics.Matter.Sprite,
    spawn: EnemySpawn,
    options: DrontoDurtOptions = {},
    variant: DrontoDurtVariantConfig = { enemyType: 'dronto-durt', displayName: 'Dronto Durt', defaultAbility: 'sword' },
  ) {
    const resolvedAbility = options.abilityType ?? variant.defaultAbility;
    const defaultHP = Math.max(1, options.maxHP ?? 1);
    super(scene, sprite, variant.enemyType, {
      defaultHP,
      defaultAbility: resolvedAbility,
      getPlayerPosition: options.getPlayerPosition,
      abilityType: resolvedAbility,
      maxHP: options.maxHP,
    });

    this.detectionRange = options.detectionRange ?? 200;
    this.chargeSpeed = options.chargeSpeed ?? DRONTO_CHARGE_SPEED;
    // keep spawn reference to align y on ground if needed later
    void spawn; // avoids unused parameter linting

    sprite.setName?.(variant.displayName);
    if (variant.tint !== undefined) {
      sprite.setTint?.(variant.tint);
    } else {
      sprite.clearTint?.();
    }
  }

  protected updateAI(_delta: number) {
    const target = this.getPlayerPosition?.();
    const sprite = this.sprite;
    const spriteX = sprite?.x ?? sprite?.body?.position?.x ?? 0;

    if (!target) {
      this.sprite.setVelocityX?.(0);
      return;
    }

    const deltaX = target.x - spriteX;
    if (Math.abs(deltaX) > this.detectionRange) {
      this.sprite.setVelocityX?.(0);
      return;
    }

    const direction = deltaX < 0 ? -1 : deltaX > 0 ? 1 : 0;
    this.sprite.setVelocityX?.(direction * this.chargeSpeed);
    this.sprite.setFlipX?.(direction < 0);
  }
}

function ensureSprite<T extends Phaser.Physics.Matter.Sprite | undefined>(
  sprite: T,
  enemyType: EnemyType,
): Phaser.Physics.Matter.Sprite {
  if (!sprite) {
    throw new Error(`Failed to create sprite for ${enemyType}`);
  }

  return sprite;
}

function configureWabbleSprite(sprite: Phaser.Physics.Matter.Sprite) {
  sprite.setOrigin?.(0.5, 0.5);
  if (typeof sprite.setBody === 'function') {
    sprite.setBody?.({
      type: 'rectangle',
      width: WABBLE_BEE_BODY.width,
      height: WABBLE_BEE_BODY.height,
    });
  } else {
    sprite.setRectangle?.(WABBLE_BEE_BODY.width, WABBLE_BEE_BODY.height);
  }
  sprite.setScale?.(WABBLE_BEE_SCALE);
  sprite.setIgnoreGravity?.(true);
  sprite.setFixedRotation?.();
  sprite.setFrictionAir?.(0.02);
}

function configureDrontoSprite(sprite: Phaser.Physics.Matter.Sprite) {
  sprite.setOrigin?.(0.5, 0.5);
  if (typeof sprite.setBody === 'function') {
    sprite.setBody?.({
      type: 'rectangle',
      width: DRONTO_DURT_BODY.width,
      height: DRONTO_DURT_BODY.height,
    });
  } else {
    sprite.setRectangle?.(DRONTO_DURT_BODY.width, DRONTO_DURT_BODY.height);
  }
  sprite.setScale?.(DRONTO_DURT_SCALE);
  sprite.setIgnoreGravity?.(false);
  sprite.setFixedRotation?.();
  sprite.setFrictionAir?.(0.05);
}

export function createWabbleBee(scene: Phaser.Scene, spawn: EnemySpawn, options: WabbleBeeOptions = {}) {
  const sprite = ensureSprite(
    scene.matter?.add?.sprite?.(spawn.x, spawn.y, 'wabble-bee'),
    'wabble-bee',
  );

  configureWabbleSprite(sprite);

  return new WabbleBee(scene, sprite, spawn, options, {
    enemyType: 'wabble-bee',
    displayName: 'Wabble Bee',
    defaultAbility: 'fire',
  });
}

export function createDrontoDurt(scene: Phaser.Scene, spawn: EnemySpawn, options: DrontoDurtOptions = {}) {
  const sprite = ensureSprite(
    scene.matter?.add?.sprite?.(spawn.x, spawn.y, 'dronto-durt'),
    'dronto-durt',
  );

  configureDrontoSprite(sprite);

  return new DrontoDurt(scene, sprite, spawn, options, {
    enemyType: 'dronto-durt',
    displayName: 'Dronto Durt',
    defaultAbility: 'sword',
  });
}

export function createFrostWabble(scene: Phaser.Scene, spawn: EnemySpawn, options: WabbleBeeOptions = {}) {
  const sprite = ensureSprite(
    scene.matter?.add?.sprite?.(spawn.x, spawn.y, 'wabble-bee'),
    'frost-wabble',
  );

  configureWabbleSprite(sprite);

  const frostOptions: WabbleBeeOptions = {
    ...options,
    abilityType: options.abilityType ?? 'ice',
    patrolSpeed: options.patrolSpeed ?? FROST_WABBLE_PATROL_SPEED,
    chaseSpeed: options.chaseSpeed ?? FROST_WABBLE_CHASE_SPEED,
    detectionRange: options.detectionRange ?? 200,
  };

  return new WabbleBee(scene, sprite, spawn, frostOptions, {
    enemyType: 'frost-wabble',
    displayName: 'Frost Wabble',
    defaultAbility: 'ice',
    tint: 0x7fe9ff,
  });
}

export function createGlacioDurt(scene: Phaser.Scene, spawn: EnemySpawn, options: DrontoDurtOptions = {}) {
  const sprite = ensureSprite(
    scene.matter?.add?.sprite?.(spawn.x, spawn.y, 'dronto-durt'),
    'glacio-durt',
  );

  configureDrontoSprite(sprite);

  const glacioOptions: DrontoDurtOptions = {
    ...options,
    abilityType: options.abilityType ?? 'ice',
    detectionRange: options.detectionRange ?? 220,
    chargeSpeed: options.chargeSpeed ?? GLACIO_DURT_CHARGE_SPEED,
  };

  return new DrontoDurt(scene, sprite, spawn, glacioOptions, {
    enemyType: 'glacio-durt',
    displayName: 'Glacio Durt',
    defaultAbility: 'ice',
    tint: 0x9fd8ff,
  });
}

class PassiveEnemy extends BaseEnemy {
  protected updateAI(_delta: number) {
    // Placeholder enemies stay idle until bespoke AI is implemented.
    this.sprite.setVelocityX?.(0);
  }
}

type PlaceholderEnemyOptions = EnemyCommonOptions & {
  scale?: number;
  tint?: number;
  ignoreGravity?: boolean;
  body?: { width: number; height: number; isSensor?: boolean };
  displayName?: string;
};

function createPlaceholderEnemy(
  scene: Phaser.Scene,
  spawn: EnemySpawn,
  config: {
    enemyType: EnemyType;
    defaultAbility: AbilityType;
    textureKey: string;
    defaultHP?: number;
    displayName?: string;
    scale?: number;
    tint?: number;
    ignoreGravity?: boolean;
    body?: { width: number; height: number; isSensor?: boolean };
  },
  options: PlaceholderEnemyOptions = {},
) {
  const sprite = ensureSprite(scene.matter?.add?.sprite?.(spawn.x, spawn.y, config.textureKey), config.enemyType);
  sprite.setName?.(config.displayName ?? config.enemyType);
  sprite.setOrigin?.(0.5, 0.5);
  sprite.setFixedRotation?.();
  sprite.setIgnoreGravity?.(config.ignoreGravity ?? options.ignoreGravity ?? false);
  sprite.setScale?.(config.scale ?? options.scale ?? 0.85);
  if (config.tint !== undefined) {
    sprite.setTint?.(config.tint);
  } else {
    sprite.clearTint?.();
  }

  const bodyConfig = config.body ?? options.body;
  if (bodyConfig) {
    if (typeof sprite.setBody === 'function') {
      sprite.setBody?.({
        type: 'rectangle',
        width: bodyConfig.width,
        height: bodyConfig.height,
      });
    } else {
      sprite.setRectangle?.(bodyConfig.width, bodyConfig.height);
    }
    if (bodyConfig.isSensor) {
      sprite.setSensor?.(true);
    }
  }

  const resolvedAbility = options.abilityType ?? config.defaultAbility;
  return new PassiveEnemy(scene, sprite, config.enemyType, {
    defaultHP: Math.max(1, options.maxHP ?? config.defaultHP ?? 1),
    defaultAbility: resolvedAbility,
    abilityType: resolvedAbility,
    getPlayerPosition: options.getPlayerPosition,
    maxHP: options.maxHP,
  });
}

export function createVineHopper(scene: Phaser.Scene, spawn: EnemySpawn, options: PlaceholderEnemyOptions = {}) {
  return createPlaceholderEnemy(
    scene,
    spawn,
    { enemyType: 'vine-hopper', defaultAbility: 'leaf', textureKey: 'vine-hopper', displayName: 'Vine Hopper' },
    options,
  );
}

export function createThornRoller(scene: Phaser.Scene, spawn: EnemySpawn, options: PlaceholderEnemyOptions = {}) {
  return createPlaceholderEnemy(
    scene,
    spawn,
    {
      enemyType: 'thorn-roller',
      defaultAbility: 'spike',
      textureKey: 'thorn-roller',
      displayName: 'Thorn Roller',
      body: { width: 40, height: 32 },
    },
    options,
  );
}

export function createSapSpitter(scene: Phaser.Scene, spawn: EnemySpawn, options: PlaceholderEnemyOptions = {}) {
  return createPlaceholderEnemy(
    scene,
    spawn,
    {
      enemyType: 'sap-spitter',
      defaultAbility: 'sticky',
      textureKey: 'sap-spitter',
      displayName: 'Sap Spitter',
      body: { width: 32, height: 28 },
    },
    options,
  );
}

export function createChillWisp(scene: Phaser.Scene, spawn: EnemySpawn, options: PlaceholderEnemyOptions = {}) {
  return createPlaceholderEnemy(
    scene,
    spawn,
    {
      enemyType: 'chill-wisp',
      defaultAbility: 'ice',
      textureKey: 'chill-wisp',
      displayName: 'Chill Wisp',
      ignoreGravity: true,
      scale: 0.75,
    },
    options,
  );
}

export function createGlacierGolem(scene: Phaser.Scene, spawn: EnemySpawn, options: PlaceholderEnemyOptions = {}) {
  return createPlaceholderEnemy(
    scene,
    spawn,
    {
      enemyType: 'glacier-golem',
      defaultAbility: 'guard',
      textureKey: 'glacier-golem',
      displayName: 'Glacier Golem',
      scale: 1.1,
      body: { width: 48, height: 56 },
      defaultHP: 3,
    },
    options,
  );
}

export function createFrostArcher(scene: Phaser.Scene, spawn: EnemySpawn, options: PlaceholderEnemyOptions = {}) {
  return createPlaceholderEnemy(
    scene,
    spawn,
    {
      enemyType: 'frost-archer',
      defaultAbility: 'ice-arrow',
      textureKey: 'frost-archer',
      displayName: 'Frost Archer',
      body: { width: 30, height: 46 },
    },
    options,
  );
}

export function createEmberImp(scene: Phaser.Scene, spawn: EnemySpawn, options: PlaceholderEnemyOptions = {}) {
  return createPlaceholderEnemy(
    scene,
    spawn,
    {
      enemyType: 'ember-imp',
      defaultAbility: 'fire',
      textureKey: 'ember-imp',
      displayName: 'Ember Imp',
      ignoreGravity: true,
      scale: 0.8,
    },
    options,
  );
}

export function createMagmaCrab(scene: Phaser.Scene, spawn: EnemySpawn, options: PlaceholderEnemyOptions = {}) {
  return createPlaceholderEnemy(
    scene,
    spawn,
    {
      enemyType: 'magma-crab',
      defaultAbility: 'magma-shield',
      textureKey: 'magma-crab',
      displayName: 'Magma Crab',
      body: { width: 42, height: 28 },
      scale: 0.9,
    },
    options,
  );
}

export function createBlazeStrider(scene: Phaser.Scene, spawn: EnemySpawn, options: PlaceholderEnemyOptions = {}) {
  return createPlaceholderEnemy(
    scene,
    spawn,
    {
      enemyType: 'blaze-strider',
      defaultAbility: 'dash-fire',
      textureKey: 'blaze-strider',
      displayName: 'Blaze Strider',
      scale: 0.95,
      body: { width: 40, height: 32 },
    },
    options,
  );
}

export function createStoneSentinel(scene: Phaser.Scene, spawn: EnemySpawn, options: PlaceholderEnemyOptions = {}) {
  return createPlaceholderEnemy(
    scene,
    spawn,
    {
      enemyType: 'stone-sentinel',
      defaultAbility: 'beam',
      textureKey: 'stone-sentinel',
      displayName: 'Stone Sentinel',
      scale: 1.05,
      body: { width: 52, height: 52 },
      defaultHP: 3,
    },
    options,
  );
}

export function createCurseBat(scene: Phaser.Scene, spawn: EnemySpawn, options: PlaceholderEnemyOptions = {}) {
  return createPlaceholderEnemy(
    scene,
    spawn,
    {
      enemyType: 'curse-bat',
      defaultAbility: 'curse',
      textureKey: 'curse-bat',
      displayName: 'Curse Bat',
      ignoreGravity: true,
      scale: 0.8,
    },
    options,
  );
}

export function createRelicThief(scene: Phaser.Scene, spawn: EnemySpawn, options: PlaceholderEnemyOptions = {}) {
  return createPlaceholderEnemy(
    scene,
    spawn,
    {
      enemyType: 'relic-thief',
      defaultAbility: 'warp',
      textureKey: 'relic-thief',
      displayName: 'Relic Thief',
      scale: 0.9,
      body: { width: 32, height: 36 },
    },
    options,
  );
}

export function createGaleKite(scene: Phaser.Scene, spawn: EnemySpawn, options: PlaceholderEnemyOptions = {}) {
  return createPlaceholderEnemy(
    scene,
    spawn,
    {
      enemyType: 'gale-kite',
      defaultAbility: 'wind',
      textureKey: 'gale-kite',
      displayName: 'Gale Kite',
      ignoreGravity: true,
      scale: 0.85,
    },
    options,
  );
}

export function createNimbusKnight(scene: Phaser.Scene, spawn: EnemySpawn, options: PlaceholderEnemyOptions = {}) {
  return createPlaceholderEnemy(
    scene,
    spawn,
    {
      enemyType: 'nimbus-knight',
      defaultAbility: 'thunder',
      textureKey: 'nimbus-knight',
      displayName: 'Nimbus Knight',
      ignoreGravity: true,
      scale: 1,
      body: { width: 42, height: 46 },
      defaultHP: 2,
    },
    options,
  );
}

export function createPrismWraith(scene: Phaser.Scene, spawn: EnemySpawn, options: PlaceholderEnemyOptions = {}) {
  return createPlaceholderEnemy(
    scene,
    spawn,
    {
      enemyType: 'prism-wraith',
      defaultAbility: 'prism',
      textureKey: 'prism-wraith',
      displayName: 'Prism Wraith',
      ignoreGravity: true,
      scale: 0.9,
    },
    options,
  );
}
