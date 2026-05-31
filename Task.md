# 仕様上まだ未実装 / 簡易実装の機能リスト

## サマリ

- Godot移行・PR完了基準のブロッカー: 0件
- `phaser-parity-ledger` 上の明示 deferred: 0件
- 旧 `requirements.md` / `design.md` まで含めた未実装・簡易実装: 0件

## 現行Godot仕様で残っているもの

- [x] Audio / Polish
  - 状態: 実装済み
  - 実装: `GameSession` に BGM/SFX/UI cue の mix scale、pause/settings 中の BGM ducking、`audio.mix.updated` trace を追加した。Pause / Settings / Result overlay は `polish_transition_ms` ベースの tween 演出を持ち、Result overlay は `score_countup_ms` で score count-up を行う。
  - 根拠: `GameSession.gd` の `update_audio_mix` / `get_audio_mix_payload` / `play_ui_sfx`、`PauseScene.gd` / `SettingsOverlay.gd` / `ResultOverlay.gd` の tween 契約、`test/godot-v2-audio-polish.test.ts`、`docs/godot-v2/audio-polish.md`、replay suite 40/40。

- [x] 生成ルームのリッチ化
  - 状態: 実装済み
  - 実装: `runtime_layout.room.shape_profile` と `floor_segments` を導入し、branch room / reliquary gate / vertical route / arena route / terminal goal / single corridor の複数 shape を生成する。`runtime_layout.branch_exit_rules` は route continuation、reliquary shard lock、cluster Keystone expectation を記録し、LevelLoader は generated reliquary door に local generated shard の `required_item_id` を反映する。sky generated goal path は generated exit から hand-authored goal path まで `door.entered` / `goal.door.entered` / `run.finished` を suite で要求する。
  - 根拠: `scripts/generate-godot-procedural-levels.mjs`、`godot/levels/generated/procedural_levels.json`、`LevelLoader.gd` の `floor_segments` / `get_generated_branch_exit_rule`、`test/godot-v2-procedural-level-generator.test.ts`、`test/godot-v2-replay-suite.test.ts`、`docs/godot-v2/procedural-level-generation.md`。

- [x] 縦遷移の安全性強化
  - 状態: 実装済み
  - 実装: north/south exit を持つ生成ルームに `runtime_layout.safety.vertical_transition` を追加し、protected spawn、72px clearance、96px max drop、landing surface ids を JSON 上で検証できるようにした。縦ルートには `GeneratedPlatformVerticalLanding` と `GeneratedPlatformVerticalStep` を生成し、north/south spawn が安全な着地面を持つことを Vitest で全生成ルームに対して検証する。
  - 根拠: `scripts/generate-godot-procedural-levels.mjs`、`godot/levels/generated/procedural_levels.json`、`test/godot-v2-procedural-level-generator.test.ts`、`docs/godot-v2/procedural-level-generation.md`。

- [x] 手作りレベルの pacing / layout polish
  - 状態: 実装済み
  - 実装: `LevelPacingMarker` を追加し、hub / branch / reliquary の代表 scene に pacing profile、critical path、rest stops、spawn safety、door preview spacing、encounter budget、keystone visibility を marker metadata として配置した。hub は `hub` profile、5 branch scenes は `branch` profile、4 reliquary scenes は `reliquary` profile として検証する。
  - 根拠: `LevelPacingMarker.gd`、`central_hub.tscn`、`forest_area.tscn` / `ice_area.tscn` / `fire_area.tscn` / `cave_area.tscn` / `mirror_corridor.tscn`、`*_reliquary.tscn`、`test/godot-v2-content-migration.test.ts`、`docs/godot-v2/content-migration.md`。

- [x] より細かい能力別攻撃
  - 状態: 実装済み
  - 実装: `fire` ability は `AbilityProjectile` node を生成し、projectile payload を `ability.projectile.spawned` / `ability.projectile.hit` として trace してからダメージを解決する。既存の `spark` dash、`sword` melee、`ice` beam、`stone` heavy などの profile 分岐も維持。
  - 根拠: `AbilityProjectile.gd` / `AbilityProjectile.tscn`、`GameSession.gd` の `spawn_ability_projectile` / `resolve_ability_projectile_hits`、`fire_ability_projectile_hit.json`、replay suite の `fire_ability_projectile_hit`。

