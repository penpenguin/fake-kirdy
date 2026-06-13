# Goal

## Objective
Godot mainlineで、HUD/ポーズ/リザルトが読めて操作でき、停止中にゲームが進まず、Spark・鍵・扉・バイオーム進行で詰まらず、CentralHubが対称的な聖堂ハブとして機能する状態にする。

## Context
Fake KirdyはGodot 4がcanonical runtime。現在、以下のユーザー報告がある。

- HUDの`AREA`、`ABILITY`、`ITEMS`などで名前と値が同じラインに詰まり、文字が見切れている。文字サイズも少し小さくしてよい。
- `Paused`、Pause操作説明、Pause Results、Results操作説明などがマップオブジェクトより後ろに出たり、マスク/背景処理が弱く読みづらい。
- Pause中、Result中、Results中にゲーム進行が停止せず、敵だけが動いてプレイヤーが倒される。
- Pause中に詰み位置から現在レベルの安全地点へ戻す位置リセット機能がない。
- チュートリアルでSparkを獲得せず、Xなどで放出した場合、壁を突破できず詰む。
- 鍵付き扉を開けられず、鍵も取得できない。
- 少なくとも8種類あるはずのバイオームへ到達できず、森にしかアクセスできない。
- CentralHubの扉位置が不自然で、より聖堂らしく対称的な配置にしたい。

既存ドキュメントでは、HUD/Pause/Result/Session outcome/Procedural level/Map topologyがGodot-owned docsとtestsで管理されている。`package.json`には`npm run test`、`npm run check:godot`、`npm run godot:replay-suite`、`npm run godot:visual-snapshot`、`npm run godot:progression-solver`などの検証コマンドがある。

[Assumption] 「8種類のバイオーム」は、プレイヤーがゲーム内導線で到達できる8つ以上のdistinct biome/area/cluster destinationを指す。既存specに8種類の正確な名称がない場合は、まず既存stage/cluster/tag/level labelを調査して8種類の定義を復元し、根拠が見つからない場合はStop rulesに従う。

[Assumption] 「Pause Results」は、通常のPause overlay、run-endの`ResultOverlay`、専用`ResultsScene`のいずれにも適用する。

[Assumption] 「位置リセット」はセーブ/収集状態を巻き戻さず、現在レベルの直近安全spawn/checkpointまたはactive spawnにプレイヤー位置と速度だけを戻す機能とする。

## Scope
変更してよい範囲:

- `GOAL.md`、必要に応じた作業メモ`ATTEMPTS.md`、`STATUS.md`
- `docs/godot-v2/**`、`docs/map-structure.md`
- `godot/project.godot`
- `godot/scenes/**`
- `godot/scripts/**`
- `godot/levels/**`
- `godot/resources/**`
- `godot/tests/**`
- `scripts/check-godot-*.mjs`
- `scripts/generate-godot-*.mjs`
- `scripts/run-godot-*.mjs`
- `test/godot*.test.ts`
- `test/trace-summary.test.ts`
- `package.json`の既存Godot検証scriptへの最小変更

調査してよい範囲:

- repo内のREADME、docs、tests、Godot scenes/scripts/resources、Serena memories/resources、既存git履歴のread-only参照

## Non-goals
- Phaser runtime、Phaser依存、旧runtimeコマンドを追加しない。
- Godot以外の新runtimeや大きな新UI frameworkを導入しない。
- セーブデータ形式、公開API、入力体系、ステージ生成体系を全面再設計しない。
- 8バイオーム対応のために、根拠なしに大量の新規ステージや大容量binary assetを作らない。
- CentralHubを全面的な新アート制作タスクにしない。今回の対象は扉導線、対称性、聖堂らしい構造の読み取りやすさまで。
- テストを通すために既存replay、snapshot、contract、audit、typecheck、Godot checkを削除、skip、弱体化しない。
- 認証、外部API、課金、production data、credentials、deploy/publish automationに触れない。
- 依頼と無関係なリファクタやデザイン全面刷新をしない。

