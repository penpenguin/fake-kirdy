# Goal

## Objective
Godot mainline のドア表示、敵接触判定、生成ハザード、Ability Gate、画面端境界、HUD オーブ表示を、プレイヤーに見える意味と実際の挙動が一致し、再発防止 contract と replay / visual evidence で検証できる状態にする。

## Context
分類: Bug fix + UI / behavior / accessibility check + asset/content adjustment.

このリポジトリは Godot 4 が canonical runtime で、TypeScript + Vitest の static contract、Godot headless replay、visual snapshot、asset fallback audit で mainline を検証している。`package.json` には `npm run test`、`npm run test:canonical`、`npm run build`、`npm run godot:visual-snapshot`、`npm run godot:replay-suite` がある。

現在の確認事項:
- `fire_area.tscn` の `fire_area_to_central_hub` と `forest_area.tscn` の `forest_area_to_central_hub` は `door_visual_style = "hub_return"` を持つが、見た目が通常移動ドアと同じに見える症状がある。既存の `hub_` 文字列 contract だけでは、実際の texture / silhouette / visual state の差分を十分に保証できない。
- 敵接触ダメージは `GameSession.gd` の `contact_damage_radius = 48.0` と中心距離判定で発生しており、`SimpleEnemy.tscn` の見た目 / collision shape より広く感じられる可能性がある。
- `labyrinth_011` は generated schema room で、`labyrinth_011_lava_hazard` が生成される。謎の赤い三角形は generated hazard / marker fallback visual 由来と推定する。
- `AbilityGateMarker.gd` は solid `Polygon2D` の青い壁を作り、`required_ability_type` と collision open は持つが、専用 texture とプレイヤーに伝わる意味の contract が弱い。
- HUD の orb row は `HudOverlay.gd` の `ColorRect` slot で表示されており、ユーザー期待は実際のオーブ icon 表示。
- 画面端の見えない壁を抜けてスタックする症状がある。authored scene と generated schema room の両方で再発防止が必要。

[Assumption] fire / forest だけでなく、`target_level_id = "central_hub"` の帰還扉はすべて通常移動ドアと視覚的に区別できるべき対象に含める。

[Assumption] `labyrinth011` は `labyrinth_011` を指す。対象は generated schema の `labyrinth_011_lava_hazard` またはそれに対応する runtime visual。

[Assumption] 「青い壁」は `AbilityGateMarker` と generated `ability_gates` を指す。青い壁は、必要能力を示す gate として意味を持ち、能力使用で開くことが replay / trace で証明されるべきものとする。

[Assumption] ImageGen の使用は許可済み。必要なら door / hazard / ability gate / orb icon 用の小さな raster asset を生成してよい。

## Scope
変更してよい範囲:
- `godot/levels/**/*.tscn`
- `godot/levels/*.json`
- `godot/levels/generated/*.json`
- `scripts/generate-godot-procedural-levels.mjs`
- `scripts/check-godot-*.mjs`
- `godot/scripts/level/markers/*.gd`
- `godot/scripts/level/LevelLoader.gd`
- `godot/scripts/level/LevelVisualAssets.gd`
- `godot/scripts/session/GameSession.gd`
- `godot/scripts/player/PlayerController.gd`
- `godot/scripts/enemies/*.gd`
- `godot/scenes/enemies/*.tscn`
- `godot/scenes/ui/HudOverlay.tscn`
- `godot/scripts/ui/HudOverlay.gd`
- `godot/resources/assets/images/**`
- `godot/resources/assets/asset_manifest.json`
- `godot/tests/replays/**`
- `godot/tests/replay_suite.json`
- `godot/tests/visual_snapshots/**`
- `godot/tests/*_contract.json`
- `test/godot*.test.ts`
- `test/trace-summary.test.ts`
- `docs/map-structure.md`
- `docs/godot-v2/*.md`

