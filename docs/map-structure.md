# Map Structure

この文書は現行 Godot 4 mainline のマップ構成を説明します。実行時の一次情報は `godot/levels/level_catalog.json`、編集元は `godot/levels/level_catalog.source.json`、全ステージ位相は `godot/levels/stage_manifest.json`、生成部屋の実行時レイアウトは `godot/levels/generated/procedural_levels.json` です。

## 固定マップ

| 表示名 | Godot level id | 主な役割 | 主要接続 |
| --- | --- | --- | --- |
| Central Hub | `central_hub` | 開始地点、固定ブランチ、検証用部屋への接続 | `ice_area`, `fire_area`, `forest_area`, `cave_area`, `mirror_corridor`, `heal_room`, `combat_room`, `jump_room` |
| Mirror Corridor | `mirror_corridor` | ゴール前通路 | `central_hub`, `goal_sanctum` |
| Goal Sanctum | `goal_sanctum` | `GoalDoorController` によるクリア、スコア、リザルト導線 | `mirror_corridor`, `sky_sanctum` |
| Sky Sanctum | `sky_sanctum` | 高難度帯の分岐ハブ、`sky_guard_boss`撃破、`sky-orb`報酬、Central帰還扉 | `goal_sanctum`, `aurora_spire`, `starlit_keep`, generated sky chain, `central_hub` |
| Aurora Spire | `aurora_spire` | 縦移動寄りの空中サブルート | `sky_sanctum` |
| Starlit Keep | `starlit_keep` | 横移動寄りの空中サブルート | `sky_sanctum` |
| Ice Area | `ice_area` | Ice branch と ability gate 検証 | `central_hub`, generated ice chain |
| Fire Area | `fire_area` | Fire branch と ability gate 検証 | `central_hub`, generated fire chain |
| Forest Area | `forest_area` | Forest branch と reliquary 導線 | `central_hub`, `labyrinth_001` |
| Cave Area | `cave_area` | Ruins branch と ability gate 検証 | `central_hub`, generated ruins chain |
| Forest Reliquary | `forest_reliquary` | `forest-keystone` 取得、`forest_guard_boss`撃破、`forest-orb`報酬、Central帰還扉検証 | generated forest chain, `central_hub` |
| Ice Reliquary | `ice_reliquary` | `ice-keystone` 取得、`ice_guard_boss`撃破、`ice-orb`報酬、Central帰還扉 | generated ice chain, `central_hub` |
| Fire Reliquary | `fire_reliquary` | `fire-keystone` 取得、`fire_guard_boss`撃破、`fire-orb`報酬、Central帰還扉 | generated fire chain, `central_hub` |
| Ruins Reliquary | `ruins_reliquary` | `cave-keystone` 取得、`ruins_guard_boss`撃破、`cave-orb`報酬、Central帰還扉 | generated ruins chain, `central_hub` |

`flat_room`、`door_room`、`heal_room`、`danger_room`、`revive_room`、`combat_room`、`flying_combat_room`、`enemy_spawn_limit_room`、`enemy_crowd_spacing_room`、`hidden_discovery_room` は canonical replay や focused contract のための Godot-owned 検証レベルです。これらも `level_catalog.source.json` で管理し、実行時は通常の `DoorMarker`、`GoalMarker`、`HealMarker`、`EnemySpawnMarker`、`HazardMarker`、`AbilityGateMarker` として扱います。

`central_hub` は左右対称の聖堂ハブとして、royal cathedral background を使い、灰色の台形Backdropではなく中央の nave/altar/side aisle 構造に主要扉を配置します。`DoorToMirrorCorridor` は中央軸、`DoorToForestArea` と `DoorToTutorialFireArea`、`DoorToIceArea` と `DoorToCaveArea` は左右の対応ペアとして扱い、足場と camera bounds の安全性を保ちます。

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

Cross-cluster access is controlled by collected keystones, completed levels, defeated enemy groups, boss requirements, orb rewards, and authored/generated door metadata. The mainline boss rooms use keyed return doors back to `central_hub`: `forest-orb`, `ice-orb`, `fire-orb`, `cave-orb`, and `sky-orb` are awarded only by their corresponding boss defeat, then unlock the Central return door for that room. Missing requirements emit `door.locked`; successful transitions emit `door.entered` and update HUD, inventory, save, map, and trace state.

Progression solver の canonical contract は、forest/ice/fire/cave/sky に加えて `goal_sanctum`、`aurora_spire`、`starlit_keep` を含む8つ以上の到達可能な biome/area destination を `reachable_biome_destinations` として報告します。

## Validation

- `npm run godot:stage-manifest -- --check`
- `npm run godot:procedural-levels -- --check`
- `npm run godot:catalog -- --check`
- `npm run godot:content-check`
- `npm run godot:replay-suite --`
- `npm run trace:summary -- <trace.json|trace.ndjson>`

The canonical release gate is `npm run test:canonical` when Godot is available.