## Constraints and anti-gaming rules
- 必ずt-wada TDDで進める。Red -> Green -> Refactorを最小ステップで回し、各バグ修正/仕様追加の前に失敗するVitest、replay、trace assertion、visual snapshot contract、またはstatic auditを追加する。
- Godot mainlineをcanonicalとして扱う。新しいPhaser runtime behaviorや依存を入れない。
- Player controllerは引き続き`CharacterBody2D`を使う。`RigidBody2D`へ置き換えない。
- HUDの見切れ対策は、単に項目を消す、値を省略する、常に短い固定文字列にする形で満たさない。`AREA`、`ABILITY`、`ITEMS`などの意味と値が読めるレイアウトにする。
- Pause/Result/Resultsの視認性は、テキストを前面にするだけでなく、マップオブジェクトに負けないbackdrop、mask、modal panel、CanvasLayer/z-index、focus orderを検証する。
- Pause/Result/Results中の停止は、敵だけを非表示にして成功扱いしない。敵、hazard、damage、player physics、session timer/trace progressionの扱いを明示し、停止中にプレイヤーが被ダメージしないことをreplay/traceで証明する。
- 位置リセットは、収集済みアイテム、鍵、completed/visited level、score、save stateを不必要に巻き戻さない。リセット対象は現在レベル内のプレイヤー位置/速度/危険接触状態に限定する。
- Sparkチュートリアル修正は、壁やgateを削除して進行不能を隠すだけにしない。Spark未獲得/放出後にも再取得、別導線、または明確なgate解除条件があり、プレイヤーが詰まないことをreplayで証明する。
- 鍵付き扉修正は、door lockを無条件解除して成功扱いしない。鍵取得、inventory/HUD反映、locked-before-key、unlocked-after-key、door.enteredまでをtraceまたはreplayで証明する。
- 8バイオーム対応は、level graphやprogression solverの期待値だけを書き換えて成功扱いしない。実際に到達可能なDoorMarker/topology/catalog/replay evidenceを揃える。
- CentralHubの聖堂化は、door markerを見た目だけ中央に寄せて遷移やspawn安全性を壊さない。主要扉は対称性、足場、安全spawn、door label/role、camera boundsを保つ。
- 新規dependency、license exposure、外部サービスが必要な場合は事前に止まる。
- 完了宣言には、実行した検証コマンドのexit codeと重要出力、手動確認した場合のスクリーンショット/手順、未解決リスクを含める。

## Risk tier and review depth
High。

UI、pause state、game simulation、progression topology、collectibles、doors、generated/authored levels、visual snapshotsにまたがるため高リスク。完了前に少なくとも2回のreview passを行う。

- Pass 1: TDD/contract review。各報告に対応するRed testが先に存在し、テストを弱めていないことを確認する。
- Pass 2: Gameplay/adversarial review。停止中の被ダメージ、Spark softlock、鍵扉、8バイオーム到達、CentralHub spawn/door安全性を反例目線で確認する。

## Required first reads
編集前に以下を読む。

- ユーザー提供の`AGENTS.md` instructions
- Serena initial instructions、Serena memories/resourcesのうちGodot mainline/current statusに関係するもの
- `package.json`
- `docs/godot-v2/hud-overlay.md`
- `docs/godot-v2/pause-overlay.md`
- `docs/godot-v2/result-overlay.md`
- `docs/godot-v2/session-outcomes.md`
- `docs/godot-v2/usability-accessibility-testing.md`
- `docs/godot-v2/procedural-level-generation.md`
- `docs/map-structure.md`
- `godot/scenes/ui/HudOverlay.tscn`
- `godot/scripts/ui/HudOverlay.gd`
- `godot/scenes/ui/PauseScene.tscn`
- `godot/scripts/ui/PauseOverlay.gd`
- `godot/scenes/ui/ResultOverlay.tscn`
- `godot/scripts/ui/ResultOverlay.gd`
- `godot/scenes/ui/ResultsScene.tscn`
- `godot/scripts/ui/ResultsScene.gd`
- `godot/scripts/session/GameSession.gd`
- `godot/scripts/level/LevelLoader.gd`
- `godot/scripts/level/markers/DoorMarker.gd`
- `godot/scripts/level/markers/CollectibleMarker.gd`
- `godot/levels/central_hub.tscn`
- `godot/levels/level_catalog.source.json`
- `godot/levels/stage_manifest.json`
- `godot/tests/replay_suite.json`
- 関連する既存テスト: `test/godot-v2-hud-overlay.test.ts`、`test/godot-v2-pause-overlay.test.ts`、`test/godot-v2-results-overlay.test.ts`、`test/godot-v2-results-scene.test.ts`、`test/godot-v2-usability-accessibility.test.ts`、`test/godot-v2-level-graph.test.ts`、`test/godot-v2-progression-solver.test.ts`、`test/godot-v2-door-transition.test.ts`、`test/godot-v2-collectible-progression.test.ts`