- [x] より強い戦闘フィードバック
  - 状態: 実装済み
  - 実装: `SimpleEnemy` に hit/defeat flash 状態を追加し、敵ダメージ時に `Body.modulate` を一時的にヒット色へ変える。`GameSession` は同じダメージ解決で `enemy.feedback.shown` を trace し、replay suite で検証する。
  - 根拠: `SimpleEnemy.gd`、`GameSession.gd`、`combat_ability_damage_enemy` replay suite、`docs/godot-v2/combat-slice.md`。

## `requirements.md` 由来の未実装 / 簡易実装

### 要件2: 敵能力利用システム

- [x] Xキーによる能力リンク解除
  - 状態: 実装済み
  - 仕様: 解除キーで敵能力とのリンクを解除し、基本状態に戻る。
  - 実装: `swallow` アクションを、捕獲中は従来どおり能力取得、非捕獲かつ能力保持中は `ability.detached` として能力解除に使用。
  - 根拠: `GameSession.gd` の `detach_current_ability`、`combat_detach_ability.json`、replay suite の `combat_detach_ability`、`docs/godot-v2/combat-slice.md`。

- [x] 引き寄せ中の敵が倒された場合の自動リンク解除
  - 状態: 実装済み
  - 仕様: 引き寄せ状態の敵が倒されたら捕獲リンクを自動解除する。
  - 実装: 捕獲中の敵が外部ダメージで `enemy.defeated` になった場合、`captured_enemy` をクリアし `enemy.capture.cleared` を trace する。
  - 根拠: `GameSession.gd` の `clear_defeated_captured_enemy`、`capture_defeated_enemy_auto_clear.json`、replay suite の `capture_defeated_enemy_auto_clear`、`docs/godot-v2/combat-slice.md`。

- [x] 敵能力による移動効果
  - 状態: 実装済み
  - 仕様: 特殊攻撃または移動効果。
  - 実装: `spark` ability に dash movement effect を付与し、能力使用時に Kirdy を向き方向へ移動させ `ability.movement.applied` を trace する。
  - 根拠: `GameSession.gd` の `apply_ability_movement` / `movement_effect: dash`、`spark_ability_dash_movement.json`、replay suite の `spark_ability_dash_movement`。

### 要件3: 迷宮探索システム

- [x] 隠しアイテム / 隠し通路の発見
  - 状態: 実装済み
  - 実装: `CollectibleMarker` / `DoorMarker` に `hidden_until_discovered` と `discovery_radius` を追加し、近接発見時に `hidden.discovered` を trace、発見済みになるまで collectible pickup / door transition を抑止する。
  - 根拠: `GameSession.gd` の `check_hidden_discoveries` / `is_hidden_feature_discovered`、`hidden_discovery_room.tscn`、`hidden_discovery_path.json`、replay suite の `hidden_discovery_path`。

- [x] Mキーによるマップ表示切り替え
  - 状態: 実装済み
  - 実装: `map_toggle` アクションを M キーに割り当て、`GameSession` が `MapOverlay.visible` を切り替える。
  - 根拠: `project.godot` の `map_toggle`、`GameSession.gd` の `check_map_actions` / `toggle_map_overlay`、`map_toggle_visibility.json`、replay suite の `map_toggle_visibility`。

- [x] 未発見要素のマップ上での視覚的区別
  - 状態: 実装済み
  - 実装: `map.updated` と `MapOverlay` に current level の door / heal / collectible / hazard / ability_gate / goal feature を同期し、tile探索状態に基づく `discovered` で既発見・未発見を色分け表示する。
  - 根拠: `GameSession.gd` の `get_map_features_payload` / `is_tile_explored`、`MapOverlay.gd` の `build_feature_markers` と discovered/undiscovered colors、`test/godot-v2-map-overlay.test.ts`、`map_toggle_visibility.json` の trace。

- [x] Keystone取得まで他クラスタへ抜けられない完全な進行制御
  - 状態: 実装済み
  - 実装: `LevelLoader.get_level_cluster()` で authored tags / generated metadata から cluster を解決し、`GameSession.get_cluster_transition_lock_reason()` が cross-cluster door を前段 Keystone で制御する。ice は `forest-keystone`、fire は `ice-keystone`、ruins は `fire-keystone`、sky は `cave-keystone` を要求し、不足時は `missing_cluster_keystone:<item_id>` の `door.locked` を trace する。
  - 根拠: `GameSession.gd` の `CLUSTER_KEYSTONE_REQUIREMENTS` / `cluster_keystone_progression_enabled`、`LevelLoader.gd` の `get_level_cluster`、`central_hub_ice_gate_without_keystone.json`、`labyrinth_051_to_sky_sanctum_generated_exit.json` の `initial_item_ids`、replay suite 40/40。

