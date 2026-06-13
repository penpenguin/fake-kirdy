# Goal

## Objective
Godot mainline のゲーム画面を、HUDの意味、攻撃エフェクト、敵HP、ステージ背景、扉配置/見た目、1ブロック基準のサイズ感、Results後の継続、effects asset使用状況まで含めて、ユーザーが迷わず遊べる状態にする。

## Context
Fake Kirdy は Godot 4 が canonical runtime。ユーザーから、現在の体験には以下の問題が残っている。

- HUD の各項目が何を表すか分かりづらい。
- Spark 攻撃時に青い棒が出ており、攻撃エフェクトとして不自然。
- 雑魚敵のHPが基本値として高すぎる。雑魚敵は基本 HP 1、ボス/中ボスは例外にしたい。
- 各ステージに相応しい背景が不足している。
- `central_hub` の扉配置が不親切で、扉の下に足場がない箇所がある。
- 鍵付きドアが通常ドアと見分けづらく、封印された扉に見えない。
- 扉、アイテム、雑魚敵、自キャラなどの基本表示サイズをブロック1マス分に揃えたい。
- Results 表示後にコンテニューできない。コンテニュー時は `central_hub` に戻ればよい。
- `godot/resources/assets/images/effects` にあるエフェクト画像が全て対応アクションで使われている状態にしたい。

[Assumption] 「ステージ」は全 `labyrinth_001` から `labyrinth_132` の個別背景ではなく、主要ステージ/バイオーム/クラスタ単位を指す。生成ステージは forest / ice / fire / ruins / sky などのクラスタ背景を継承する。146個以上の個別背景が必要な場合は実装前に停止する。

[Assumption] 「ブロック1マス」は既存Godotレベルの実質タイルサイズである 64px 前後を基準にし、当たり判定ではなく見た目の代表サイズとして扱う。

[Assumption] SubAgent と ImageGen の使用は許可済み。Spark攻撃エフェクトとステージ背景/鍵付き扉画像の改善では ImageGen を使用してよい。SubAgent は視覚監査、アセット利用監査、実装レビューなどの bounded task に使ってよい。

## Scope
変更してよい範囲:

- `GOAL.md`、必要に応じた作業メモ `ATTEMPTS.md`
- `docs/godot-v2/**`
- `godot/project.godot`
- `godot/scenes/**`
- `godot/scripts/**`
- `godot/levels/**`
- `godot/resources/assets/asset_manifest.json`
- `godot/resources/assets/images/characters/**`
- `godot/resources/assets/images/effects/**`
- `godot/resources/assets/images/enemies/**`
- `godot/resources/assets/images/items/**`
- `godot/resources/assets/images/ui/**`
- `godot/resources/assets/images/world/**`
- `godot/tests/**`
- `scripts/check-godot-*.mjs`
- `scripts/generate-godot-*.mjs`
- `scripts/run-godot-*.mjs`
- `test/godot*.test.ts`
- `test/trace-summary.test.ts`
- `package.json` の既存 Godot 検証 script への最小変更

## Non-goals
- Phaser runtime、Phaser 依存、旧 runtime コマンドを追加しない。
- Godot 以外の新 runtime を導入しない。
- 全ステージ構造、セーブ仕様、入力仕様、進行ルール全体の大規模再設計をしない。
- ボス/中ボスの難易度を雑魚HP 1ルールに合わせて弱体化しない。
- 146個以上の個別ステージ背景を無条件に生成しない。
- 著作権で保護された既存キャラクター、国民的キャラクター、商用作品に似せた画像を生成/使用しない。
- テストを通すために既存 replay / visual snapshot / audit の期待値を削除、skip、弱体化しない。
- 認証、外部API、課金、公開サービス、production data、credentials に触れない。
- 依頼と無関係なリファクタやデザイン全面刷新をしない。

