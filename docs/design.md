# デザイン文書

## 概要

Kirdyの大迷宮ゲームは、HTML5 CanvasとPhaser.jsフレームワークを使用したWebベースの2Dプラットフォーマーゲームです。核となる要素（引き寄せ、敵能力利用、ホバリング、迷宮探索）を再現しながら、Web技術に最適化された実装を提供します。

## アーキテクチャ

### 全体構成

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Game Engine   │    │  Asset Manager  │    │  Input Manager  │
│   (Phaser.js)   │◄──►│   (Preloader)   │◄──►│   (Keyboard)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Scene Manager  │    │  Physics Engine │    │   UI Manager    │
│   (Game States) │◄──►│   (Matter.js)   │◄──►│   (HUD/Menu)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Game Objects   │    │  Collision Sys  │    │  Save Manager   │
│ (Kirdy/Enemies) │◄──►│  (Detection)    │◄──►│ (LocalStorage)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 技術スタック

- **フロントエンド**: HTML5, CSS3, JavaScript (ES6+)
- **ゲームエンジン**: Phaser.js 3.x
- **物理エンジン**: Matter.js (Phaser統合版)
- **ビルドツール**: Webpack/Vite
- **開発ツール**: ESLint, Prettier
- **デプロイ**: 静的ホスティング対応

## コンポーネントとインターフェース

### 1. ゲームシーンシステム

```javascript
// シーン構成
class BootScene extends Phaser.Scene {
  // 初期化とアセット読み込み
}

class MenuScene extends Phaser.Scene {
  // メインメニュー
}

class GameScene extends Phaser.Scene {
  // メインゲームプレイ
}

class PauseScene extends Phaser.Scene {
  // ポーズメニュー
}

class SettingsScene extends Phaser.Scene {
  // 設定オーバーレイ
}
```

### 2. Kirdyキャラクターシステム

```javascript
class Kirdy extends Phaser.GameObjects.Sprite {
  constructor(scene, x, y) {
    // 基本プロパティ
    this.health = 100;
    this.currentAbility = null;
    this.isHovering = false;
    this.pulledEnemy = null; // 引き寄せて拘束中の敵
    this.linkState = 'idle'; // 敵能力利用の状態管理
  }
  
  // 基本アクション
  move(direction) { /* 移動処理 */ }
  jump() { /* ジャンプ処理 */ }
  startHover() { /* ホバリング開始 */ }
  startPull() { /* 引き寄せ開始 */ }
  maintainPull() { /* 引き寄せ中の敵を固定 */ }
  releasePull() { /* 引き寄せ解除 */ }
  syncEnemyAbility() { /* 敵能力利用の準備 */ }
  useEnemyAbility() { /* 敵能力を発動 */ }
}
```

### 3. 能力システム

```javascript
class AbilitySystem {
  static abilities = {
    FIRE: {
      name: 'Fire',
      attack: 'fireball',
      color: '#FF4444',
      damage: 20
    },
    ICE: {
      name: 'Ice',
      attack: 'icebeam',
      color: '#4444FF',
      damage: 15,
      effect: 'freeze'
    },
    SWORD: {
      name: 'Sword',
      attack: 'slash',
      color: '#FFFF44',
      damage: 25
    }
  };
  
  static linkEnemyAbility(enemy) { /* 敵能力リンク処理 */ }
  static executeEnemyAbility(link, kirdy) { /* 敵能力発動 */ }
}
```

#### テクスチャとアニメーションのフォールバック

- 能力獲得時は `trySetKirdyTexture` で `scene.textures` を参照し、`kirdy-fire` / `kirdy-ice` / `kirdy-sword` にフォールバックする。ベースフレームが欠落しても例外を投げない。
- 能力攻撃のアニメーションキー（`kirdy-fire-attack` など）を `registerAnimations` で登録し、再生前に `scene.anims.exists` を確認して安全にスキップできるようにした。
- 新規テクスチャはアセットパイプラインに登録し、`AbilitySystem.test.ts` でフォールバックとアニメーションの有無を検証する。

### 4. 敵管理システム