### 要件4: 敵キャラクターシステム

- [x] 画面内の敵が3体以上の時の新規出現制限
  - 状態: 実装済み
  - 仕様: active enemy が3体に達したら以後の敵 spawn をスキップする。
  - 実装: `GameSession.max_active_enemy_count` を 3 にし、`spawn_enemies()` が上限超過 marker を生成せず `enemy.spawn.skipped` を trace する。
  - 根拠: `GameSession.gd` の `max_active_enemy_count` / `enemy.spawn.skipped`、`enemy_spawn_limit_room.tscn`、`enemy_spawn_limit.json`、replay suite の `enemy_spawn_limit`。

- [x] Kirdy周辺に敵が2体以上いる場合の距離維持
  - 状態: 実装済み
  - 仕様: Kirdy周辺に active enemy が2体以上いる場合、近すぎる敵を最小距離まで押し戻して surround を緩和する。
  - 実装: `GameSession.apply_enemy_crowd_spacing()` が `enemy_crowd_player_radius` 内の敵数を判定し、`enemy_crowd_min_player_distance` 未満の敵を補正、初回補正を `enemy.crowd.spacing_applied` として trace する。
  - 根拠: `GameSession.gd` の `apply_enemy_crowd_spacing` / `enemy.crowd.spacing_applied`、`enemy_crowd_spacing_room.tscn`、`enemy_crowd_spacing.json`、replay suite の `enemy_crowd_spacing`。

- [x] 特殊能力ごとの独特な敵AI
  - 状態: 実装済み
  - 実装: enemy `ability_type` ごとに AI profile を適用し、`frost` / `fire` / `stone` で chase speed、detection radius、attack cadence、hover tuning などを変える。
  - 根拠: `GameSession.gd` の `get_enemy_ability_ai_profile` / `apply_enemy_ability_ai_profile`、`frost_enemy_ai_profile.json`、replay suite の `frost_enemy_ai_profile`。

### 要件5: ユーザーインターフェース

- [x] スコア表示
  - 状態: 実装済み
  - 実装: HUD に score を表示し、`hud.updated` / `trace:summary` の `last_hud.score` で検証可能にした。
  - 根拠: `HudOverlay.gd` / `HudOverlay.tscn` の `ScoreLabel`、`GameSession.gd` の `calculate_total_score`、replay suite の `central_hub_dead_end_max_health.expected_last_hud.score`。

- [x] ポーズメニュー
  - 状態: 実装済み
  - 仕様: 一時停止時にポーズメニュー表示。
  - 実装: `pause_toggle` アクションを ESC キーに割り当て、`GameSession` が gameplay 更新を停止し `PauseOverlay` を表示する。
  - 根拠: `PauseOverlay.gd` / `PauseOverlay.tscn`、`GameSession.gd` の `check_pause_actions` / `toggle_pause_menu`、`pause_toggle_menu.json`、replay suite の `pause_toggle_menu`。

- [x] ポーズから設定を開く流れ
  - 状態: 実装済み
  - 仕様: PauseScene から設定オーバーレイを開き、ESCで設定を閉じてポーズに戻り、再度ESCでゲームに戻る。
  - 実装: ポーズ中に `pause_settings` で `SettingsOverlay` を開き、ESCで設定を閉じてポーズに戻り、再度ESCでゲームに戻る。
  - 根拠: `GameSession.gd` の `open_pause_settings` / `close_pause_settings`、`PauseOverlay.gd` の `settings_open`、`pause_settings_flow.json`、replay suite の `pause_settings_flow`。

- [x] ゲームオーバー時のリスタートオプション
  - 状態: 実装済み
  - 実装: game-over result overlay に restart prompt を表示し、`result_restart` で現在レベルを再ロード、HPを復帰、HUDを running に戻す。
  - 根拠: `ResultOverlay.gd` / `ResultOverlay.tscn` の `RestartLabel`、`GameSession.gd` の `check_result_actions` / `restart_current_run`、`game_over_restart_option.json`、replay suite の `game_over_restart_option`。

