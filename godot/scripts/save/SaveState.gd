extends Resource
class_name SaveState

const CURRENT_VERSION: int = 1

var acquired_item_ids: Array[String] = []
var completed_level_ids: Array[String] = []
var visited_level_ids: Array[String] = []
var unlocked_door_ids: Array[String] = []
var defeated_enemy_group_ids: Array[String] = []
var defeated_boss_ids: Array[String] = []
var opened_ability_gate_ids: Array[String] = []
var discovered_hidden_feature_ids: Array[String] = []
var completed_dead_end_ids: Array[String] = []
var explored_tiles: Dictionary = {}
var current_level_id: String = ""
var player_position: Dictionary = {}
var ability_type: String = ""
var consumed_heal_ids: Array[String] = []
var settings: Dictionary = {
    "volume": 0.4,
    "controls": "keyboard",
    "difficulty": "normal",
}
var player_hp: int = 0
var player_max_hp: int = 0
var player_revive_count: int = 0


func to_dictionary() -> Dictionary:
    return {
        "version": CURRENT_VERSION,
        "acquired_item_ids": acquired_item_ids,
        "completed_level_ids": completed_level_ids,
        "visited_level_ids": visited_level_ids,
        "unlocked_door_ids": unlocked_door_ids,
        "defeated_enemy_group_ids": defeated_enemy_group_ids,
        "defeated_boss_ids": defeated_boss_ids,
        "opened_ability_gate_ids": opened_ability_gate_ids,
        "discovered_hidden_feature_ids": discovered_hidden_feature_ids,
        "completed_dead_end_ids": completed_dead_end_ids,
        "explored_tiles": explored_tiles,
        "current_level_id": current_level_id,
        "player_position": player_position,
        "ability_type": ability_type,
        "consumed_heal_ids": consumed_heal_ids,
        "settings": settings,
        "player_hp": player_hp,
        "player_max_hp": player_max_hp,
        "player_revive_count": player_revive_count,
    }


static func from_dictionary(data: Dictionary):
    var state = load("res://scripts/save/SaveState.gd").new()
    state.current_level_id = String(data.get("current_level_id", ""))
    state.ability_type = String(data.get("ability_type", ""))
    state.settings = sanitize_settings(data.get("settings", {}))
    state.explored_tiles = sanitize_explored_tiles(data.get("explored_tiles", {}))
    var raw_position = data.get("player_position", {})
    if typeof(raw_position) == TYPE_DICTIONARY:
        state.player_position = {
            "x": float(raw_position.get("x", 0.0)),
            "y": float(raw_position.get("y", 0.0)),
        }
    state.player_hp = int(data.get("player_hp", 0))
    state.player_max_hp = int(data.get("player_max_hp", 0))
    state.player_revive_count = max(int(data.get("player_revive_count", 0)), 0)

    var raw_consumed_heals: Array = data.get("consumed_heal_ids", [])
    for heal_id in raw_consumed_heals:
        var consumed_heal_id := String(heal_id)
        if consumed_heal_id == "" or state.consumed_heal_ids.has(consumed_heal_id):
            continue
        state.consumed_heal_ids.append(consumed_heal_id)

    var raw_items: Array = data.get("acquired_item_ids", [])
    for item in raw_items:
        var item_id := String(item)
        if item_id == "" or state.acquired_item_ids.has(item_id):
            continue
        state.acquired_item_ids.append(item_id)

    var raw_completed_levels: Array = data.get("completed_level_ids", [])
    for level_id in raw_completed_levels:
        var completed_level_id := String(level_id)
        if completed_level_id == "" or state.completed_level_ids.has(completed_level_id):
            continue
        state.completed_level_ids.append(completed_level_id)

    var raw_visited_levels: Array = data.get("visited_level_ids", [])
    for level_id in raw_visited_levels:
        var visited_level_id := String(level_id)
        if visited_level_id == "" or state.visited_level_ids.has(visited_level_id):
            continue
        state.visited_level_ids.append(visited_level_id)

    var raw_unlocked_doors: Array = data.get("unlocked_door_ids", [])
    for door_id in raw_unlocked_doors:
        var unlocked_door_id := String(door_id)
        if unlocked_door_id == "" or state.unlocked_door_ids.has(unlocked_door_id):
            continue
        state.unlocked_door_ids.append(unlocked_door_id)

    var raw_defeated_enemy_groups: Array = data.get("defeated_enemy_group_ids", [])
    for group_id in raw_defeated_enemy_groups:
        var defeated_enemy_group_id := String(group_id)
        if defeated_enemy_group_id == "" or state.defeated_enemy_group_ids.has(defeated_enemy_group_id):
            continue
        state.defeated_enemy_group_ids.append(defeated_enemy_group_id)

    var raw_defeated_bosses: Array = data.get("defeated_boss_ids", [])
    for boss_id in raw_defeated_bosses:
        var defeated_boss_id := String(boss_id)
        if defeated_boss_id == "" or state.defeated_boss_ids.has(defeated_boss_id):
            continue
        state.defeated_boss_ids.append(defeated_boss_id)

    var raw_opened_ability_gates: Array = data.get("opened_ability_gate_ids", [])
    for gate_id in raw_opened_ability_gates:
        var opened_ability_gate_id := String(gate_id)
        if opened_ability_gate_id == "" or state.opened_ability_gate_ids.has(opened_ability_gate_id):
            continue
        state.opened_ability_gate_ids.append(opened_ability_gate_id)

    var raw_discovered_hidden_features: Array = data.get("discovered_hidden_feature_ids", [])
    for feature_id in raw_discovered_hidden_features:
        var discovered_hidden_feature_id := String(feature_id)
        if discovered_hidden_feature_id == "" or state.discovered_hidden_feature_ids.has(discovered_hidden_feature_id):
            continue
        state.discovered_hidden_feature_ids.append(discovered_hidden_feature_id)

    var raw_completed_dead_ends: Array = data.get("completed_dead_end_ids", [])
    for dead_end_id in raw_completed_dead_ends:
        var completed_dead_end_id := String(dead_end_id)
        if completed_dead_end_id == "" or state.completed_dead_end_ids.has(completed_dead_end_id):
            continue
        state.completed_dead_end_ids.append(completed_dead_end_id)

    state.acquired_item_ids.sort()
    state.completed_level_ids.sort()
    state.completed_dead_end_ids.sort()
    state.consumed_heal_ids.sort()
    state.discovered_hidden_feature_ids.sort()
    state.defeated_enemy_group_ids.sort()
    state.defeated_boss_ids.sort()
    state.opened_ability_gate_ids.sort()
    state.visited_level_ids.sort()
    state.unlocked_door_ids.sort()
    return state


