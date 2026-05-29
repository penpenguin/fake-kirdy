import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AbilityType } from '../mechanics/AbilitySystem';
import { ABILITY_TYPES } from '../mechanics/AbilitySystem';
import { AREA_IDS } from '../world/AreaManager';
import type { AreaId } from '../world/AreaManager';
import { centralHub } from '../world/stages/central-hub';
import { SaveManager, type GameProgressSnapshot } from './SaveManager';

interface StorageMock {
  getItem: ReturnType<typeof vi.fn>;
  setItem: ReturnType<typeof vi.fn>;
  removeItem: ReturnType<typeof vi.fn>;
}

function createStorageMock(): StorageMock {
  return {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  } as const as StorageMock;
}

function createExploredTiles(overrides: Partial<Record<AreaId, string[]>> = {}): Record<AreaId, string[]> {
  return {
    [AREA_IDS.CentralHub]: [],
    [AREA_IDS.MirrorCorridor]: [],
    [AREA_IDS.IceArea]: [],
    [AREA_IDS.IceReliquary]: [],
    [AREA_IDS.FireArea]: [],
    [AREA_IDS.FireReliquary]: [],
    [AREA_IDS.ForestArea]: [],
    [AREA_IDS.ForestReliquary]: [],
    [AREA_IDS.CaveArea]: [],
    [AREA_IDS.RuinsReliquary]: [],
    [AREA_IDS.GoalSanctum]: [],
    [AREA_IDS.SkySanctum]: [],
    [AREA_IDS.AuroraSpire]: [],
    [AREA_IDS.StarlitKeep]: [],
    ...overrides,
  };
}