- [x] ゲーム設定メニューの完全UI
  - 状態: 実装済み
  - 実装: `settings_menu` から通常ゲーム中の設定メニューを開閉し、`settings_focus_next` / `settings_focus_previous` で `volume` / `controls` / `difficulty` のフォーカスを移動する。`SettingsOverlay` は post-processing blur と Canvas fallback blur を持ち、Pause経由起動、ESC階層制御、`touch` 設定時の仮想コントロール表示も維持する。
  - 根拠: `GameSession.gd` の `open_settings_menu` / `close_settings_menu` / `move_settings_focus`、`SettingsOverlay.gd` / `SettingsBlur.gdshader`、`settings_menu_flow.json`、`settings_adjustment.json`、`pause_settings_flow.json`、`virtual_controls_touch_mode.json`、replay suite の `settings_menu_flow`。

### 要件6: Web技術最適化

- [x] ブラウザ60FPS保証
  - 状態: 実装済み
  - 実装: `npm run godot:web-performance` が Godot Web export artifacts をローカル配信し、Chromium-compatible browser を Chrome DevTools Protocol 経由で起動、`requestAnimationFrame` を `web_performance_budget.json` に従って計測し、browser 60 FPS / 最大 frame time / canvas 生成を検証する。CI は `npm run build:public` 直後にこの gate を実行する。
  - 根拠: `scripts/check-godot-web-performance.mjs`、`godot/tests/web_performance_budget.json`、`.github/workflows/test.yml` の `npm run godot:web-performance`、`test/godot-v2-performance.test.ts`、`docs/godot-v2/performance-testing.md`。

- [x] モバイル向けタッチコントロール
  - 状態: 実装済み
  - 実装: `controls: touch` で左下 D-pad と右側 Z/X/C ボタンを表示し、各ボタンが canonical input action を press/release する。
  - 根拠: `VirtualControlsOverlay.gd` / `VirtualControlsOverlay.tscn`、`GameSession.gd` の `sync_virtual_controls_overlay`、`virtual_controls_touch_mode.json`、replay suite の `virtual_controls_touch_mode`。

- [x] localStorage 指定の保存
  - 状態: Web向け最小実装済み
  - 実装: Web export では `SaveStore` が `JavaScriptBridge` 経由で `localStorage["kirdy-save"]` を primary save backend として使う。成功時は `save.written` に `storage_backend: "localStorage"` を含め、追加で `save.local_storage.written` を trace する。非 Web / headless では従来通り `FileAccess` backend を使う。
  - 根拠: `SaveStore.gd` の `save_state_to_local_storage` / `load_state_from_local_storage`、`GameSession.gd` の `save.local_storage.written` trace、`test/godot-v2-save-persistence.test.ts`、`docs/godot-v2/save-persistence.md`。

- [x] WebGL非対応時の Canvas 2D fallback
  - 状態: 実装済み
  - 実装: Godot Web export 後に `webgl-fallback.js` を `dist/index.html` へ idempotent に注入する `npm run godot:web-fallback` を追加した。runtime では WebGL probe に失敗した場合だけ Godot canvas を隠し、`data-kirdy-canvas2d-fallback` の Canvas 2D 互換画面を描画する。
  - 根拠: `scripts/install-godot-web-fallback.mjs`、`scripts/export-godot.mjs` の `installWebFallback`、`test/godot-v2-export.test.ts`、`docs/godot-v2/web-fallback.md`。

## `design.md` 由来の未実装 / 簡易実装

- [x] PauseScene
  - 状態: 実装済み
  - 実装済み: `PauseScene.gd` / `PauseScene.tscn` を追加し、`PauseOverlay` 互換の pause state に `BlurFallback` による canvas blur fallback、`pause_scene_active` / `blur_active` payload、`pause.scene.shown` trace を接続した。ESCでの再開、Pause経由の設定起動、ESC階層制御、`pause.toggled` / `pause.settings.opened` / `pause.settings.closed` trace も維持。
  - 根拠: `PauseScene.gd` / `PauseScene.tscn`、`GameSession.gd` の `setup_pause_scene` / `sync_pause_scene`、`pause_toggle_menu.json`、replay suite の `pause_toggle_menu.expected_events`。

