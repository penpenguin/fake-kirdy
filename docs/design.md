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

### 5. マップシステム

```javascript
class MapSystem {
  constructor() {
    this.areas = new Map();
    this.currentArea = 'central-hub';
    this.discoveredAreas = new Set();
  }
  
  loadArea(areaId) { /* エリア読み込み */ }
  transitionToArea(areaId) { /* エリア遷移 */ }
  updateDiscovery(x, y) { /* 探索状況更新 */ }
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
    collectedItems: []
  },
  settings: {
    volume: 0.8,
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
    enemies: [
      { type: 'waddle-dee', x: 200, y: 300 },
      { type: 'bronto-burt', x: 400, y: 200 }
    ],
    items: [
      { type: 'health', x: 150, y: 250 },
      { type: 'star', x: 350, y: 180 }
    ],
    exits: {
      'north': 'ice-area',
      'east': 'fire-area',
      'south': 'forest-area',
      'west': 'cave-area'
    }
  }
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