static func sanitize_settings(raw_settings) -> Dictionary:
    var default_settings := {
        "volume": 0.4,
        "controls": "keyboard",
        "difficulty": "normal",
    }
    if typeof(raw_settings) != TYPE_DICTIONARY:
        return default_settings

    var volume := float(raw_settings.get("volume", default_settings.volume))
    volume = clampf(volume, 0.0, 1.0)

    var controls := String(raw_settings.get("controls", default_settings.controls))
    if not ["keyboard", "touch", "controller"].has(controls):
        controls = default_settings.controls

    var difficulty := String(raw_settings.get("difficulty", default_settings.difficulty))
    if not ["easy", "normal", "hard"].has(difficulty):
        difficulty = default_settings.difficulty

    return {
        "volume": volume,
        "controls": controls,
        "difficulty": difficulty,
    }


static func sanitize_explored_tiles(raw_explored_tiles) -> Dictionary:
    var sanitized := {}
    if typeof(raw_explored_tiles) != TYPE_DICTIONARY:
        return sanitized

    for level_id in raw_explored_tiles.keys():
        var normalized_level_id := String(level_id)
        if normalized_level_id == "":
            continue

        var raw_tiles = raw_explored_tiles[level_id]
        if typeof(raw_tiles) != TYPE_ARRAY:
            continue

        var seen_tiles := {}
        var valid_tiles := []
        for tile in raw_tiles:
            var tile_key := String(tile)
            if not is_valid_tile_key(tile_key) or seen_tiles.has(tile_key):
                continue

            seen_tiles[tile_key] = true
            valid_tiles.append(tile_key)

        if valid_tiles.is_empty():
            continue

        valid_tiles.sort()
        sanitized[normalized_level_id] = valid_tiles

    return sanitized


static func is_valid_tile_key(tile_key: String) -> bool:
    var parts := tile_key.split(",")
    if parts.size() != 2:
        return false

    if not String(parts[0]).is_valid_int() or not String(parts[1]).is_valid_int():
        return false

    return int(parts[0]) >= 0 and int(parts[1]) >= 0