## Constraints and anti-gaming rules
- 必ず t-wada TDD: Red -> Green -> Refactor の最小ステップで進める。バグ修正/仕様変更ごとに、失敗する Vitest、replay、contract、visual snapshot、または audit を先に追加する。
- Godot player は引き続き `CharacterBody2D` を使う。`RigidBody2D` に置き換えない。
- HUD改善は文字を増やすだけでなく、各表示項目の意味が画面上または視覚構造から判別できることを snapshot / usability test / script assertion で検証する。
- Spark攻撃の青い棒を、単に透明化・削除して成功扱いしない。攻撃入力に同期した Spark らしいエフェクト asset または effect node に置き換え、表示時間と非表示状態を replay/trace/visual snapshot で検証する。
- ImageGenを使う場合、生成物は workspace 内の canonical asset path に保存し、`asset_manifest.json`、Godot import、参照元 scene/script、visual/audit contract を更新する。生成元プロンプト、参照画像、サイズ、透過/背景処理、著作権リスクを completion receipt に記録する。
- 新しい背景/エフェクト/扉画像は、既存アセットと同じスケール感、Web向けサイズ、透過要件、Godot import方針に合わせる。大きなbinary assetを無制限に追加しない。
- 雑魚敵HP 1ルールは、scene配置敵、生成敵、combat matrix、replay期待HUDのいずれか一部だけを直して完了扱いしない。ボス/中ボス例外は role/id/metadata で明示する。
- 鍵付きドアは通常ドアと見た目が違うだけでなく、locked state / missing requirement / sealed visual が trace、HUD、visual snapshot のいずれかで確認できること。
- 1ブロック基準サイズは、表示スケールを雑に全て64pxに固定してレイアウトや当たり判定を壊す形で満たさない。既存のキャラ/敵/アイテム/扉の意図を保ちつつ、見た目の代表サイズと読みやすさを契約化する。
- Results後のコンテニューは、`ResultsScene` を消すだけでなく、`central_hub` にロードされ、HUD/outcome/input状態が running に戻り、以後の移動入力が処理されることを replay で検証する。
- `godot/resources/assets/images/effects/*.webp` の全ファイルは、対応するアクション、scene/script参照、replay/visual snapshot/audit evidence のいずれかを持つ。未使用ファイルを削除して成功扱いする場合は、その削除理由と代替を明記する。
- テスト、typecheck、Godot check、build/export path、safety check を削除・skip・弱体化して完了宣言しない。
- 新規 production dependency、license exposure、外部サービスが必要な場合は事前に止まる。

## Risk tier and review depth
Medium。

UI、ゲームプレイ、生成アセット、replay、visual snapshot、複数の検証スクリプトにまたがるため中リスク。完了前に focused verification と adversarial self-review を1回行い、以下を確認する。

- テストを弱めていない。
- 画像生成で既存キャラクター/商用作品に寄せていない。
- 未使用エフェクトを隠していない。
- Results後の継続が見た目だけでなく実際に入力可能。
- HP 1ルールが雑魚敵だけに適用され、ボス/中ボス例外が明示されている。

## Required first reads
編集前に以下を読む。

- `AGENTS.md`
- `package.json`
- `Task.md`
- `docs/godot-v2/usability-accessibility-testing.md`
- `docs/godot-v2/combat-slice.md`
- `docs/godot-v2/session-outcomes.md`
- `docs/godot-v2/door-transition-flow.md`
- `docs/godot-v2/procedural-level-generation.md`
- `godot/scenes/ui/HudOverlay.tscn`
- `godot/scripts/ui/HudOverlay.gd`
- `godot/scenes/ui/ResultOverlay.tscn`
- `godot/scripts/ui/ResultOverlay.gd`
- `godot/scenes/ui/ResultsScene.tscn`
- `godot/scripts/ui/ResultsScene.gd`
- `godot/scripts/session/GameSession.gd`
- `godot/scripts/player/PlayerController.gd`
- `godot/scenes/player/Player.tscn`
- `godot/scripts/enemies/SimpleEnemy.gd`
- `godot/scripts/level/LevelLoader.gd`
- `godot/scripts/level/LevelVisualAssets.gd`
- `godot/scripts/level/markers/DoorMarker.gd`
- `godot/levels/central_hub.tscn`
- `godot/resources/assets/asset_manifest.json`
- `godot/tests/usability_accessibility_contract.json`
- `godot/tests/combat_matrix_contract.json`
- `godot/tests/visual_snapshot_contract.json`
- `godot/tests/replay_suite.json`
- `godot/tests/asset_fallback_audit_contract.json`
- `godot/resources/assets/images/effects/` の全ファイル一覧

SubAgentを使う場合は、最初の実装前に「HUD/サイズ/扉/エフェクト/背景の現状監査」または「最終差分レビュー」のどちらかに限定した具体タスクを渡す。

## Work loop
1. Serena initial instructions と MCP resources を確認する。
2. ユーザー要望を9個の独立した観点として扱う。ただし同じファイルに触るものは小さなTDD順にまとめる。
3. 各観点で最初に Red を作る。Red は Vitest、replay fixture、visual snapshot contract、audit contract のいずれかでよい。
4. Green は現テストを満たす最小実装に留める。
5. Green後にだけRefactorする。不要な抽象化や無関係な見た目変更はしない。
6. ImageGenで作る画像は、参照元、プロンプト、出力、透過/リサイズ処理、Godot asset path、manifest更新を記録する。
7. 大きな変更単位ごとに fast feedback を実行し、失敗した場合は原因と次の仮説を `ATTEMPTS.md` に記録する。
8. 最後に full verification と adversarial self-review を行う。