```javascript
class EnemyManager {
  constructor(scene) {
    this.enemies = [];
    this.maxEnemies = 3; // Kirdyに優しい制限
    this.spawnCooldown = 2000; // 2秒間隔
  }
  
  spawnEnemy(type, x, y) {
    if (this.enemies.length >= this.maxEnemies) return;
    // 敵生成処理
  }
  
  checkProximity(kirdy) {
    // Kirdyの周囲2体制限チェック
    const nearbyEnemies = this.enemies.filter(enemy => 
      Phaser.Math.Distance.Between(kirdy.x, kirdy.y, enemy.x, enemy.y) < 100
    );
    
    if (nearbyEnemies.length >= 2) {
      this.disperseEnemies(kirdy);
    }
  }
}
```

#### ステージ別スポーン構成

- `src/game/world/stages/*.ts` に各エリアのレイアウトと `enemySpawns` 設定を切り出し、上限数や出現比率をステージ単位で管理する。
- `GameScene` の自動スポーンは構成されたエントリ（例: Wabble Bee 2体 + Dronto Durt 1体）をローテーションし、`EnemyManager` の型別アクティブ数を確認してから出現させる。
- ユニットテスト `GameScene.kirdy.test.ts` の「ステージ設定に従って異なるタイプの敵を自動スポーンする」でマルチタイプ出現を保証する。

### 5. 入力管理

```javascript
class PlayerInputManager {
  constructor(scene) {
    this.keyboard = scene.input.keyboard;
    this.touchControls = this.createTouchControls();
  }
}
```

- **キーボード**: 移動は `←/→` と `A/D` をマージし、ジャンプ／ホバリングは `SPACE/↑/W` に統合。引き寄せ開始（`C`）、リンク維持（`S/↓`）、敵能力利用（`Z`）、リンク解除（`X`）といったアクションキーを登録する。
- **仮想コントロール**: モバイル向けに `virtual-controls` スプライトからタイルを切り出して構築する。左下に固定したDパッドが `左/右/上/下` を提供し、下方向は吸収 (`↓/S`) と連動する。
- **右側アクション配置**: 右端には `敵能力利用 → リンク解除 → 引き寄せ開始` の順で左下から右上へ斜めになる三角配置を採用し、物理キー `Z/X/C` と一致する。各ボタンは押下時にアルファ値を下げてフィードバックを与える。
- **スナップショット**: タッチ状態とキーボード状態を統合し、`PlayerInputSnapshot` に変換してKirdyとアクション入力へ提供する。

#### 引き寄せエフェクトのフォールバック

- `InhaleSystem.ensureInhaleEffect` は `scene.textures` を確認し、`inhale-sparkle` → `kirdy-inhale` → `kirdy` の順で利用可能な粒子テクスチャを選択する。
- どのテクスチャも利用できない場合はパーティクル生成をスキップし、ゲームプレイを継続する。
- `InhaleSystem.test.ts` にフォールバックと非生成のケースを追加し、欠損アセットでタイトルに戻らないことを保証する。

### 6. 設定オーバーレイ

- `SettingsScene` はメニューまたはポーズ状態から `SceneManager.launch` で起動し、MenuScene では呼び出し元を `pause` したまま、PauseScene では親シーンを動作させたまま中央に設定パネルをオーバーレイ表示する。
- ポーズシーン経由で開く場合は `overlayManagedByParent` フラグを立て、ブラーやオーバーレイ深度の管理を PauseScene に委譲する。MenuScene など単独起動時は SettingsScene 自身が `GameScene.activateMenuOverlay`/`deactivateMenuOverlay` を直接呼び、呼び出し元へ復帰する時点でブラーを解除する。
- PauseScene は設定オーバーレイを表示している間もアクティブで、ESC 1 回目で設定を閉じて PauseScene にフォーカスを戻し、2 回目でゲームを再開する。各ショートカット（`O` キーなど）は設定クローズ時に再登録し、常に PauseScene の子操作として扱う。
- GPU のポストエフェクトパイプラインが利用できないレンダラー（Canvas フォールバックなど）では、`GameScene` がキャンバススナップショットを取得してぼかし描画を生成し、PauseScene/SettingsScene のテキストより背面に配置する。これにより WebGL が無効な環境でも背景をソフトにぼかした状態で各オーバーレイを表示できる。
- キーボードショートカット:
  - `LEFT` / `RIGHT`: マスターボリュームを 10% 刻みで増減し、`AudioManager`へ即時反映する。
  - `UP` / `DOWN`: 難易度プリセット（`easy` / `normal` / `hard`）を循環させ、`SaveManager` のスナップショットへ記録する。
  - `C`: 操作スキーム（`keyboard` / `touch` / `controller`）を切り替え、`PlayerInputManager.setControlScheme` でタッチ UI の表示状態を更新する。
  - `ESC`: オーバーレイを閉じて呼び出し元シーンを再開する。