## Work loop
1. `STATUS.md`に現在のcheckpoint、次のRed、最後に通った検証を短く記録する。
2. 報告を「HUD」「Pause/Result視認性」「停止中simulation freeze」「Pause位置リセット」「Spark tutorial softlock」「鍵/鍵扉」「8 biome到達性」「CentralHub聖堂配置」に分ける。
3. 各カテゴリで最小のRed testまたはreplayを先に追加し、失敗理由を確認する。
4. GreenはそのRedを通す最小実装に留める。既存contractを壊した場合は原因を`ATTEMPTS.md`に記録する。
5. Green後にだけRefactorする。UI/sceneの重複整理はテストが緑の状態で行う。
6. カテゴリごとにfast feedbackを実行し、結果を`STATUS.md`へ更新する。
7. 3回連続で同じカテゴリの検証に失敗したら、失敗コマンド、仮説、次の選択肢を`ATTEMPTS.md`へ残す。
8. 全checkpoint後にfinal gateと2回のreview passを実施する。

## Implementation checkpoints
- Checkpoint 1: HUDの`AREA`、`ABILITY`、`ITEMS`、HP/score/status/objective類を、名前と値が見切れない2段/分離/縮小レイアウトにする。
- Checkpoint 2: Pause、Pause操作説明、ResultOverlay、ResultsSceneに、マップオブジェクトより前面のbackdrop/modal/mask/focusable control helpを与える。
- Checkpoint 3: Pause/Result/Results中はゲームsimulationが停止し、敵/hazard/damageでプレイヤーが倒されないようにする。
- Checkpoint 4: Pause menuに現在レベルの安全地点へ戻す位置リセット操作を追加し、traceできるようにする。
- Checkpoint 5: SparkチュートリアルでSparkを未獲得または放出した後も、再取得または別導線で壁/gateを突破できるようにする。
- Checkpoint 6: 鍵取得、HUD/inventory反映、鍵付き扉のlocked/unlocked遷移、door entryを直す。
- Checkpoint 7: 8種類以上のbiome/area/cluster destinationがlevel graph上も実プレイ導線上も到達可能であることを復元/追加する。
- Checkpoint 8: `central_hub`の主要扉を聖堂らしい左右対称/中央軸ベースの配置にし、足場、spawn安全性、door labels、camera boundsを保つ。
- Checkpoint 9: docs、replay suite、trace summary expectations、visual snapshot/audit contractsを実装に合わせて更新する。

## Done when
- `npm run check:test -- test/godot-v2-hud-overlay.test.ts test/godot-v2-usability-accessibility.test.ts test/godot-v2-visual-snapshot.test.ts`または同等の対象実行で、`AREA`、`ABILITY`、`ITEMS`などのHUD項目が名前/値とも読め、見切れや重なりがないことを検証している。
- `godot:visual-snapshot`または対応Vitestのsnapshot/contractで、Pause、Pause操作説明、ResultOverlay、ResultsSceneがマップオブジェクトより前面に表示され、backdrop/modal/maskにより読めることを検証している。
- `npm run godot:replay-suite -- --filter <pause-freeze-fixture>`または追加replayで、Pause中に敵/hazard/player damage/session outcomeが進まず、resume後だけ進行することをtraceで確認できる。
- `npm run godot:replay-suite -- --filter <result-freeze-fixture>`または追加replayで、ResultOverlay/ResultsScene表示中に敵だけが動いてプレイヤーが倒されないことをtraceで確認できる。
- Pause menuに位置リセット操作があり、`npm run godot:replay-suite -- --filter <pause-position-reset-fixture>`または追加replayで、詰み位置から現在レベルの安全spawn/checkpointへ戻り、収集状態や鍵状態を失わないことを確認できる。
- `npm run godot:replay-suite -- --filter <spark-tutorial-softlock-fixture>`または追加replayで、チュートリアル中にSparkを未獲得または放出した後でも、再取得/代替導線/解除条件により壁やgateで詰まないことを確認できる。
- `npm run godot:replay-suite -- --filter <key-door-fixture>`または追加replayで、鍵取得時に`item.acquired`または同等のtraceが出てHUD/inventoryへ反映され、鍵なしでは`door.locked`、鍵ありでは`door.entered`になることを確認できる。
- `npm run godot:level-graph`と`npm run godot:progression-solver`が、forest以外を含む8種類以上のbiome/area/cluster destinationへ到達可能なcanonical pathを報告する。
- 8種類以上のbiome/area/cluster destinationについて、少なくとも各入口または代表到達replay/trace/solver evidenceが`godot/tests/replay_suite.json`、`stage_manifest.json`、`level_catalog.source.json`、またはdocsに記録されている。
- `godot/levels/central_hub.tscn`が更新され、主要扉が左右対称または中央軸ベースに配置され、聖堂らしいnave/altar/side aisle相当の構造が読み取れることをvisual snapshotまたはscene/static testで検証している。
- CentralHubの各主要扉について、近傍に安全な足場/spawn/camera boundsがあり、`npm run godot:scene-lint`、`npm run godot:content-check`、または専用Vitestで検証している。
- 関連docs、contracts、replay fixtures、visual baselines、trace expectationsが実装後の挙動に合わせて更新されている。
- `npm run test`が成功する。
- Godot runtimeが利用可能な環境では、`npm run check:godot`と`npm run godot:replay-suite`が成功する。環境都合でskipされた場合は、skip理由と出力をCompletion receiptに明記する。