## Implementation checkpoints
- Checkpoint 1: HUD各項目の意味を明示し、HUDが数値だけの不明表示にならないことをテスト/visual snapshotで固定する。
- Checkpoint 2: Spark攻撃の青い棒を、ImageGen生成または既存素材を基にした攻撃同期エフェクトへ置き換え、常時表示されないことを検証する。
- Checkpoint 3: 雑魚敵HPの基本値を1にし、ボス/中ボス例外をmetadata/contract上で明示する。
- Checkpoint 4: 主要ステージ/バイオームごとの背景または背景タイルを用意し、生成ステージがクラスタ背景を継承するようにする。
- Checkpoint 5: `central_hub` の扉配置を調整し、扉の下または近傍に足場があることをscene/audit/visual snapshotで検証する。
- Checkpoint 6: 鍵付きドアを封印された見た目にし、通常ドアと異なる locked/sealed visual を使う。
- Checkpoint 7: 扉、アイテム、雑魚敵、自キャラの代表表示サイズを1ブロック基準に揃え、usability contractで検証する。
- Checkpoint 8: Results後のコンテニュー入力で `central_hub` に戻り、running状態で操作できる replay を追加する。
- Checkpoint 9: `godot/resources/assets/images/effects` の全WebPが対応アクションで使用されることをasset/visual/replay auditで検証する。
- Checkpoint 10: docs、contracts、visual baselines、replay suite、manifestを実装に合わせて更新し、final gateを通す。

## Done when
- `npm run check:test -- test/godot-v2-hud-overlay.test.ts test/godot-v2-usability-accessibility.test.ts test/godot-v2-visual-snapshot.test.ts` または同等の対象実行で、HUDのHP、score、ability、items/progress、enemy/locked-door/statusなどの表示が意味を持つラベル/アイコン/構造になっていることを検証している。
- `godot/tests/visual_snapshot_contract.json` と対応baselineに、HUD意味表示の代表snapshotが含まれている。
- `godot/resources/assets/images/effects/spark-attack.webp` または同等のSpark攻撃専用エフェクトが存在し、ImageGenを使った場合は生成元プロンプト/参照/加工手順が completion receipt に記録されている。
- `npm run check:test -- test/godot-v2-combat-slice.test.ts test/godot-v2-visual-snapshot.test.ts` または同等の対象実行で、Spark攻撃時の青い棒が常時表示されず、攻撃入力に同期したSparkエフェクトとして表示/非表示されることを検証している。
- `npm run godot:combat-matrix -- --json` と `npm run godot:enemy-ai-arena` が成功し、雑魚敵の基本HPが1、ボス/中ボスだけが明示例外であることを報告またはcontractで確認できる。
- `godot/tests/combat_matrix_contract.json`、scene enemies、generated procedural enemies のいずれも、雑魚敵HP基本値が1になるよう更新されている。
- 主要ステージ/バイオーム用の背景または背景タイルが `godot/resources/assets/images/world/` または適切なcanonical asset pathに存在し、`asset_manifest.json` と Godot参照が更新されている。
- `npm run godot:visual-snapshot -- --json` または対象Vitestが、少なくとも central hub、forest、ice、fire、ruins/cave、sky/royal、generated labyrinth の代表レベルで背景/terrainの違いを検証している。
- `godot/levels/central_hub.tscn` の扉配置が更新され、各主要扉の下または近傍にプレイヤーが立てる足場があることを、scene lint、content budget、visual snapshot、または専用テストで検証している。
- 鍵付きドアは通常 `door-marker.webp` ではなく、封印/locked visual を持つ `locked-door.webp` または更新された専用assetを使い、`combat_locked_door_without_ability` などのreplay/visual snapshotで通常ドアと見分けられる。
- `npm run godot:usability` または対象Vitestが、扉、アイテム、雑魚敵、自キャラの代表表示サイズが1ブロック基準の許容範囲内であることを検証している。
- `npm run godot:replay-suite -- --filter <results-continue-to-hub-fixture>` または追加replayで、Results表示後に `result_continue` を押すと `central_hub` がロードされ、HUD outcomeがrunningに戻り、その後の移動/ジャンプ入力が処理されることを検証している。
- `godot/resources/assets/images/effects/*.webp` の全ファイルについて、対応する scene/script参照、manifest登録、replay event、visual snapshot、またはaudit evidenceが存在する。
- `npm run test` が成功する。
- Godot runtimeが利用可能な場合は `npm run check:godot` と `npm run godot:replay-suite` が成功する。環境都合でskipした場合は、skip出力を completion receipt に明記する。

