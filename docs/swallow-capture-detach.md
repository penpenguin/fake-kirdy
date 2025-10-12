# 吸い込み中敵スプライト分離仕様

## 背景

現在の吸い込み処理では、敵スプライトを `InhaleSystem` が捕捉した後も以下の問題が残っている。

- `EnemyManager` が敵 AI を更新し続けるため、不可視状態の敵が移動・速度更新を行い、Kirdy の口内位置から逸脱することがある。
- `PhysicsSystem` では敵スプライトが依然として敵カテゴリとして登録されたままで、プレイヤー衝突や攻撃ヒット検知の対象になり続ける。
- UI/HUD は吸い込み後の状態変化（能力獲得／アイテム化）と連動していない。

これにより吸い込み完了前後のタイミングで不安定な挙動やクラッシュが発生するため、物理衝突と AI 更新から切り離す設計が必要。

## 要件

1. 吸い込み開始時に捕捉した敵スプライトを物理衝突監視および AI 更新対象から外すこと。
2. 捕捉されたスプライトは Kirdy に追従し、他オブジェクトと干渉しないこと。
3. SwallowSystem が吸い込み完了時に敵を即座にアイテム／能力ステータスへ変換し、HUD を更新すること。
4. 仕様の挙動を単体テスト・統合テストで保証すること。

## 設計概要

### 1. イベント駆動の捕捉通知

- `InhaleSystem` がターゲットを捕捉した時に `scene.events.emit('enemy-captured', { sprite })` を発火する。
- 吸い込み解除時（`releaseCapturedTarget`）には `scene.events.emit('enemy-capture-released', { sprite })` を発火して後続処理に通知する。

### 2. EnemyManager のサスペンド機構

- `EnemyManager` に `suspendEnemy(sprite)` / `resumeEnemy(sprite)` を追加し、捕捉された敵を更新ループから除外する。
- サスペンドされた敵は `enemies` 配列に残しつつ `suspendedEnemies` Set で管理し、`update` 内で AI 処理をスキップする。
- サスペンド中は `InhaleSystem` だけが座標を制御するため、`EnemyManager` 側から `sprite` の速度を 0 にする。

### 3. PhysicsSystem の衝突切り離し

- `PhysicsSystem` に `suspendEnemy(sprite)` を追加し、`enemyByObject` マップから除外すると同時に `setCollidesWith(0)` で衝突対象を外す。
- 再開が必要な場合（吸い込みに失敗し解放された場合）に備え `resumeEnemy(sprite)` を用意し、再登録時は既存メソッド `registerEnemy` を再使用する。

### 4. SwallowSystem のアイテム化

- `handleSwallow` で敵データを `SwallowedPayload` に変換した直後に `scene.events.emit('enemy-swallowed', { sprite, ability })` を発火。
- `GameScene` がこのイベントを受けて HUD を更新し、必要なテクスチャをロード／差し替える。
- 追加で `scene.events.emit('enemy-consumed', { sprite })` を発火して `EnemyManager` / `PhysicsSystem` がサスペンド状態のクリーンアップを行えるようにする。

### 5. HUD とテクスチャ更新

- HUD に能力用アイコンスプライト（fallback テクスチャ付き）を追加し、SwallowSystem からのペイロードで更新する。
- 既存のテキスト表示は残しつつ、アイコンの可視化とフォールバック処理を `Hud` クラスへ追加する。

## テスト戦略

1. **単体テスト**
   - `InhaleSystem`：捕捉時に `enemy-captured` が発火し、捕捉対象が Kirdy に追従すること。
   - `EnemyManager`：`suspendEnemy` 呼び出しで AI 更新が停止し、再開で復元されること。
   - `PhysicsSystem`：`suspendEnemy` により `registerPlayerAttack` イベント対象から外れること。
   - `SwallowSystem`：捕捉直後に `enemy-swallowed` を通知し、HUD 更新フローが実行されること。
   - `Hud`：アイコン表示にフォールバックが機能すること。
2. **統合テスト**
   - `GameScene`：敵を吸い込み → Swallow までのシナリオでイベント連携・HUD 更新・敵除去が一貫して行われること。
   - 放出（spit）時のクラッシュ原因を再現し、ゲームループ継続を検証するエンドツーエンドテストを追加。

## レビュー記録

- 2025-10-12: 仕様策定（担当: Codex エージェント）
- 2025-10-12: 自己レビュー & テスト計画チェック（TDD 観点で確認済み）
- 今後: 実装後に Vitest テストスイート結果を添付して動作レビューを実施予定
