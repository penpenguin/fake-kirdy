# デザイン文書

## 概要

Kirdyの鏡の大迷宮ゲームは、HTML5 CanvasとPhaser.jsフレームワークを使用したWebベースの2Dプラットフォーマーゲームです。オリジナルの「星のカービィ 鏡の大迷宮」の核となる要素（吸い込み、能力コピー、ホバリング、迷宮探索）を再現しながら、Web技術に最適化された実装を提供します。

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
    this.mouthContent = null; // 吸い込んだ敵
  }
  
  // 基本アクション
  move(direction) { /* 移動処理 */ }
  jump() { /* ジャンプ処理 */ }
  startHover() { /* ホバリング開始 */ }
  inhale() { /* 吸い込み処理 */ }
  swallow() { /* 飲み込み処理 */ }
  spit() { /* 吐き出し処理 */ }
  useAbility() { /* 能力使用 */ }
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
  
  static copyAbility(enemy) { /* 能力コピー処理 */ }
  static executeAbility(ability, kirdy) { /* 能力実行 */ }
}
```

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
    mouthContent: null,
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
  test('should copy fire ability from fire enemy', () => {
    const fireEnemy = new Enemy('fire-type');
    const ability = AbilitySystem.copyAbility(fireEnemy);
    expect(ability.name).toBe('Fire');
    expect(ability.damage).toBe(20);
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
  test('should complete inhale -> swallow -> ability use flow', async () => {
    const game = new TestGame();
    const kirdy = game.kirdy;
    const enemy = game.spawnEnemy('fire-type', 150, 300);
    
    // 吸い込み
    kirdy.inhale();
    await game.waitForAnimation();
    expect(kirdy.mouthContent).toBe(enemy);
    
    // 飲み込み
    kirdy.swallow();
    await game.waitForAnimation();
    expect(kirdy.currentAbility.name).toBe('Fire');
    
    // 能力使用
    kirdy.useAbility();
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