## Non-goals
- Phaser runtime、Phaser dependency、legacy runtime command を追加しない。
- Godot mainline 以外の runtime を復活させない。
- 今回の目的と無関係な map topology、progression、save schema、combat ability balance、difficulty tuning を作り替えない。
- 敵、ハザード、Ability Gate、扉、HUD 要素を削除して症状を隠さない。
- 画面端スタック対策として、境界抜けを放置したまま単純な teleport / position reset だけで完了扱いにしない。
- HUD オーブをテキスト、単色 `ColorRect`、または説明ラベルだけで代替しない。
- 既存の未コミット変更を巻き戻さない。対象ファイル内の既存変更は読んで上乗せし、無関係な差分は触らない。
- 外部 asset pack や新規 production dependency を導入しない。ただし ImageGen で生成した project-owned raster asset は許可範囲内。

## Constraints and anti-gaming rules
- t-wada TDD を守る。各症状は最小の failing test / contract / replay expectation から始め、Red -> Green -> Refactor を小さく進める。
- テストを削除、skip、弱体化して成功扱いにしない。
- `npm run test`、`npm run test:canonical`、`npm run build` の failure を隠すために build path、typecheck、scene lint、visual snapshot、replay checks を無効化しない。
- Door visual の再発防止は `door_visual_style` 文字列だけでなく、runtime visual が通常 `door-marker.webp` と区別できる texture / silhouette / explicit visual function / snapshot contract のいずれかで証明する。
- `hub_return` は fire / forest だけの一時修正にしない。`target_level_id = "central_hub"` の帰還扉全体に適用される contract を追加する。
- 敵接触判定は「見た目上当たっていない距離でも damage を受ける」ケースを replay または deterministic unit contract で Red にしてから修正する。ダメージを 0 にする、敵を spawn しない、invulnerability を伸ばすだけの修正は禁止。
- 敵接触判定は enemy visual / collision shape / configured contact bounds と整合させ、trace payload か test helper で接触距離・判定半径を確認できるようにする。
- `labyrinth_011` の赤い三角形対策は、ハザードを削除せず、lava/spike 等の意味を持つ texture / marker visual として実装する。generated schema と runtime loader の両方が stale にならないようにする。
- Ability Gate は単なる青い壁ではなく、必要能力、閉鎖状態、開放状態、collision disabled、hint / trace が一致する contract を持つこと。見た目は texture asset を使い、solid polygon だけで完了扱いにしない。
- 画面端の invisible wall は authored scene と generated schema room の両方で、player が camera / level bounds 外へ抜けないことを replay / trace / static geometry contract で証明する。
- HUD オーブは `TextureRect` など icon asset を表示できる UI node で表現する。取得済み / 未取得の状態差は icon、modulate、opacity、tooltip、trace payload のいずれかで判別できる必要がある。
- ImageGen を使う場合、生成 asset は project-owned raster file とし、Godot importer / asset manifest / fallback audit に接続する。参照画像の貼り付けや crop による見せかけは禁止。
- 新規 asset は Godot Web export に含まれることを検証する。

## Risk tier and review depth
High.

理由: runtime collision、generated level data、visual assets、HUD、replay suite、Godot export にまたがる広めの変更であり、見た目と gameplay contract の不一致を再発させやすい。

完了前に少なくとも次を行う:
- focused verification 後に1回の adversarial self-review。
- final gate 後にもう1回、テスト弱体化・症状隠し・asset 未接続・replay 不足を中心に clean review pass。