- すべての変更は `SaveManager.updateSettings` を通じて即時に LocalStorage へ保存され、`GameScene` は `settings-updated` グローバルイベントを購読して音量や入力スキームを再適用する。
- MenuScene は `O` キーで設定、`R` キーで初期位置リセットを案内し、PauseScene からも同じショートカットで設定オーバーレイを開ける。
- PauseScene が前面にある間は GameScene のメインカメラへ post-processing ブラーを追加し、SettingsScene クローズ時には PauseScene 側で深度を 1 だけ戻しつつ `settings-overlay-closed` 通知でキー入力を再バインドする。Canvas レンダラーではスナップショットベースの疑似ブラーを描画し、`deactivateMenuOverlay` が呼ばれたタイミングで破棄する。

### 7. マップシステム

`MapSystem` は 100 以上のエリア定義（迷宮ノード）を有機的に接続し、進行度・発見情報・ゴール遷移を一元管理する。各エリアは `AreaDefinition` で宣言され、`AreaManager` 経由で Phaser 上のタイルマップ・敵・アイテム・扉を生成する。

#### 7.1 扉周囲の安全ポップ
- すべての扉タイルには `doorId` と中心座標が付与され、チェビシェフ距離 1（3×3 グリッド）を「安全リング」として予約する。
- `MapSystem.enforceDoorSpawnConstraints` はエリアロード・復活・再配置時に安全リング内のタイルをスポーン候補から除外し、`PlayerSpawner` へ許可済み座標リストを引き渡す。
- ゴール扉・隠し扉を含む全ての扉が対象で、将来の扉半径拡張を見越して `doorSafeRadius` をデータ駆動で持つ。

#### 7.2 デッドエンドへの回復配置
- `AreaDefinition.deadEnds` には次数 1 の行き止まりタイル座標を列挙し、最低 1 つの回復アイテム（`health`, `max-health`, `revive`）を保証する。
- `MapSystem.scatterDeadEndHeals` が行き止まり判定と空きタイル検索を担い、既存アイテムと重複しない位置を `ItemSpawner` に指示する。
- DeadEnd 情報はミニマップ上でも緑色アイコンで示し、探索完了判定にも利用する。

#### 7.3 迷宮規模と密度
- 迷宮は 5 クラスタ（hub / forest / ice / fire / ruins）× 25〜30 エリアで構成し、ビルド時点で最低 128 個のユニークエリアを提供する。
- 各エリアは `AreaDefinition.metadata.index` を持ち、`MapSystem` は index をもとにストーリーシードからルートを抽出する。ルート上に同一エリアが 1 度しか現れないよう `discoveredAreas` をチェックする。
- バイオーム内で 20% 以上が支路（デッドエンド）となるよう、定義段階で次数チェックを CI へ追加する。
- Forest / Ice / Fire / Ruins の各クラスタ終端には固定マップ（Forest / Ice / Fire / Ruins Reliquary）を必ず接続し、分岐探索のゴールと Keystone 収納室を兼ねる。リリクアリは `STAGE_DEFINITIONS` で固定 ID を持ち、Procedural Expanse の最後の `neighbors.east` がそれぞれを指す。Ruins Reliquary からのみ Sky Expanse への南扉が開く。

#### 7.4 ゴール扉とリザルト表示
- ゴールエリア（例: `goal-sanctuary`）には専用テクスチャ `goal-door` を割り当て、通常扉とは別スプライトシートで描画する。
- プレイヤーがゴール扉のヒットボックスに触れると、`GoalDoorController` が `score`（`GameState.player.score`）と `elapsedTimeMs`（`RunTimer`）を収集し、HUD オーバーレイに即時表示する。
- リザルトオーバーレイには「スコア」「クリアタイム」「残機ボーナス」を含め、キー入力か 3 秒経過で `ResultsScene` へ遷移する。

