# Root Docs, Map Structure, And Asset Metadata

Imported from:
- `docs/README.md`
- `docs/map-structure.md`
- `docs/Key visual.png` metadata
- `docs/key_visual.gif` metadata

## docs/README.md

# Documentation

Fake Kirdy の現行仕様は Godot 4 mainline を前提にしています。runtime、replay、trace、level data、Web export は `godot/` と Godot-owned scripts/tests が canonical です。

## 読む順番

1. `../README.md`: 開発・実行コマンドの最短入口。
2. `map-structure.md`: 固定マップ、generated rooms、cluster flow。
3. `godot-v2/README.md`: Godot mainline docs の索引。
4. `../Task.md`: 現行仕様で完了済み/残っている作業の一覧。

## 現行仕様

- Controller and replay: `godot-v2/controller-lab.md`, `godot-v2/replay-and-trace.md`
- Levels and content: `godot-v2/level-lab.md`, `godot-v2/content-migration.md`, `godot-v2/procedural-level-generation.md`
- Gameplay loop: `godot-v2/combat-slice.md`, `godot-v2/session-outcomes.md`
- UI/save/performance: `godot-v2/hud-overlay.md`, `godot-v2/save-persistence.md`, `godot-v2/performance-testing.md`, `godot-v2/web-fallback.md`

## 履歴と削除済み文書

旧 runtime 設計を説明していた `docs/design.md`、`docs/requirements.md`、`docs/swallow-capture-detach.md`、`docs/godot-v2/migration-plan.md` は削除済みです。耐久的な仕様はこの docs tree の Godot 文書、`Task.md`、`godot/levels/*.json`、replay fixtures、Vitest contracts に移しました。

`godot-v2/full-migration-execplan.md` と `godot-v2/gameplay-completion-execplan.md` は完了済み作業の履歴として残します。新しい実装判断では、これらより現行 docs、checked-in Godot data、tests を優先してください。

## Validation

- Fast static/test gate: `npm run test`
- Canonical replay gate when Godot is available: `npm run test:canonical`
- Legacy removal audit: `npm run legacy:inventory`
- Trace metrics: `npm run trace:summary -- <trace.json|trace.ndjson>`

## docs/map-structure.md

# Map Structure

この文書は現行 Godot 4 mainline のマップ構成を説明します。実行時の一次情報は `godot/levels/level_catalog.json`、編集元は `godot/levels/level_catalog.source.json`、全ステージ位相は `godot/levels/stage_manifest.json`、生成部屋の実行時レイアウトは `godot/levels/generated/procedural_levels.json` です。

## 固定マップ

| 表示名 | Godot level id | 主な役割 | 主要接続 |
| --- | --- | --- | --- |
| Central Hub | `central_hub` | 開始地点、固定ブランチ、検証用部屋への接続 | `ice_area`, `fire_area`, `forest_area`, `cave_area`, `mirror_corridor`, `heal_room`, `combat_room`, `jump_room` |
| Mirror Corridor | `mirror_corridor` | ゴール前通路 | `central_hub`, `goal_sanctum` |
| Goal Sanctum | `goal_sanctum` | `GoalDoorController` によるクリア、スコア、リザルト導線 | `mirror_corridor`, `sky_sanctum` |
| Sky Sanctum | `sky_sanctum` | 高難度帯の分岐ハブ | `goal_sanctum`, `aurora_spire`, `starlit_keep`, generated sky chain |
| Aurora Spire | `aurora_spire` | 縦移動寄りの空中サブルート | `sky_sanctum` |
| Starlit Keep | `starlit_keep` | 横移動寄りの空中サブルート | `sky_sanctum` |
| Ice Area | `ice_area` | Ice branch と ability gate 検証 | `central_hub`, generated ice chain |
| Fire Area | `fire_area` | Fire branch と ability gate 検証 | `central_hub`, generated fire chain |
| Forest Area | `forest_area` | Forest branch と reliquary 導線 | `central_hub`, `labyrinth_001` |
| Cave Area | `cave_area` | Ruins branch と ability gate 検証 | `central_hub`, generated ruins chain |
| Forest Reliquary | `forest_reliquary` | `forest-keystone` 取得、key door 検証 | generated forest chain |
| Ice Reliquary | `ice_reliquary` | `ice-keystone` 取得 | generated ice chain |
| Fire Reliquary | `fire_reliquary` | `fire-keystone` 取得 | generated fire chain |
| Ruins Reliquary | `ruins_reliquary` | `cave-keystone` 取得 | generated ruins chain |

