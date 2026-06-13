# Goal

## Objective
Godot mainline で、結果表示のモーダル性、Spark 能力専用テクスチャ、ステージ名に応じた地形テクスチャ差分、ステージ端落下からの復帰を、TDD で検証可能な形で修正する。

## Context
Fake Kirdy は Godot 4 が canonical runtime。ユーザー報告では、以下がまだ未達。

- Results / Outcome completed 表示がモーダルらしくなく、RunComplete と同時に出ている。
- Spark 能力に専用テクスチャがない。
- ステージに見た目の変化がなく、ステージ名に応じたテクスチャが使用されていない。
- ステージ端から落下すると復帰できない。

[Assumption] 「RunComplete」は trace の `run.finished` または HUD の terminal state を指す。`ResultOverlay` は terminal trace と同フレームに出てもよいが、ユーザーが求める最終結果画面 `ResultsScene` は明示的な遅延または continue 入力後に出るべき、という意味で扱う。

## Scope
変更してよい範囲:

- `godot/scripts/**`
- `godot/scenes/**`
- `godot/levels/**`
- `godot/tests/**`
- `godot/resources/assets/**`
- `scripts/check-godot-*.mjs`
- `scripts/run-godot-*.mjs`
- `scripts/trace-summary.mjs`
- `test/godot*.test.ts`
- `docs/godot-v2/**`
- `Task.md`
- `package.json` の既存 Godot 検証 script への最小変更

## Non-goals
- Phaser runtime、Phaser 依存、旧 runtime コマンドを追加しない。
- Godot 全面リライト、敵/マップ/セーブ/音声/UI 全体の大規模移植をしない。
- 認証、外部 API、課金、公開サービス、production data に触れない。
- 既存 replay suite の意味を弱めるための expected event 削除やテスト緩和をしない。
- Spark 以外の能力バランスやステージ進行ルールを、この目的と無関係に変更しない。

## Constraints and anti-gaming rules
- 必ず t-wada TDD: Red -> Green -> Refactor の最小ステップで進め、各バグ修正前に失敗するテスト、replay、contract、または visual snapshot を追加する。
- Godot player は引き続き `CharacterBody2D` を使う。`RigidBody2D` に置き換えない。
- Result UI は loose HUD text ではなく、backdrop と framed panel を持つ modal-like presentation として検証する。
- `ResultsScene` を `run.finished` と同時表示にして成功扱いしない。自動遷移は設定された delay 後、または `result_continue` 入力後であることを trace または replay で検証する。
- Spark texture は `kirdy-spit.webp`、idle/run/current texture、placeholder の別名参照だけで済ませない。専用の `kirdy-spark.webp` 相当の asset、manifest、scene wiring、ability texture mapping を持たせる。
- ステージ texture は contract 上の preload だけで成功扱いしない。少なくとも forest/fire/ice/stone/royal/brick 系が level id または stage id に応じて実際の terrain polygon に適用されることを、静的テストまたは visual snapshot で検証する。
- 落下復帰は「端から落ちないように透明壁を足す」だけで完了扱いしない。落下検知、復帰位置、HP/無敵/trace の扱いを決め、replay で復帰後に入力継続できることを検証する。
- テスト、typecheck、Godot check、build path、safety check を削除・skip・弱体化して完了宣言しない。
- 新しい production dependency、license exposure、外部サービスが必要な場合は事前に止まる。
- 大きな binary asset を追加する場合は、サイズ、由来、代替案を completion receipt に明記する。

## Risk tier and review depth
Medium。

通常のゲーム挙動、UI 表示、生成/静的検証、Godot asset を触るため中リスク。完了前に focused verification と adversarial self-review を 1 回行い、テストを満たすためだけの偽装がないか確認する。

## Required first reads
編集前に以下を確認する。

- `AGENTS.md`
- `package.json`
- `Task.md` の result / texture / Spark / edge recovery 関連項目
- `docs/godot-v2/result-overlay.md`
- `godot/scenes/ui/ResultOverlay.tscn`
- `godot/scripts/ui/ResultOverlay.gd`
- `godot/scenes/ui/ResultsScene.tscn`
- `godot/scripts/ui/ResultsScene.gd`
- `godot/scripts/session/GameSession.gd`
- `godot/scenes/player/Player.tscn`
- `godot/scripts/player/PlayerController.gd`
- `godot/resources/assets/asset_manifest.json`
- `godot/tests/asset_fallback_audit_contract.json`
- `godot/scripts/level/LevelVisualAssets.gd`
- `godot/scripts/level/LevelLoader.gd`
- `godot/tests/visual_snapshot_contract.json`
- `godot/tests/replay_suite.json`
- edge / fall 関連 replay: `godot/tests/replays/tutorial_no_edge_fall_path.json`, `godot/tests/replays/tutorial_right_edge_recovery_path.json`

## Work loop
1. 4 件の症状を 1 件ずつ扱う。各件で、最初に最小の失敗テストまたは replay/contract を追加して Red を確認する。
2. Green は current test を満たす最小実装に留める。
3. Green 後だけ refactor し、既存 Godot mainline の設計に合わせる。
4. 1 件ごとに fast feedback を実行し、失敗内容、修正内容、次の仮説を短く記録する。
5. 複数ファイルをまたぐ変更後は、trace / snapshot / asset audit のいずれかでユーザー報告に対応する証拠を残す。