#### 7.5 クラス構成

```ts
class MapSystem {
  constructor(tileSize = 16) {
    this.areas = new Map();
    this.currentArea = 'central-hub';
    this.discoveredAreas = new Set(['central-hub']);
    this.goalAreaId = 'goal-sanctuary';
    this.goalDoorTexture = 'goal-door';
    this.doorSafeRadius = 1;
  }

  loadArea(areaId, spawnDoorId) { /* エリア読み込み */ }
  transitionToArea(areaId, doorId) { /* エリア遷移 */ }
  updateDiscovery(x, y) { /* 探索状況更新 */ }
  enforceDoorSpawnConstraints(areaId) { /* 扉周囲 1 マスをスポーン禁止にする */ }
  scatterDeadEndHeals(areaId) { /* 行き止まりに回復アイテムを配置 */ }
  checkGoalContact(playerSprite) { /* ゴール扉接触時にスコアとタイムを表示 */ }
}
```

## データモデル

### ゲーム状態

```javascript
const GameState = {
  player: {
    position: { x: 0, y: 0 },
    health: 100,
    ability: null,
    pulledEnemyId: null,
    score: 0
  },
  world: {
    currentArea: 'central-hub',
    discoveredAreas: [],
    completedAreas: [],
    collectedItems: [],
    goal: {
      areaId: 'goal-sanctuary',
      doorTexture: 'goal-door',
      reached: false,
      lastResult: { score: 0, timeMs: 0 }
    }
  },
  run: {
    elapsedTimeMs: 0,
    lastDoorId: null
  },
  settings: {
    volume: 0.4,
    controls: 'keyboard', // or 'touch'
    difficulty: 'normal'
  }
};
```

### エリアデータ

```javascript
const AreaData = {
  'central-hub': {
    name: 'Central Hub',
    tilemap: 'central-hub-tilemap',
    background: 'hub-bg',
    cluster: 'hub',
    metadata: {
      index: 0,
      difficulty: 1,
      doorBuffer: 1
    },
    spawn: {
      initial: { x: 200, y: 360 }
    },
    doors: [
      { id: 'north', target: 'ice-area', texture: 'door-standard', position: { x: 480, y: 64 } },
      { id: 'east', target: 'fire-area', texture: 'door-standard', position: { x: 896, y: 256 } },
      { id: 'south', target: 'forest-area', texture: 'door-standard', position: { x: 480, y: 448 } },
      { id: 'west', target: 'cave-area', texture: 'door-standard', position: { x: 64, y: 256 } },
      { id: 'goal', target: 'goal-sanctuary', texture: 'goal-door', position: { x: 960, y: 256 }, type: 'goal' }
    ],
    enemies: [
      { type: 'waddle-dee', x: 200, y: 300 },
      { type: 'bronto-burt', x: 400, y: 200 }
    ],
    items: [
      { type: 'health', x: 150, y: 250 },
      { type: 'star', x: 350, y: 180 }
    ],
    deadEnds: [
      { x: 640, y: 384, reward: 'health' }
    ],
    goal: null
  },
  'goal-sanctuary': {
    name: 'Goal Sanctuary',
    tilemap: 'goal-sanctuary-tilemap',
    background: 'goal-bg',
    cluster: 'ruins',
    metadata: {
      index: 127,
      difficulty: 5,
      doorBuffer: 1,
      isGoal: true
    },
    doors: [
      { id: 'entry', target: 'ruins-27', texture: 'door-standard', position: { x: 64, y: 256 } }
    ],
    enemies: [],
    items: [],
    deadEnds: [],
    goal: {
      texture: 'goal-door',
      scoreBonus: 5000,
      resultOverlay: 'goal-results'
    }
  },
  // ... 126 以上の追加エリア定義
};
```

### ステージ定義モジュール化