- [x] Settings overlay の完全仕様
  - 状態: 実装済み
  - 実装済み: `volume` / `controls` / `difficulty` の表示、replay action による変更、`settings.updated` trace、保存データへの反映、Pause経由起動、ESC階層制御、Menu経由起動、post-processing blur、Canvas fallback blur、設定メニューとしての入力フォーカス管理。
  - 根拠: `SettingsOverlay.gd` / `SettingsOverlay.tscn` / `SettingsBlur.gdshader`、`GameSession.gd` の `settings_menu_open` / `selected_setting_index` / `sync_settings_overlay`、`settings.menu.opened` / `settings.focus.changed` / `settings.menu.closed` trace、`settings_menu_flow.json`。

- [x] 仮想コントロールUI
  - 状態: 実装済み
  - 内容: 左下D-pad、右側三角配置の Z/X/C ボタン、押下フィードバック。
  - 実装: D-pad は `move_left` / `move_right` / `jump`、Z/X/C は `use_ability` / `swallow` / `inhale` に接続し、押下中はボタンの表示色を変える。
  - 根拠: `VirtualControlsOverlay.gd` / `VirtualControlsOverlay.tscn`、`docs/godot-v2/virtual-controls.md`。

- [x] スコア / クリアタイム / 残機ボーナスつきリザルト
  - 状態: 実装済み
  - 実装: result overlay と dedicated `ResultsScene` に score、clear time、remaining-life bonus を表示し、3秒後または `result_continue` で `ResultsScene` に遷移する。
  - 根拠: `ResultOverlay.gd`、`ResultsScene.gd` / `ResultsScene.tscn`、`GameSession.gd` の `show_results_scene`、`results_scene_continue.json`、`trace:summary` の `last_results_scene`。

- [x] ResultsScene
  - 状態: 実装済み
  - 内容: 最終結果専用シーン。
  - 実装: `ResultsScene` が outcome、time、score、remaining-life bonus を表示し、`results.scene.shown` trace で検証可能。
  - 根拠: `ResultsScene.gd` / `ResultsScene.tscn`、`results_scene_continue.json`、replay suite の `results_scene_continue`。

- [x] GoalDoorController 相当
  - 状態: 実装済み
  - 実装: `GoalDoorController.gd` が `GoalMarker` を継承して canonical goal door を表現し、`goal_sanctum` の clear point に接続する。到達時は `goal.door.entered` と `run.finished` の payload に `time_ms`、`frames`、`score`、`remaining_life_bonus` を含める。
  - 根拠: `GoalDoorController.gd`、`goal_sanctum.tscn`、`mirror_to_goal_sanctum_finish` replay suite、`docs/godot-v2/session-outcomes.md`。

- [x] 扉周囲の安全リング
  - 状態: 実装済み
  - 内容: 生成ルームの `runtime_layout.safety.door_safe_radius` として 96px の扉周辺安全リングを記録し、敵・回復・収集物・ハザード・能力ゲート・ゴールの生成配置を active door の安全リング外に制限する。
  - 根拠: `scripts/generate-godot-procedural-levels.mjs` の `doorSafeRadius`、`godot/levels/generated/procedural_levels.json`、`test/godot-v2-procedural-level-generator.test.ts` の `keeps generated gameplay markers outside door safe rings`、`docs/godot-v2/procedural-level-generation.md`。

- [x] デッドエンド探索完了判定
  - 状態: 実装済み
  - 実装: `HealMarker.dead_end_id` を追加し、dead-end reward 取得時に `dead_end.completed` を trace、`completed_dead_end_ids` と map feature `feature_type: dead_end` / `completed` でミニマップ上に専用表示する。
  - 根拠: `GameSession.gd` の `complete_dead_end`、`MapOverlay.gd` の `dead_end_completed_color`、`central_hub_dead_end_max_health.json`、replay suite の `central_hub_dead_end_max_health.expected_events`。

- [x] バイオーム内20%以上の支路密度CI
  - 状態: 実装済み
  - 内容: generated procedural schema に `validation.branch_density_minimum` と cluster別 `branch_density_by_cluster` を出力し、各 biome の dead-end coverage が 20% 未満なら generator / CI が失敗する。
  - 根拠: `scripts/generate-godot-procedural-levels.mjs` の `branchDensityMinimum` / `buildBranchDensityByCluster`、`godot/levels/generated/procedural_levels.json`、`test/godot-v2-procedural-level-generator.test.ts` の branch density test、`docs/godot-v2/procedural-level-generation.md`。

