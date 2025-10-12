# タスク一覧

## 敵が1種類しかいない
- 現状把握: `src/game/scenes/index.ts:792` の `maintainEnemyPopulation` が `spawnWabbleBee` を固定呼び出ししており、`EnemyManager` の `spawnDrontoDurt`（`src/game/enemies/EnemyManager.ts:84`）が一度も使われていないため、敵バリエーションが増えない。
- [x] ステージごとに出現させたい敵種別と上限数を持てる設定（例: `public/assets/data/stage-layouts.json` あるいは新規 `src/game/world/stages/*.ts`）を設計・追加する。
- [x] `collectInitialEnemySpawns` および `maintainEnemyPopulation`（`src/game/scenes/index.ts:715` 付近と `:792` 付近）を拡張し、設定に基づいて `spawnWabbleBee` だけでなく他種も選択できるようにする。
- [x] 新しいスポーン制御をカバーするユニットテスト／統合テストを追加し、少なくとも異なる敵タイプが生成されることをレッド→グリーン→リファクタで保証する。
- [x] 必要に応じて `docs/design.md` など仕様ドキュメントを更新し、敵ラインナップ拡張方針を共有する。

## 引き寄せ後、下キー押下でタイトルに戻ってしまう
- 現状把握: 能力同期時に `AbilitySystem` が `kirdy.sprite.setTexture('kirdy', ...)` を呼ぶ (`src/game/mechanics/AbilitySystem.ts:72-114`) が、実際のアセットには `kirdy.png` が存在しないため（`public/assets/images` に未配置）、テクスチャ解決エラーで `ErrorHandler` がメニューに送出している。
- [x] アセットパイプライン (`src/game/assets/pipeline.ts`) と `public/assets/images` を整備し、`kirdy` ベーステクスチャまたは能力ごとの切り替え用テクスチャを正しく配置する（自動生成スクリプトの更新も含む）。
- [x] `AbilitySystem` の `onAcquire`/`onRemove` 実装を、存在確認とフォールバックを行う形に改修し、テクスチャ切替で例外が発生しないよう守る（TDD で再現→修正）。
- [x] `SwallowSystem` から能力同期した際に例外が出ないことを保証する回帰テスト（例: `src/game/mechanics/SwallowSystem.test.ts` の追加ケース）を作成する。

## 引き寄せ後、能力利用でタイトルに戻ってしまう
- 現状把握: 能力攻撃実行時に `context.kirdy.sprite.anims.play('kirdy-fire-attack')` などを呼ぶが、`registerAnimations` (`src/game/characters/Kirdy.ts:420` 付近) で該当アニメーションが生成されず、`Phaser` が例外を投げている。
- [x] `registerAnimations` に能力攻撃アニメーション（`kirdy-fire-attack` / `kirdy-ice-attack` / `kirdy-sword-attack` など）を追加するか、アニメーション存在確認を行って安全にフォールバックさせる。
- [x] 能力攻撃の実行フローをカバーする単体テスト（例: `src/game/mechanics/AbilitySystem.test.ts` に追加）を用意し、アニメーション生成またはフォールバックが機能することを検証する。
- [x] 必要であれば能力攻撃用テクスチャやスプライトシートの不足も同時に棚卸しし、パイプラインへ組み込む。

## 引き寄せのテクスチャがおかしい
- 現状把握: `InhaleSystem.ensureInhaleEffect` (`src/game/mechanics/InhaleSystem.ts:90-108`) が `'inhale-sparkle'` を読み込む前提だが、アセット定義 (`src/game/assets/pipeline.ts`) に同キーが存在せず、描画がフォールバック／破綻している。
- [x] `inhale-sparkle` 用のパーティクル画像（あるいはパーティクル設定 JSON）を追加し、パイプラインと `public/assets/images` に組み込む。
- [x] エフェクト生成時にテクスチャ存在チェックを追加し、欠落時は安全な代替エフェクトに切り替える処理を TDD で実装する。
- [x] `InhaleSystem.test.ts` にパーティクル取得が成功するケースおよびフォールバックケースを追加し、リグレッションを防ぐ。

## マップや配置をステージ固有ファイルへ分割したい
- 現状把握: `AreaManager` の `createDefaultAreaDefinitions` (`src/game/world/AreaManager.ts:612` 以降) に全ステージレイアウトが直書きされており、将来的な拡張が行いづらい。別途 `public/assets/data/stage-layouts.json` が存在するが未利用。
- [x] ステージ定義をモジュール単位（例: `src/game/world/stages/central-hub.ts`）へ分割するか、既存 JSON を読み込む仕組みを導入する設計をまとめる。
- [x] `AreaManager` を改修し、新しいステージデータソースからエリア定義を構築するようリファクタリングする（既存の遷移ロジック・探索状況保存を回帰テストで守る）。
- [x] `AreaManager.test.ts` などに新データソース対応のテストを追加し、ステージ切替・復元が動作することを確認する。
- [x] ステージ仕様整理のため、必要に応じて `docs/requirements.md` や新しい仕様書に拡張方針を記述する。