- 実装では `src/game/world/stages/*.ts` に各エリアの `AreaDefinition` を配置し、レイアウト・隣接情報・敵スポーン設定をモジュール単位で管理する。
- `AreaManager` は `cloneStageDefinition` を介して定義をディープコピーし、ランタイムでの変更が他エリアへ波及しないようにしている。
- `AreaManager.stage-import.test.ts` ではモジュールモックを利用して差し替え定義を読み込み、外部データソースやエディタ連携を見据えた拡張性を検証する。

## エラーハンドリング

### 1. ゲーム実行時エラー

```javascript
class ErrorHandler {
  static handleGameError(error, scene) {
    console.error('Game Error:', error);
    
    // 重要でないエラーは続行
    if (error.type === 'ASSET_LOAD_FAILED') {
      scene.loadFallbackAsset();
      return;
    }
    
    // 致命的エラーは安全な状態に復帰
    if (error.type === 'CRITICAL_GAME_ERROR') {
      scene.scene.start('MenuScene');
      this.showErrorMessage('ゲームでエラーが発生しました。メニューに戻ります。');
    }
  }
}
```

### 2. セーブデータエラー

```javascript
class SaveManager {
  static saveGame(gameState) {
    try {
      const saveData = JSON.stringify(gameState);
      localStorage.setItem('kirdy-save', saveData);
    } catch (error) {
      console.warn('セーブに失敗しました:', error);
      // フォールバック: セッションストレージを使用
      sessionStorage.setItem('kirdy-save-temp', saveData);
    }
  }
  
  static loadGame() {
    try {
      const saveData = localStorage.getItem('kirdy-save') || 
                      sessionStorage.getItem('kirdy-save-temp');
      return saveData ? JSON.parse(saveData) : null;
    } catch (error) {
      console.warn('セーブデータの読み込みに失敗しました:', error);
      return null;
    }
  }
}
```

## テスト戦略

### 1. ユニットテスト

```javascript
// 能力システムのテスト例
describe('AbilitySystem', () => {
  test('should channel fire ability while enemy is tethered', () => {
    const fireEnemy = new Enemy('fire-type');
    const link = AbilitySystem.linkEnemyAbility(fireEnemy);
    expect(link.name).toBe('Fire');
    expect(link.damage).toBe(20);
  });
  
  test('should not exceed max enemies limit', () => {
    const enemyManager = new EnemyManager();
    for (let i = 0; i < 5; i++) {
      enemyManager.spawnEnemy('waddle-dee', 100, 100);
    }
    expect(enemyManager.enemies.length).toBe(3);
  });
});
```

### 2. 統合テスト

```javascript
// ゲームプレイフローのテスト
describe('Gameplay Integration', () => {
  test('should complete pull -> sync -> enemy ability use flow', async () => {
    const game = new TestGame();
    const kirdy = game.kirdy;
    const enemy = game.spawnEnemy('fire-type', 150, 300);
    
    // 引き寄せ
    kirdy.startPull();
    await game.waitForAnimation();
    expect(kirdy.pulledEnemy).toBe(enemy);
    
    // 敵能力同期
    kirdy.syncEnemyAbility();
    await game.waitForAnimation();
    expect(kirdy.currentAbility.name).toBe('Fire');
    
    // 敵能力を発動
    kirdy.useEnemyAbility();
    await game.waitForAnimation();
    expect(game.projectiles.length).toBe(1);
    expect(game.projectiles[0].type).toBe('fireball');
  });
});
```

### 3. パフォーマンステスト

```javascript
// フレームレート監視
class PerformanceMonitor {
  constructor() {
    this.frameCount = 0;
    this.lastTime = performance.now();
    this.fps = 60;
  }
  
  update() {
    this.frameCount++;
    const currentTime = performance.now();
    
    if (currentTime - this.lastTime >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastTime = currentTime;
      
      if (this.fps < 30) {
        console.warn('Low FPS detected:', this.fps);
        // パフォーマンス最適化の実行
        this.optimizePerformance();
      }
    }
  }
}
```

### 4. ユーザビリティテスト

- **操作性テスト**: 各キー入力の応答性確認
- **視覚的フィードバック**: アニメーションとエフェクトの適切性
- **難易度バランス**: 敵の配置と数の適切性
- **アクセシビリティ**: カラーブラインド対応、キーボード操作