## Implementation checkpoints
- Checkpoint 1: Result UI の modal-like 表示と `ResultsScene` 遷移タイミングを赤テストで固定し、UI scene/script/session trace を修正する。
- Checkpoint 2: Spark 専用 texture asset を追加し、manifest、Player scene、`PlayerController` mapping、asset audit contract/test を更新する。
- Checkpoint 3: stage/level id ごとの terrain texture 適用を、`LevelVisualAssets`、loader、visual snapshot または static contract で検証できるようにする。
- Checkpoint 4: ステージ端落下からの復帰仕様を replay で固定し、復帰位置、HP/trace/HUD の扱いを実装する。
- Checkpoint 5: 必要な docs と `Task.md` を実装に合わせて更新し、final gate を通す。

## Done when
- `npm run check:test -- test/godot-v2-results-overlay.test.ts test/godot-v2-results-scene.test.ts` または同等の Vitest 対象実行で、result overlay が backdrop + framed modal panel を持ち、`ResultsScene` が `run.finished` と同時ではなく delay または `result_continue` 後に表示されることを検証している。
- `npm run godot:replay-suite -- --filter results_scene_continue` または該当 replay 実行で、`result.overlay.shown` と `results.scene.shown` の順序/タイミングが trace evidence として残る。
- `godot/resources/assets/images/characters/kirdy/kirdy-spark.webp` または同等の専用 Spark asset が存在し、`godot/resources/assets/asset_manifest.json`、`godot/scenes/player/Player.tscn`、`PlayerController.get_ability_texture`、`godot/tests/asset_fallback_audit_contract.json` がその専用 asset を参照している。
- `npm run godot:asset-fallback-audit -- --json` が、Spark ability texture を fallback ではなく explicit mapping として報告する。
- `npm run godot:visual-snapshot -- --json` または対象 Vitest が、少なくとも central/hub、fire、ice、forest、stone/ruins/cave、royal/sanctum/keep/spire 系の stage/level id で異なる terrain texture が適用されることを検証している。
- `npm run godot:replay-suite -- --filter <edge-or-fall-recovery-fixture>` または追加 replay が、ステージ端から落下しても `replay.error` / `player.defeated` / 永続的な画面外滞留にならず、復帰後に移動またはジャンプ入力が処理されることを検証している。
- `npm run test` が成功する。
- Godot がローカルで利用可能な場合は `npm run check:godot` も成功する。Godot 不在で skip する場合は、その skip 出力を completion receipt に明記する。

## Verification
### Fast feedback loop
- `npm run check:typecheck`
- `npm run check:test -- test/godot-v2-results-overlay.test.ts test/godot-v2-results-scene.test.ts`
- `npm run check:test -- test/godot-v2-asset-fallback-audit.test.ts test/godot-v2-visual-snapshot.test.ts`
- `npm run godot:asset-fallback-audit -- --json`
- 変更した replay 単体: `npm run godot:replay-suite -- --filter <fixture-id>`

### Final gate
- `npm run test`
- `npm run check:godot`
- `npm run godot:replay-suite -- --filter results_scene_continue`
- `npm run godot:replay-suite -- --filter <edge-or-fall-recovery-fixture>`
- `npm run godot:visual-snapshot -- --json`
- `npm run godot:asset-fallback-audit -- --json`
- 目視確認が可能なら `npm run dev` で、Result UI、Spark 能力、複数ステージの terrain、端落下復帰を確認し、スクリーンショットまたは確認手順を completion receipt に記載する。

## Working memory
長期化する場合のみ `ATTEMPTS.md` を作成し、失敗した replay/test、仮説、次の手を記録する。1 セッションで完了する場合は不要。

## Completion receipt
完了宣言には以下を含める。

- 変更ファイル一覧。
- 4 件それぞれの Red test / Green 実装 / Refactor 有無。
- 実行したコマンド、exit code、重要な出力要約。
- 追加または更新した replay、visual snapshot baseline、asset manifest、docs。
- Spark asset の path、サイズ、作成/由来メモ。
- Result UI と edge fall recovery の trace evidence。
- adversarial self-review の結果: テスト弱体化、fallback 偽装、同時表示偽装、透明壁だけの落下対策がないこと。
- 未解決リスクと残作業。

## Stop rules
- 期待される Godot scene/script/resource が Required first reads 後も存在しない。
- `kirdy-spark.webp` 相当の asset を作るために外部ライセンス素材、生成サービス、または大きな binary asset が必要で、ユーザー承認がない。
- 落下復帰の仕様が、HP 減少、無敵時間、復帰先、死亡扱いのいずれかで既存 gameplay contract と衝突し、テストで一意に決められない。
- `ResultsScene` と `ResultOverlay` のどちらを modal として扱うかで、既存 docs/test とユーザー報告の解釈が矛盾する。
- `npm run test` の既存失敗が今回の変更と無関係で、修正に scope 外の gameplay/API 変更が必要。
- Godot runtime または export templates 不在により最終 gate の runtime 部分が実行不能で、既存 script が graceful skip しない。
- 新規 dependency、公開 API 変更、save data migration、production credential、破壊的操作が必要になる。

## Open questions
- 「RunComplete」は trace event `run.finished`、HUD の outcome 表示、または `ResultsScene` の見た目上の同時表示のどれを指すか。現時点では `run.finished` 直後に最終 results scene が同時表示される問題として扱う。