describe('SaveManager', () => {
  const key = 'kirdy-progress-test';
  let storage: StorageMock;
  let fallbackStorage: StorageMock;
  let saveManager: SaveManager;
  const nowStub = vi.fn(() => 1_699_999_999_000);

  const snapshot: GameProgressSnapshot = {
    player: {
      hp: 4,
      maxHP: 6,
      score: 1200,
      ability: 'fire',
      position: { x: 160, y: 360 },
    },
    area: {
      currentAreaId: AREA_IDS.MirrorCorridor,
      discoveredAreas: [AREA_IDS.CentralHub, AREA_IDS.MirrorCorridor],
    exploredTiles: createExploredTiles({
      [AREA_IDS.CentralHub]: ['2,3', '3,3'],
      [AREA_IDS.MirrorCorridor]: ['1,1'],
    }),
      lastKnownPlayerPosition: { x: 512, y: 224 },
      completedAreas: [AREA_IDS.CentralHub],
      collectedItems: ['star-shard', 'healing-fruit'],
    },
    settings: {
      volume: 0.65,
      controls: 'keyboard',
      difficulty: 'hard',
    },
  } satisfies GameProgressSnapshot;

  beforeEach(() => {
    storage = createStorageMock();
    fallbackStorage = createStorageMock();
    saveManager = new SaveManager({
      key,
      storage: storage as unknown as Storage,
      fallbackStorage: fallbackStorage as unknown as Storage,
      now: nowStub,
    });
  });

  it('進行状況をバージョン付きJSONとして保存する', () => {
    saveManager.save(snapshot);

    expect(storage.setItem).toHaveBeenCalledTimes(1);
    const [calledKey, payload] = storage.setItem.mock.calls[0];
    expect(calledKey).toBe(key);

    const parsed = JSON.parse(payload);
    expect(parsed).toMatchObject({
      version: 1,
      savedAt: nowStub(),
      data: {
        player: {
          hp: snapshot.player.hp,
          maxHP: snapshot.player.maxHP,
          score: snapshot.player.score,
          ability: snapshot.player.ability,
          position: snapshot.player.position,
        },
        area: {
          currentAreaId: snapshot.area.currentAreaId,
          discoveredAreas: snapshot.area.discoveredAreas,
          exploredTiles: snapshot.area.exploredTiles,
          lastKnownPlayerPosition: snapshot.area.lastKnownPlayerPosition,
          completedAreas: snapshot.area.completedAreas,
          collectedItems: snapshot.area.collectedItems,
        },
        settings: snapshot.settings,
      },
    });
  });

  it('保存済みデータを読み込み、未知の値を除外する', () => {
    const dirtyPayload = {
      version: 1,
      savedAt: nowStub(),
      data: {
        player: {
          hp: 100,
          maxHP: 999,
          score: 3200,
          ability: 'fire',
          position: { x: 42, y: 84 },
          glitch: true,
        },
        area: {
          currentAreaId: AREA_IDS.CentralHub,
          discoveredAreas: ['invalid-area', AREA_IDS.CentralHub],
          exploredTiles: {
            [AREA_IDS.CentralHub]: ['0,0', '1,1', 'bad-format'],
            unknown: ['2,2'],
          },
          lastKnownPlayerPosition: { x: 12, y: 34 },
          extra: 'value',
          completedAreas: ['wrong-land', AREA_IDS.CentralHub],
          collectedItems: ['star-shard', { id: 'oops' }, 'star-shard', 42],
        },
        settings: {
          volume: 2,
          controls: 'arcade-stick',
          difficulty: 'impossible',
        },
        unexpected: 'field',
      },
      checksum: '???',
    };

    storage.getItem.mockReturnValue(JSON.stringify(dirtyPayload));

    const result = saveManager.load();

    expect(result).toEqual({
      player: {
        hp: 100,
        maxHP: 999,
        score: 3200,
        ability: 'fire',
        position: { x: 42, y: 84 },
      },
      area: {
        currentAreaId: AREA_IDS.CentralHub,
        discoveredAreas: [AREA_IDS.CentralHub],
        exploredTiles: {
          [AREA_IDS.CentralHub]: ['0,0', '1,1'],
        },
        lastKnownPlayerPosition: { x: 12, y: 34 },
        completedAreas: [AREA_IDS.CentralHub],
        collectedItems: ['star-shard'],
      },
      settings: {
        volume: 1,
        controls: 'keyboard',
        difficulty: 'normal',
      },
    });
  });

  it('破損したデータを検出して削除し、undefinedを返す', () => {
    storage.getItem.mockReturnValue('not-json');

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = saveManager.load();

    expect(result).toBeUndefined();
    expect(storage.removeItem).toHaveBeenCalledWith(key);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('failed to parse'), expect.any(Error));

    warn.mockRestore();
  });

  it('進行状況を初期化しても設定を保持する', () => {
    const payload = {
      version: 1,
      savedAt: nowStub(),
      data: {
        player: snapshot.player,
        area: snapshot.area,
        settings: {
          volume: 0.75,
          controls: 'controller' as const,
          difficulty: 'hard',
        },
      },
    };
    storage.getItem.mockReturnValue(JSON.stringify(payload));

    saveManager.clearProgressPreservingSettings();

    expect(storage.setItem).toHaveBeenCalledTimes(1);
    const [, serialized] = storage.setItem.mock.calls.at(-1)!;
    const parsed = JSON.parse(serialized);

    expect(parsed).toMatchObject({
      data: {
        player: { hp: 6, maxHP: 6, score: 0 },
        area: { currentAreaId: AREA_IDS.CentralHub },
        settings: {
          volume: 0.75,
          controls: 'controller',
          difficulty: 'hard',
        },
      },
    });
  });

  it('ストレージ書き込みが例外を投げてもエラーを伝播しない', () => {
    const error = new Error('quota exceeded');
    storage.setItem.mockImplementation(() => {
      throw error;
    });

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(() => saveManager.save(snapshot)).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('failed to save'), error);

    warn.mockRestore();
  });

  it('ローカルストレージに保存できない場合はフォールバックストレージへ保存し、読み込み時にも利用する', () => {
    const error = new Error('quota exceeded');
    const fallbackStorage = createStorageMock();

    storage.setItem.mockImplementation(() => {
      throw error;
    });

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const manager = new SaveManager({
      key,
      storage: storage as unknown as Storage,
      fallbackStorage: fallbackStorage as unknown as Storage,
      now: nowStub,
    });

    manager.save(snapshot);

    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(fallbackStorage.setItem).toHaveBeenCalledTimes(1);

    const [fallbackKey, fallbackPayload] = fallbackStorage.setItem.mock.calls[0];
    expect(fallbackKey).toBe(`${key}:fallback`);

    storage.getItem.mockReturnValueOnce(null);
    fallbackStorage.getItem.mockReturnValueOnce(fallbackPayload);

    const loaded = manager.load();

    expect(fallbackStorage.getItem).toHaveBeenCalledWith(`${key}:fallback`);
    expect(loaded).toEqual(JSON.parse(fallbackPayload).data);

    warn.mockRestore();
  });

  it('サポートされないバージョンのデータはマイグレーションされない場合に破棄される', () => {
    storage.getItem.mockReturnValue(
      JSON.stringify({
        version: 0,
        savedAt: nowStub(),
        data: { legacy: true },
      }),
    );

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = saveManager.load();

    expect(result).toBeUndefined();
    expect(storage.removeItem).toHaveBeenCalledWith(key);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('unsupported save version'), 0);

    warn.mockRestore();
  });

  it('指定のマイグレーション関数で旧バージョンのデータを変換して読み込む', () => {
    const migratedSnapshot: GameProgressSnapshot = {
      player: {
        hp: 3,
        maxHP: 6,
        score: 450,
        ability: 'ice',
        position: { x: 10, y: 20 },
      },
      area: {
        currentAreaId: AREA_IDS.CentralHub,
        discoveredAreas: [AREA_IDS.CentralHub],
        exploredTiles: createExploredTiles({
          [AREA_IDS.CentralHub]: ['0,0'],
        }),
        lastKnownPlayerPosition: { x: 10, y: 20 },
        completedAreas: [AREA_IDS.CentralHub],
        collectedItems: [],
      },
      settings: {
        volume: 0.5,
        controls: 'keyboard',
        difficulty: 'normal',
      },
    };

    storage.getItem.mockReturnValue(
      JSON.stringify({
        version: 0,
        savedAt: nowStub(),
        data: { playerHealth: 3, score: 450, area: AREA_IDS.CentralHub },
      }),
    );

    const migration = vi.fn(() => migratedSnapshot);

    const migratableManager = new SaveManager({
      key,
      storage: storage as unknown as Storage,
      now: nowStub,
      migrations: new Map([[0, migration]]),
    });

    const result = migratableManager.load();

    expect(migration).toHaveBeenCalledTimes(1);
    expect(result).toEqual(migratedSnapshot);
  });

  it('AbilityTypeとAreaIdのバリデーションを行う', () => {
    const invalidSnapshot = {
      version: 1,
      savedAt: nowStub(),
      data: {
        player: {
          hp: 5,
          maxHP: 6,
          score: 0,
          ability: 'invalid-ability',
          position: centralHub.entryPoints.default.position,
        },
        area: {
          currentAreaId: 'strange-land',
          discoveredAreas: ['strange-land'],
          exploredTiles: {},
          lastKnownPlayerPosition: centralHub.entryPoints.default.position,
        },
      },
    };

    storage.getItem.mockReturnValue(JSON.stringify(invalidSnapshot));

    const result = saveManager.load();

    expect(result).toEqual({
      player: {
        hp: 5,
        maxHP: 6,
        score: 0,
        ability: undefined,
        position: centralHub.entryPoints.default.position,
      },
      area: {
        currentAreaId: AREA_IDS.CentralHub,
        discoveredAreas: [],
        exploredTiles: {},
        lastKnownPlayerPosition: centralHub.entryPoints.default.position,
        completedAreas: [],
        collectedItems: [],
      },
      settings: {
        volume: 0.4,
        controls: 'keyboard',
        difficulty: 'normal',
      },
    });
  });

  it('AbilityTypeの制約が変わっても検証関数を共有する', () => {
    const invalidAbility = 'super-fire';
    expect((ABILITY_TYPES as readonly AbilityType[]).includes(invalidAbility as AbilityType)).toBe(false);
  });

  it('resets player spawn position while preserving other progress', () => {
    const payload = {
      version: 1,
      savedAt: nowStub(),
      data: snapshot,
    } satisfies { version: number; savedAt: number; data: GameProgressSnapshot };

    storage.getItem.mockReturnValueOnce(JSON.stringify(payload));

    saveManager.resetPlayerPosition();

    const setCall = storage.setItem.mock.calls.find(([callKey]) => callKey === key);
    expect(setCall).toBeDefined();
    const [, serialized] = setCall ?? [];
    const saved = JSON.parse(serialized as string) as { data: GameProgressSnapshot };

    expect(saved.data.player.position).toEqual(centralHub.entryPoints.default.position);
    expect(saved.data.area.lastKnownPlayerPosition).toEqual(centralHub.entryPoints.default.position);
    expect(saved.data.area.currentAreaId).toBe(AREA_IDS.CentralHub);
    expect(saved.data.player.score).toBe(snapshot.player.score);
    expect(saved.data.settings.volume).toBe(snapshot.settings.volume);
  });

  describe('updateSettings', () => {
    it('設定値を更新しつつ既存のプレイヤーとエリア情報を保持する', () => {
      const payload = {
        version: 1,
        savedAt: nowStub(),
        data: snapshot,
      };
      storage.getItem.mockReturnValueOnce(JSON.stringify(payload));

      const result = saveManager.updateSettings({
        volume: 0.25,
        controls: 'touch',
        difficulty: 'hard',
      });

      expect(result).toEqual({
        volume: 0.25,
        controls: 'touch',
        difficulty: 'hard',
      });

      expect(storage.setItem).toHaveBeenCalled();
      const [, serialized] = storage.setItem.mock.calls.at(-1)!;
      const saved = JSON.parse(serialized);

      expect(saved.data.player).toEqual(snapshot.player);
      expect(saved.data.area).toEqual(snapshot.area);
      expect(saved.data.settings).toEqual({
        volume: 0.25,
        controls: 'touch',
        difficulty: 'hard',
      });
    });

    it('無効な入力を正規化して保存し、正規化後の設定を返却する', () => {
      const payload = {
        version: 1,
        savedAt: nowStub(),
        data: snapshot,
      };
      storage.getItem.mockReturnValueOnce(JSON.stringify(payload));

      const result = saveManager.updateSettings({
        volume: 2.5,
        controls: 'arcade-stick' as any,
        difficulty: 'impossible' as any,
      });

      expect(result).toEqual({
        volume: 1,
        controls: 'keyboard',
        difficulty: 'normal',
      });

      const [, serialized] = storage.setItem.mock.calls.at(-1)!;
      const saved = JSON.parse(serialized);
      expect(saved.data.settings).toEqual({
        volume: 1,
        controls: 'keyboard',
        difficulty: 'normal',
      });
    });
  });
});
