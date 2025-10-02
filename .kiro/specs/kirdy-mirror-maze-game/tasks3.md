# 実装問題チェックリスト

- [x] 1. KirdyキャラクターシステムのAPI差異
  - `Kirdy` クラスがHPや能力を保持せず、`update` 依存の挙動に集約されている。
  - 仕様に示された `move/jump/startHover/inhale/swallow/spit/useAbility` などの明示的メソッドが未提供。
  - プレイヤー体力・スコアが `GameScene` 側に分散し、責務が設計から乖離している。

- [x] 2. 能力システムの設計不一致
  - `AbilitySystem.abilities` / `copyAbility` / `executeAbility` を追加し、`SwallowSystem` から静的API経由で能力メタデータを連携するように修正。
  - 敵やスプライトから能力タイプを抽出する共通インターフェースを提供し、Swallow → Ability の暗黙依存を解消。
  - 仕様準拠の能力カタログを公開し、外部からの再利用を可能にした。

- [x] 3. 敵管理のモジュール化不足
  - `EnemyManager` クラスがなく、敵配列とスポーン制御を `GameScene` が直接保持。
  - 最大数・出現間隔・周囲制限などのロジックがシーンに散在し、テスト容易性が低下。
  - 設計で想定された敵管理APIと乖離している。

- [x] 4. マップ／エリア構成の不足
  - 定義済みエリアが `central-hub` と `mirror-corridor` のみで、`ice-area` など仕様記載の領域が未実装。
  - 複数出口や迷宮探索の分岐を検証するテストが欠落。
  - 迷宮探索ゲームとしてのボリューム要件を満たしていない。

- [ ] 5. セーブデータ仕様の未対応項目
  - `GameState.settings`（音量・操作・難易度）や `world.completedAreas`/`collectedItems` を保存していない。
  - セーブ失敗時の `sessionStorage` フォールバック処理が未実装で警告のみ。
  - 永続化要件と耐障害性要件を満たせていない。

- [ ] 6. エラーハンドリングレイヤの欠如
  - 仕様に記載の `ErrorHandler.handleGameError` が存在せず、致命的エラー時のメニュー復帰が未対応。
  - BootSceneでのロードリトライ以外の統一的フォールバックがない。
  - 運用要件（安全な状態復帰・ユーザ通知）への準拠が不足している。