## Verification
### Fast feedback loop
- `npm run check:typecheck`
- `npm run check:test -- test/godot-v2-hud-overlay.test.ts test/godot-v2-usability-accessibility.test.ts`
- `npm run check:test -- test/godot-v2-combat-slice.test.ts test/godot-v2-combat-matrix.test.ts`
- `npm run check:test -- test/godot-v2-asset-fallback-audit.test.ts test/godot-v2-visual-snapshot.test.ts`
- `npm run godot:usability`
- `npm run godot:combat-matrix -- --json`
- `npm run godot:asset-fallback-audit -- --json`
- `npm run godot:visual-snapshot -- --json`
- 追加/変更したreplay単体: `npm run godot:replay-suite -- --filter <fixture-id>`

### Final gate
- `npm run test`
- `npm run check:godot`
- `npm run godot:replay-suite`
- `npm run godot:visual-snapshot -- --json`
- `npm run godot:asset-fallback-audit -- --json`
- `npm run godot:usability`
- `npm run godot:combat-matrix -- --json`
- `npm run godot:enemy-ai-arena`
- 可能なら `npm run dev` で手動確認し、HUD、Spark攻撃、ステージ背景、central_hub扉、鍵付き扉、Results後continueを確認したスクリーンショットまたは確認手順を completion receipt に記録する。

## Working memory
長期化、ImageGen反復、SubAgent利用、または検証失敗が3回以上続く場合のみ `ATTEMPTS.md` を作成する。記録する内容:

- 失敗したテスト/コマンドとexit code。
- ImageGenプロンプト、出力path、採用/不採用理由。
- SubAgentに渡したタスクと返答要約。
- 次の仮説。

1セッションで線形に完了する場合は作業メモ不要。

## Completion receipt
完了宣言には以下を含める。

- 変更ファイル一覧。
- 9個の要望それぞれについて、Red test / Green実装 / Refactor有無。
- 実行したコマンド、exit code、重要な出力要約。
- 追加/更新したreplay、visual snapshot baseline、asset manifest、docs、contracts。
- ImageGenを使った場合のプロンプト、参照画像、生成物path、最終asset path、サイズ、透過/背景処理、著作権/既存キャラ類似リスクの自己評価。
- SubAgentを使った場合のagent idまたは役割、依頼内容、結果要約、採用した判断。
- HUD意味表示、Spark攻撃エフェクト、雑魚HP 1、背景、central_hub扉足場、sealed locked door、1ブロックサイズ、Results continue to hub、effects全使用の証拠。
- adversarial self-review の結果。
- 未解決リスクと残作業。

## Stop rules
- 「各ステージ背景」が全146以上の個別背景を意味すると判明した場合。
- ImageGen生成物が既存の商用/国民的キャラクター、著作権素材、または第三者IPに似すぎている。
- 生成画像の透過/サイズ/ライセンス/由来をcompletion receiptで説明できない。
- 雑魚敵HP 1ルールが既存replayの重要な進行やボス/中ボス戦と衝突し、例外metadataだけでは解決できない。
- Results後に `central_hub` へ戻す仕様が既存save/progression/score contractと衝突し、どちらを優先するか判断できない。
- 1ブロックサイズ基準が当たり判定、カメラ、既存レベル通路幅を壊し、見た目スケールだけでは解決できない。
- `godot/resources/assets/images/effects` の未使用ファイルが、対応アクション不明で削除も使用も判断できない。
- 必要な Godot scene/script/resource が Required first reads 後も存在しない。
- `npm run test` の既存失敗が今回の変更と無関係で、修正にscope外のproduct behavior変更またはテスト弱体化が必要。
- Godot runtime または export templates 不在により final gate のruntime部分が実行不能で、既存scriptがgraceful skipしない。
- 新規dependency、公開API変更、save data migration、production credential、破壊的操作が必要になる。

## Open questions
- 「各ステージ背景」を全ステージ個別背景として要求する場合は、対象数、画像サイズ、許容容量、優先ステージを再確認する。
- 「ブロック1マス分」の厳密なピクセルサイズが既存64px基準と異なる場合は、基準値を更新する。
