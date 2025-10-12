# Aurora Spire 調査タスク

## 扉が機能していない
- [ ] `src/game/world/stages/aurora-spire.ts` の `layout` で `D` タイルの位置と `AreaManager` の `inferDoorDirectionForTile` 条件（端から1タイル以内）を実機で確認する
- [ ] `neighbors.west` と `sky-sanctum` 側の往復設定が揃っているか確認し、扉通過イベントが発火するまでデバッグログで追跡する
- [ ] `src/game/scenes/GameScene.kirdy.test.ts` を参考に、Aurora Spire 西扉通過の退行テストを追加して不具合を再現させる

## マップ構成が移動不能
- [ ] 現行 `layout` から `AreaManager` が算出する `totalWalkableTiles` を把握し、通路不足の原因（壁で塞がれている箇所）を特定する
- [ ] プレイヤーのスポーン位置からステージ中央・敵スポーン地点までの経路を確保できるように `layout` と `entryPoints` を再設計し、Phaser 上で移動検証する
- [ ] レイアウト更新後に敵スポーンが壁内に埋没しないこと、扉と隣接タイルが通行可能なことを実装確認する

## 吸い込み→Zキーで CRITICAL_GAME_ERROR
- [ ] 吸い込み状態から Z キー押下時の `SwallowSystem` / `InhaleSystem` フローを追跡し、`target.body?.position` 参照が `undefined` になる箇所を特定する
- [ ] `releaseCapturedTarget` 直後に `kirdy.getMouthContent()` が `undefined` になっていないか、同一フレーム内で破棄→再参照が起きていないかイベント順序を確認する
- [ ] 再発防止のための単体テストを追加し、エラーが `ErrorHandler` の CRITICAL ハンドリングに入らずグリーンになることを検証する

# HUD とアビリティ調査タスク

## アビリティアイコンのテクスチャ欠落 (Hud.ts:201)
- [ ] `Hud` の `applyAbilityIconTexture` が使用するテクスチャキー `kirdy` とフレーム `sword` / `fire` がアセット定義 (`src/game/assets` 配下やスプライトシート) に存在するか確認する
- [ ] Phaser のアトラス読み込み (`scene.load` まわり) で `kirdy` テクスチャがメニューとゲームシーンの両方で登録済みか、ロード順とキー衝突を調査する
- [ ] 能力習得イベント (`GameScene.handleAbilityAcquired`) から HUD 更新までのフローをトレースし、能力に応じたフレーム名解決処理を単体テストで再現させる

## アビリティ攻撃が敵にダメージを与えない
- [ ] `AbilitySystem` 各能力のダメージ付与処理が `PhysicsSystem.registerPlayerAttack` を通じて敵ヒット時に呼ばれるか、攻撃ごとにイベントログで確認する
- [ ] 敵側のダメージ受信処理 (`EnemyManager` / 個別敵クラス) がアビリティ発射物の `PhysicsCategory.PlayerAttack` を認識しているか衝突設定を精査する
- [ ] 能力付与後に敵 HP が減少することを検証する統合テストまたはモック戦闘テストを追加し、現象を再現→解消できるようにする

# メニュー / 設定画面調査タスク

## ユーザー設定が LocalStorage のみで UI が存在しない
- [ ] 既存の設定値格納ロジック（LocalStorage のキーと構造）を洗い出し、読み書きの責務を担うモジュールを把握する
- [ ] メニューから設定画面へ遷移する UI フローとシーン遷移（`MenuScene` など）の実装ポイントを特定し、遷移テストを追加する
- [ ] メニュー表示中はゲームシーンを一時停止し、背景にブラー処理を適用できるか Phaser の post-processing / camera effect を調査する
- [ ] メニューにキャラクター初期位置リセット操作を追加し、`AreaManager` や `PlayerSpawn` ロジックに副作用がないか確認する
- [ ] 設定画面で音量などを調整し LocalStorage に保存、ゲームシーンへ反映されることを UI テストまたは統合テストで検証する