`flat_room`、`door_room`、`heal_room`、`danger_room`、`revive_room`、`combat_room`、`flying_combat_room`、`enemy_spawn_limit_room`、`enemy_crowd_spacing_room`、`hidden_discovery_room` は canonical replay や focused contract のための Godot-owned 検証レベルです。これらも `level_catalog.source.json` で管理し、実行時は通常の `DoorMarker`、`GoalMarker`、`HealMarker`、`EnemySpawnMarker`、`HazardMarker`、`AbilityGateMarker` として扱います。

## 生成マップ

`stage_manifest.json` は `labyrinth-001` から `labyrinth-132` までの 132 generated stages を含みます。`npm run godot:procedural-levels` はそれらを Godot id の `labyrinth_001` から `labyrinth_132` に変換し、`procedural_levels.json` に保存します。

生成レベルは原則として hand-authored `.tscn` を持ちません。`LevelLoader.gd` が `generated_schema://<level_id>` として読み込み、次を runtime で作成します。

- `PlayerSpawn`、`DoorMarker`、`GoalMarker`、`CameraBoundsMarker`
- `LevelTileMap` metadata
- static floor/platform geometry
- generated enemy/heal/collectible markers
- ability gate、hazard、dead-end reward、door safe ring metadata

`labyrinth_001` は hand-authored scene も持つ代表レベルです。それ以外の generated rooms は schema/importer 境界として扱い、`npm run check:godot` が stale schema を検出します。

## Cluster Flow

| Cluster | Generated range | Entry | Exit / reward |
| --- | --- | --- | --- |
| forest | `labyrinth_001` - `labyrinth_005` | `forest_area` | `forest_reliquary` |
| ice | `labyrinth_006` - `labyrinth_010` | `ice_area` | `ice_reliquary` |
| fire | `labyrinth_011` - `labyrinth_032` | `fire_area` | `fire_reliquary` |
| ruins | `labyrinth_033` - `labyrinth_050` | `cave_area` | `ruins_reliquary` |
| sky | `labyrinth_051` - `labyrinth_068` | `sky_sanctum` | late-game generated chain |
| void | `labyrinth_069` - `labyrinth_132` | sky chain | generated terminal goal |

Cross-cluster access is controlled by collected keystones, completed levels, defeated enemy groups, boss requirements, and authored/generated door metadata. Missing requirements emit `door.locked`; successful transitions emit `door.entered` and update HUD, inventory, save, map, and trace state.

## Validation

- `npm run godot:stage-manifest -- --check`
- `npm run godot:procedural-levels -- --check`
- `npm run godot:catalog -- --check`
- `npm run godot:content-check`
- `npm run godot:replay-suite --`
- `npm run trace:summary -- <trace.json|trace.ndjson>`

The canonical release gate is `npm run test:canonical` when Godot is available.

## Image Metadata

- `docs/Key visual.png`: PNG image data, 1400 x 1024, 8-bit/color RGB, non-interlaced. SHA-256: `c87a46c4e347a229ddc6c684d0d894f0fb8a60e9343a921ab129c4624c7863a9`.
- `docs/key_visual.gif`: GIF image data, version 89a, 800 x 450. SHA-256: `b57e6ca2ec4b8e9a7282785a551a62e60129fbe39b27497d53a655bbc23bc334`.