## Required first reads
編集前に以下を読む:
- `AGENTS.md` またはこのセッションの AGENTS 指示
- `README.md`
- `package.json`
- `docs/map-structure.md`
- `docs/godot-v2/door-transition-flow.md`
- `docs/godot-v2/session-outcomes.md`
- `docs/godot-v2/hud-overlay.md`
- `docs/godot-v2/procedural-level-generation.md`
- `docs/godot-v2/combat-slice.md`
- `godot/levels/fire_area.tscn`
- `godot/levels/forest_area.tscn`
- `godot/levels/central_hub.tscn`
- `godot/scripts/level/markers/DoorMarker.gd`
- `godot/scripts/level/markers/AbilityGateMarker.gd`
- `godot/scripts/level/markers/HazardMarker.gd`
- `godot/scripts/level/LevelLoader.gd`
- `godot/scripts/level/LevelVisualAssets.gd`
- `godot/scripts/session/GameSession.gd`
- `godot/scripts/enemies/SimpleEnemy.gd`
- `godot/scripts/enemies/FlyingEnemy.gd`
- `godot/scenes/enemies/SimpleEnemy.tscn`
- `godot/scenes/enemies/FlyingEnemy.tscn`
- `godot/scripts/ui/HudOverlay.gd`
- `godot/scenes/ui/HudOverlay.tscn`
- `scripts/generate-godot-procedural-levels.mjs`
- `godot/levels/generated/procedural_levels.json` の `labyrinth_011` 周辺
- `test/godot-v2-ux-polish.test.ts`
- `test/godot-v2-assets.test.ts`
- `test/godot-v2-hud-overlay.test.ts`
- `test/godot-v2-procedural-level-generator.test.ts`
- `test/godot-v2-replay-suite.test.ts`
- `scripts/check-godot-visual-snapshot.mjs`
- `scripts/check-godot-scene-lint.mjs`

## Work loop
1. `git status --short` で既存の未コミット変更を把握し、対象ファイル内の既存差分を読んでから編集する。
2. 6つの症状を checkpoint に分け、各 checkpoint で最小の failing test / replay / visual contract を先に追加する。
3. 失敗を確認したら、production code / scene / generated data / asset / docs の最小変更で green にする。
4. Green 後に重複や命名だけを小さく整理する。checkpoint 間の unrelated refactor は避ける。
5. 新規または変更 asset がある checkpoint では、manifest / import / fallback audit / visual snapshot まで接続する。
6. 1時間以上または compaction をまたぐ場合は、`GOAL.md` 末尾に `## Progress notes` を追加し、現在 checkpoint、直近の失敗コマンド、次の最小 action を3行以内で残す。

## Implementation checkpoints
1. Return door visual regression
   - `fire_area_to_central_hub`、`forest_area_to_central_hub`、および全 `target_level_id = "central_hub"` door を列挙する test を追加する。
   - `hub_return` が通常移動ドアと同じ texture / silhouette / visual path に落ちないことを Red で固定する。
   - `DoorMarker.gd` と scene metadata / assets を最小変更し、Central return door 専用 visual を実装する。
2. Enemy contact hitbox regression
   - 見た目上当たっていない距離で `player.damaged` が出る replay または deterministic contract を追加して Red にする。
   - enemy visual/collision shape と contact damage 判定を整合させる。
   - `enemy_contact` trace に接触距離 / 判定半径 / enemy id など review 可能な evidence を含めるか、同等の unit contract を追加する。
3. `labyrinth_011` hazard visual
   - generated `labyrinth_011_lava_hazard` が fallback polygon / 赤い三角形に見える状態を asset contract / visual snapshot で Red にする。
   - lava / hazard 用 texture asset を追加または生成し、`HazardMarker.gd` / `LevelLoader.gd` / generator data に接続する。
   - `labyrinth_011` を含む focused snapshot または replay evidence を追加する。
4. Ability Gate meaning and texture
   - tutorial / authored / generated ability gate が required ability、hint、closed/open visual、collision disabled を持つ contract を追加する。
   - 青い壁を専用 texture 表示に変更し、必要能力が player に読める visual state にする。
   - 既存 `tutorial_spark_gate` と generated `labyrinth_011_fire_gate` の両方で replay / snapshot evidence を取る。