## Verification

### Fast feedback loop
- `npm run check:typecheck`
- `npm run check:test -- test/godot-v2-hud-overlay.test.ts test/godot-v2-usability-accessibility.test.ts`
- `npm run check:test -- test/godot-v2-pause-overlay.test.ts test/godot-v2-results-overlay.test.ts test/godot-v2-results-scene.test.ts`
- `npm run check:test -- test/godot-v2-door-transition.test.ts test/godot-v2-collectible-progression.test.ts`
- `npm run check:test -- test/godot-v2-level-graph.test.ts test/godot-v2-progression-solver.test.ts`
- `npm run godot:visual-snapshot -- --json`
- `npm run godot:level-graph`
- `npm run godot:progression-solver`
- 追加/変更したreplay単体: `npm run godot:replay-suite -- --filter <fixture-id>`

### Final gate
- `npm run test`
- `npm run check:godot`
- `npm run godot:replay-suite`
- `npm run godot:visual-snapshot -- --json`
- `npm run godot:level-graph`
- `npm run godot:progression-solver`
- 可能なら`npm run dev`で手動確認し、HUD、Pause、Pause reset、Result/Results、Spark tutorial、鍵扉、8 biome導線、CentralHub配置のスクリーンショットまたは確認手順をCompletion receiptに記録する。

## Working memory
このgoalは長期化しやすいため、作業中は以下を維持する。

- `STATUS.md`: 現在のcheckpoint、最後に通ったRed/Green、次に実行する検証、残るリスク。
- `ATTEMPTS.md`: 失敗したコマンドとexit code、失敗理由、試した仮説、採用しなかった案。

完了時にこれらが不要な一時メモになった場合も、削除せずCompletion receiptで扱いを説明する。

## Completion receipt
完了宣言には以下を含める。

- 変更ファイル一覧。
- 8つの報告カテゴリそれぞれについて、追加したRed test/replay、Green実装、Refactor有無。
- 実行した検証コマンド、exit code、重要な出力要約。
- 追加/更新したreplay fixture、visual snapshot/contract、stage/catalog/topology data、docs。
- Pause/Result中に被ダメージしない証拠、Spark softlockが解消された証拠、鍵取得/鍵扉遷移の証拠、8 biome到達性の証拠。
- CentralHubのbefore/after確認方法またはスクリーンショットpath。
- 2回のreview passの結果。
- 残るリスク、未解決事項、環境都合でskipされた検証。

## Stop rules
- 既存spec/docs/data/git履歴を調査しても、8種類のbiome/area/clusterの根拠が見つからず、新規に8種類を設計する必要がある。
- 8 biome対応が大量の新規ステージ、生成アルゴリズム全面変更、大容量asset追加を要求する。
- Pause/Result中のsimulation freezeが、既存replay determinism、trace schema、save/outcome仕様と衝突し、仕様判断が必要になる。
- 位置リセットがセーブ巻き戻し、checkpoint仕様、死亡/復活仕様と衝突し、どの状態を保持するか判断できない。
- Spark softlock解消に、チュートリアルの壁/gate仕様そのものを削除する以外の選択肢が見つからない。
- 鍵扉修正にsave data migration、外部データ、破壊的なprogression rewriteが必要になる。
- CentralHubの聖堂化により既存door target、spawn id、replay、camera boundsを大幅に作り替える必要がある。
- Godot runtimeまたはexport templates不在によりfinal gateのruntime部分が実行不能で、既存scriptもgraceful skipしない。
- `npm run test`の既存失敗が今回の変更と無関係で、修正にscope外のproduct behavior変更またはテスト弱体化が必要。
- 新規dependency、公開API変更、production credential、破壊的操作が必要になる。

## Open questions
- 8種類のbiome/area/clusterの正式名称が既に決まっている場合は、その名称を優先する。
- 位置リセット先を「現在レベル入口」「最後に触れた安全地点」「直近door spawn」のどれに固定したいかは、既存実装/仕様が見つからなければ実装者が最小リスクで選ぶ。