- [x] アセット欠損時の能力テクスチャ fallback 完全仕様
  - 状態: 実装済み
  - 実装: `PlayerController` が `fire` / `burn`、`ice` / `frost`、`sword` / `blade` の能力テクスチャを明示解決し、欠損時は idle/run/current texture へ安全に fallback する。fallback は `player.ability_texture.fallback` として1能力・1fallbackにつき1回だけ trace する。
  - 根拠: `PlayerController.gd` の `get_ability_texture` / `get_ability_fallback_texture` / `emit_ability_texture_fallback`、`spark_ability_dash_movement` replay suite、`test/godot-v2-asset-migration.test.ts`。

- [x] 引き寄せエフェクト fallback
  - 状態: 実装済み
  - 実装: `PlayerController` が `Line2D` ベースの `InhaleEffectFallback` を生成し、捕獲時に player-to-enemy の引き寄せ線を表示する。`GameSession` は `inhale.effect.fallback` を trace し、release / swallow / capture clear で fallback 表示を隠す。
  - 根拠: `PlayerController.gd` の `show_inhale_effect_fallback` / `hide_inhale_effect_fallback`、`GameSession.gd` の capture flow、`combat_capture_swallow_goal` replay suite、`docs/godot-v2/combat-slice.md`。

- [x] 実行時エラー時の復旧UI
  - 状態: 最小実装済み
  - 実装: level load 失敗時に `ErrorOverlay` を表示し、`result_restart` 相当の retry prompt と `runtime.error.shown` / `runtime.error.retry_selected` trace を用意する。`trace:summary` は最新の runtime error を `last_runtime_error` として集約する。
  - 根拠: `ErrorOverlay.gd` / `ErrorOverlay.tscn`、`GameSession.gd` の `show_error_overlay` / `retry_after_error`、`test/godot-v2-error-overlay.test.ts`、`docs/godot-v2/runtime-error-overlay.md`。

- [x] セーブ失敗時の sessionStorage fallback
  - 状態: Web向け最小実装済み
  - 実装: `SaveStore` が primary `FileAccess` 保存に失敗した場合、Web export では `JavaScriptBridge` 経由で `sessionStorage["kirdy-save-temp"]` へ同じ save JSON を退避する。fallback 成功時は `save.written` に `storage_backend: "sessionStorage"` を含め、追加で `save.session_storage_fallback.written` を trace する。
  - 根拠: `SaveStore.gd` の `save_state_to_session_storage` / `load_state_from_session_storage`、`GameSession.gd` の save trace payload、`test/godot-v2-save-persistence.test.ts`、`docs/godot-v2/save-persistence.md`。

- [x] パフォーマンステスト
  - 状態: 最小実装済み
  - 実装: `npm run godot:performance` が `performance_budget.json` を読み、代表 replay の effective trace FPS、wall-clock runtime、Linux環境での peak RSS、Godot import/load time、trace size を budget と比較する。Godot 未インストール環境では他の Godot executable gate と同様に skip する。
  - 根拠: `scripts/check-godot-performance.mjs`、`godot/tests/performance_budget.json`、`test/godot-v2-performance.test.ts`、`docs/godot-v2/performance-testing.md`。

- [x] ユーザビリティ / アクセシビリティテスト
  - 状態: 最小実装済み
  - 実装: `npm run godot:usability` が `usability_accessibility_contract.json` を読み、キーボード操作、代表 replay による難易度 / touch / pause / restart coverage、UI scene の visible text、touch / combat / map の視覚フィードバック token、minimap color role の識別距離を静的検証する。
  - 根拠: `scripts/check-godot-usability.mjs`、`godot/tests/usability_accessibility_contract.json`、`test/godot-v2-usability-accessibility.test.ts`、`docs/godot-v2/usability-accessibility-testing.md`。

## 結論

- 現行PR・Godot移行完了基準では、未実装ブロッカーはない。
- このリスト上の未実装 / 簡易実装項目はすべて完了済み。
- 今後の作業は新規仕様・追加コンテンツ・さらなる品質調整として別途切り出す。