5. Screen edge boundary
   - authored scene と generated schema room で、画面端 / camera bounds を抜けてスタックしないことを検証する replay / trace / static geometry contract を追加する。
   - 境界 collider または level bounds clamp を実装する場合は、通常移動・ジャンプ・door transition・fall recovery を壊さない。
6. HUD orb icons
   - HUD orb row が `ColorRect` slot だけで成立している現状を Red にし、icon asset / `TextureRect` / acquired-missing state を contract 化する。
   - 5種類の orb id (`forest-orb`, `ice-orb`, `fire-orb`, `cave-orb`, `sky-orb`) が HUD payload と icon表示に対応するようにする。
   - acquired / missing の visual difference を visual snapshot と static test で固定する。
7. Docs, snapshots, and final audit
   - `docs/godot-v2/*.md` と `docs/map-structure.md` を実装後の contract に合わせる。
   - visual snapshot baseline と replay suite を更新する。ただし failure 隠しは禁止。
   - final gate 後に再発防止 contract を adversarial review する。

## Done when
- `npx vitest run test/godot-v2-ux-polish.test.ts test/godot-v2-assets.test.ts test/godot-v2-hud-overlay.test.ts test/godot-v2-procedural-level-generator.test.ts test/godot-v2-replay-suite.test.ts` が成功し、追加テストが次を明示的に検証している:
  - fire / forest を含む Central Hub return door は通常移動ドアと runtime visual が区別できる。
  - `hub_return` の再発防止が全 `target_level_id = "central_hub"` door に効く。
  - 敵接触ダメージは見た目 / collision shape と整合し、遠すぎる距離では発生しない。
  - `labyrinth_011` の lava / hazard は赤い三角形 fallback ではなく texture asset で表示される。
  - Ability Gate は意味、必要能力、texture、open/closed state、collision state を持つ。
  - HUD orb row は ColorRect だけでなく orb icon asset で表示される。
- `npm run godot:scene-lint` と `npm run godot:visual-snapshot` が成功し、return door、enemy contact evidence、`labyrinth_011` hazard、Ability Gate、screen edge、HUD orb icon の visual contract が破綻していない。
- `npm run godot:replay-suite -- --filter tutorial_to_real_stage_path` が成功し、tutorial ability gate が意味を持ったまま hub route を壊していない。
- `npm run godot:replay-suite -- --filter fire_area_ability_gate_trace` が成功し、fire_area の Ability Gate と Central return visual / transition 周辺が壊れていない。
- `npm run godot:replay-suite -- --filter labyrinth_011` または新設した `labyrinth_011` focused replay が成功し、generated hazard / gate / enemy contact の少なくとも1つを trace で確認できる。
- 画面端抜けの再発防止 replay または contract が追加され、`player` が authored / generated level bounds 外に出ないことを検証している。
- `npm run test` が成功する。
- `npm run test:canonical` が成功するか、Godot 不在による graceful skip を正確に記録している。
- `npm run build` が成功するか、Godot/export templates 不在による graceful skip を正確に記録している。
- Docs に、Central return door visual、enemy contact hitbox、generated hazard visual、Ability Gate texture/meaning、screen edge bounds、HUD orb icon contract が反映されている。

## Verification
### Fast feedback loop
反復中に必要な範囲で実行する:

```bash
npx vitest run test/godot-v2-ux-polish.test.ts test/godot-v2-assets.test.ts test/godot-v2-hud-overlay.test.ts test/godot-v2-procedural-level-generator.test.ts test/godot-v2-replay-suite.test.ts
npm run godot:scene-lint
npm run godot:visual-snapshot
```

必要に応じて focused replay を追加し、追加後は以下を個別に回す:

```bash
npm run godot:replay-suite -- --filter tutorial_to_real_stage_path
npm run godot:replay-suite -- --filter fire_area_ability_gate_trace
npm run godot:replay-suite -- --filter labyrinth_011
```

### Final gate
完了宣言前に実行する:

```bash
npm run test
npm run godot:replay-suite -- --filter tutorial_to_real_stage_path
npm run godot:replay-suite -- --filter fire_area_ability_gate_trace
npm run godot:replay-suite -- --filter labyrinth_011
npm run test:canonical
npm run build
```

可能なら `npm run godot:run` で手動確認し、以下のスクリーンショットまたは明確な観察結果を completion receipt に残す:
- `fire_area` と `forest_area` の Central return door が通常移動ドアと違う見た目になっていること。
- 敵に近いが接触していない位置では damage を受けず、実際に重なった位置で damage を受けること。
- `labyrinth_011` の hazard が赤い三角形ではなく意味のある lava / hazard texture で見えること。
- tutorial / stage の青い壁が ability gate として読める texture になっていること。
- 画面端で抜けず、スタックしないこと。
- HUD の orb row が orb icon として表示され、取得済み / 未取得が判別できること。

## Working memory
基本は `GOAL.md` だけでよい。

1セッションで終わらない場合のみ、`GOAL.md` の末尾に `## Progress notes` を追加し、現在の checkpoint、直近の失敗コマンド、次の最小 action を3行以内で残す。

## Completion receipt
完了時に以下を報告する:
- 変更ファイル一覧。
- Red として追加した test / contract / replay と、最初に失敗した内容の要約。
- 各 verification command の exact command、exit code、成功 / skip / failure。
- Godot runtime や export templates が不在だった場合の skip 理由。
- 生成または変更した asset のパス、ImageGen 使用有無、Godot import / asset manifest 更新有無。
- fire / forest を含む Central return door の対象リストと、各 door の final visual style / texture / lock metadata。
- 敵接触判定の証拠: contact radius、enemy visual/collision size、damage が発生しない距離、damage が発生する距離、関連 trace payload。
- `labyrinth_011` の赤い三角形が何だったか、最終 asset と visual snapshot / replay evidence。
- Ability Gate の意味付け証拠: required ability、closed/open visual、collision disabled、trace events。
- 画面端抜け対策の証拠: authored/generated の対象レベル、bounds、replay/contract 結果。
- HUD orb icon の証拠: icon asset、HUD node type、acquired/missing 表示、snapshot evidence。
- adversarial self-review 2回分の結果。
- 残るリスクまたは follow-up。

## Stop rules
- `fire_area_to_central_hub` / `forest_area_to_central_hub` が本当に Central return door ではない、または topology source と矛盾する場合は、該当ファイルと矛盾内容を示してユーザー確認を待つ。
- 敵接触判定の修正に PlayerController の大規模 rewrite、physics layer 全面再設計、または combat balance 全体変更が必要になった場合は、最小再現と影響範囲を示してユーザー確認を待つ。
- `labyrinth_011` の赤い三角形の正体が hazard / ability gate / generated marker のいずれでもなく、source of truth が特定できない場合は、調査結果を示してユーザー確認を待つ。
- Ability Gate の「意味」を実装するために新しい progression rule、save schema migration、または公開 input semantics 変更が必要になった場合は、変更前にユーザー確認を待つ。
- 画面端抜け対策が既存 replay / movement contract を破壊し、修正するには本 goal の範囲を超える controller redesign が必要な場合は、失敗ログを添えて停止する。
- ImageGen 以外の外部 asset、外部 dependency、未確認 license、paid service、ネットワーク取得が必要になった場合は、導入前にユーザー確認を待つ。
- 既存の未コミット変更が対象ファイル内で同じ行・同じ contract を変更しており、安全に上乗せできない場合は、差分を示してユーザー確認を待つ。
- Final gate の失敗が今回の変更と無関係な既存不具合で、修正するには product behavior 変更やテスト弱体化が必要な場合は、失敗ログを添えて停止する。

## Open questions
なし。上記 assumptions が誤っている場合は、実装開始前にこの `GOAL.md` を更新する。
