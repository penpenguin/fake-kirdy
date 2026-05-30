extends Node
class_name GameSession

const PlayerScene = preload("res://scenes/player/Player.tscn")
const SimpleEnemyScene = preload("res://scenes/enemies/SimpleEnemy.tscn")
const FlyingEnemyScene = preload("res://scenes/enemies/FlyingEnemy.tscn")
const LevelLoaderScript = preload("res://scripts/level/LevelLoader.gd")
const LevelVisualAssetsScript = preload("res://scripts/level/LevelVisualAssets.gd")
const TraceRecorderScript = preload("res://scripts/sim/TraceRecorder.gd")
const SaveStoreScript = preload("res://scripts/save/SaveStore.gd")
const MapOverlayScene = preload("res://scenes/ui/MapOverlay.tscn")
const HudOverlayScene = preload("res://scenes/ui/HudOverlay.tscn")
const ResultOverlayScene = preload("res://scenes/ui/ResultOverlay.tscn")
const SettingsOverlayScene = preload("res://scenes/ui/SettingsOverlay.tscn")
const InventoryOverlayScene = preload("res://scenes/ui/InventoryOverlay.tscn")
const BgmMain = preload("res://resources/assets/audio/bgm-main.wav")
const SfxKirdyInhale = preload("res://resources/assets/audio/sfx/kirdy-inhale.wav")
const SfxKirdySwallow = preload("res://resources/assets/audio/sfx/kirdy-swallow.wav")
const SfxKirdySpit = preload("res://resources/assets/audio/sfx/kirdy-spit.wav")
const SfxAbilityFireAttack = preload("res://resources/assets/audio/sfx/ability-fire-attack.wav")
const SfxAbilityIceAttack = preload("res://resources/assets/audio/sfx/ability-ice-attack.wav")
const SfxAbilitySwordAttack = preload("res://resources/assets/audio/sfx/ability-sword-attack.wav")

var current_level_id: String = ""
var current_level = null
var current_definition = null
var player = null
var input_source: Node = null
var trace_recorder: Node = null
var run_frame: int = 0
var run_time_ms: int = 0
var replay_fps: int = 60
var outcome: String = "running"
var enemies: Array = []
var captured_enemy = null
var capture_radius: float = 120.0
var player_hp: int = 3
var player_revive_count: int = 0
var player_invulnerability_remaining_ms: int = 0
var consumed_heal_ids: Dictionary = {}
var collected_collectible_ids: Dictionary = {}
var acquired_item_ids: Dictionary = {}
var completed_level_ids: Dictionary = {}
var visited_level_ids: Dictionary = {}
var unlocked_door_ids: Dictionary = {}
var defeated_enemy_group_ids: Dictionary = {}
var defeated_boss_ids: Dictionary = {}
var opened_ability_gate_ids: Dictionary = {}
var explored_tiles: Dictionary = {}
var last_locked_door_reason: String = ""
var ability_cooldown_remaining_ms: int = 0
var saved_level_id: String = ""
var saved_player_position: Vector2 = Vector2.ZERO
var has_saved_player_position: bool = false
var saved_ability_type: String = ""
var save_store: Node = null
var map_overlay: Control = null
var hud_overlay: Control = null
var result_overlay: Control = null
var settings_overlay: Control = null
var inventory_overlay: Control = null
var bgm_player: AudioStreamPlayer = null
var sfx_player: AudioStreamPlayer = null

var level_loader = null
var level_visual_assets = LevelVisualAssetsScript.new()
var requested_spawn_id: String = "default"

@export var auto_start: bool = true
@export var initial_level_id: String = "central_hub"
@export var initial_spawn_id: String = "default"
@export var save_enabled: bool = false
@export var save_path: String = "user://fake_kirdy_save.json"
@export var player_max_hp: int = 3
@export var contact_damage_radius: float = 48.0
@export var heal_pickup_radius: float = 48.0
@export var player_invulnerability_ms: int = 800
@export var setting_volume: float = 0.4
@export var setting_controls: String = "keyboard"
@export var setting_difficulty: String = "normal"
@export var settings_volume_step: float = 0.1
@export var settings_volume_up_action: StringName = &"settings_volume_up"
@export var settings_volume_down_action: StringName = &"settings_volume_down"
@export var settings_cycle_controls_action: StringName = &"settings_cycle_controls"
@export var settings_cycle_difficulty_action: StringName = &"settings_cycle_difficulty"
@export var exploration_tile_size: int = 32
@export var map_overlay_enabled: bool = true
@export var hud_overlay_enabled: bool = true
@export var result_overlay_enabled: bool = true
@export var settings_overlay_enabled: bool = true
@export var inventory_overlay_enabled: bool = true
@export var audio_enabled: bool = true


func _ready() -> void:
    set_physics_process(false)
    if auto_start:
        start_session(initial_level_id, initial_spawn_id)


func start_session(start_level_id: String, start_spawn_id: String = "default", fps: int = 60) -> bool:
    replay_fps = max(fps, 1)
    run_frame = 0
    run_time_ms = 0
    outcome = "running"
    player_hp = max(player_max_hp, 1)
    player_revive_count = 0
    player_invulnerability_remaining_ms = 0
    consumed_heal_ids.clear()
    collected_collectible_ids.clear()
    acquired_item_ids.clear()
    completed_level_ids.clear()
    visited_level_ids.clear()
    unlocked_door_ids.clear()
    defeated_enemy_group_ids.clear()
    defeated_boss_ids.clear()
    opened_ability_gate_ids.clear()
    explored_tiles.clear()
    last_locked_door_reason = ""
    ability_cooldown_remaining_ms = 0
    saved_level_id = ""
    saved_player_position = Vector2.ZERO
    has_saved_player_position = false
    saved_ability_type = ""
    if map_overlay != null and is_instance_valid(map_overlay):
        map_overlay.queue_free()
    map_overlay = null
    if hud_overlay != null and is_instance_valid(hud_overlay):
        hud_overlay.queue_free()
    hud_overlay = null
    if result_overlay != null and is_instance_valid(result_overlay):
        result_overlay.queue_free()
    result_overlay = null
    if settings_overlay != null and is_instance_valid(settings_overlay):
        settings_overlay.queue_free()
    settings_overlay = null
    if inventory_overlay != null and is_instance_valid(inventory_overlay):
        inventory_overlay.queue_free()
    inventory_overlay = null

    level_loader = LevelLoaderScript.new()
    trace_recorder = TraceRecorderScript.new()
    save_store = SaveStoreScript.new()
    add_child(level_loader)
    add_child(trace_recorder)
    add_child(save_store)
    setup_map_overlay()
    setup_hud_overlay()
    setup_result_overlay()
    setup_settings_overlay()
    setup_inventory_overlay()
    setup_audio_players()
    trace_recorder.call("configure", start_level_id, replay_fps)
    load_persistent_state()
    sync_map_overlay("save.loaded")
    sync_hud_overlay("save.loaded", save_enabled)
    sync_settings_overlay("save.loaded", save_enabled)
    sync_inventory_overlay("save.loaded", save_enabled)

    player = PlayerScene.instantiate()
    player.input_source = input_source

    if player.has_signal("trace_event"):
        player.trace_event.connect(on_player_trace_event)

    if not load_level(start_level_id, start_spawn_id):
        trace_recorder.call("record_replay_error", "Unable to load level: %s" % start_level_id)
        outcome = "error"
        return false

    apply_saved_player_position()
    apply_saved_ability_type()
    mark_level_visited(current_level_id)
    var start_tile_changed := mark_player_tile_explored()
    sync_map_overlay("session.started", start_tile_changed)
    sync_hud_overlay("session.started", true)
    sync_inventory_overlay("session.started", true)
    write_persistent_state()

    set_physics_process(true)
    return true


func _physics_process(delta: float) -> void:
    if is_finished():
        return

    run_frame += 1
    run_time_ms = int(round(float(run_frame) * 1000.0 / float(replay_fps)))
    trace_recorder.call("set_frame", run_frame)
    if mark_player_tile_explored():
        sync_map_overlay("player.moved", true)
        write_persistent_state()
    check_settings_actions()
    tick_player_invulnerability(delta)
    tick_ability_cooldown(delta)
    check_combat_actions()
    check_hazard_contacts()
    if is_finished():
        return

    check_enemy_attacks(delta)
    check_enemy_contact_damage()
    if is_finished():
        return

    check_heal_pickups()
    check_collectible_pickups()
    check_door_transitions()
    check_goal_reached()


func load_level(level_id: String, spawn_id: String = "default") -> bool:
    if current_level != null:
        current_level.queue_free()
        current_level = null

    var next_level = level_loader.call("load_level_by_id", level_id)
    if next_level == null:
        return false

    current_level = next_level
    current_level_id = level_id
    requested_spawn_id = spawn_id
    add_child(current_level)
    level_visual_assets.call("apply_to_level", current_level, current_level_id)
    current_definition = level_loader.call("build_level_definition", current_level, level_id)
    spawn_player(spawn_id)
    spawn_enemies()
    trace_recorder.call("configure", current_level_id, replay_fps)
    trace_recorder.call("record_event", "level.loaded", {
        "level_id": current_level_id,
        "spawn_id": spawn_id,
        "level_path": level_loader.call("get_level_path", current_level_id),
    })
    sync_map_overlay("level.loaded")
    sync_hud_overlay("level.loaded", true)
    sync_inventory_overlay("level.loaded")
    return true


func spawn_player(spawn_id: String = "default") -> void:
    var spawn_marker := find_marker_by_id(current_definition.player_spawns, spawn_id)
    if spawn_marker.is_empty() and current_definition.player_spawns.size() > 0:
        spawn_marker = current_definition.player_spawns[0]

    if spawn_marker.is_empty():
        player.global_position = Vector2.ZERO
    else:
        player.global_position = dictionary_to_vector2(spawn_marker.get("position", {}))

    player.velocity = Vector2.ZERO
    player.level_id = current_level_id

    if player.get_parent() == null:
        add_child(player)

    apply_spawn_facing(spawn_marker)


func apply_spawn_facing(spawn_marker: Dictionary) -> void:
    if player == null or spawn_marker.is_empty():
        return

    var payload: Dictionary = spawn_marker.get("payload", {})
    player.call("set_facing", float(payload.get("facing", 1.0)))


func spawn_enemies() -> void:
    for enemy in enemies:
        if is_instance_valid(enemy):
            enemy.queue_free()

    enemies.clear()
    captured_enemy = null

    for enemy_marker in current_definition.enemy_spawns:
        var payload: Dictionary = enemy_marker.get("payload", {})
        var enemy_type := String(payload.get("enemy_type", "simple_ground"))
        var enemy = instantiate_enemy(enemy_type)
        enemy.enemy_id = String(enemy_marker.get("id", "enemy"))
        enemy.ability_type = String(payload.get("ability_type", "spark"))
        enemy.contact_damage = int(payload.get("contact_damage", 1))
        enemy.attack_damage = int(payload.get("attack_damage", enemy.contact_damage))
        enemy.attack_radius = float(payload.get("attack_radius", 120.0))
        enemy.attack_cooldown_ms = int(payload.get("attack_cooldown_ms", 1200))
        enemy.enemy_group_id = String(payload.get("enemy_group_id", ""))
        enemy.boss_id = String(payload.get("boss_id", ""))
        enemy.global_position = dictionary_to_vector2(enemy_marker.get("position", {}))
        apply_difficulty_to_enemy(enemy)
        enemy.call("configure_ai", player, float(payload.get("patrol_radius", 0.0)))
        add_child(enemy)
        enemies.append(enemy)


func instantiate_enemy(enemy_type: String) -> Node:
    match enemy_type:
        "flying", "flying_enemy", "generated_flying":
            return FlyingEnemyScene.instantiate()
        _:
            return SimpleEnemyScene.instantiate()


func check_combat_actions() -> void:
    if player == null:
        return

    if player.call("is_swallow_pressed"):
        swallow_captured_enemy()

    if player.call("is_use_ability_pressed"):
        use_ability()

    if player.call("is_inhale_pressed"):
        capture_nearest_enemy()
    else:
        release_captured_enemy()


func capture_nearest_enemy() -> void:
    if captured_enemy != null:
        return

    var nearest_enemy = null
    var nearest_distance := capture_radius
    var facing := get_player_facing_direction()

    for enemy in enemies:
        if not is_instance_valid(enemy) or not can_target_enemy(enemy):
            continue

        var distance: float = player.global_position.distance_to(enemy.global_position)
        if distance > nearest_distance:
            continue

        var delta_x: float = enemy.global_position.x - player.global_position.x
        if delta_x * facing < -16.0:
            continue

        nearest_enemy = enemy
        nearest_distance = distance

    if nearest_enemy == null:
        return

    captured_enemy = nearest_enemy
    captured_enemy.call("capture", player)
    play_sfx(SfxKirdyInhale)
    trace_recorder.call("record_player_event", "enemy.captured", {
        "level_id": current_level_id,
        "player": get_player_trace(),
        "payload": get_enemy_payload(captured_enemy),
    })


func get_player_facing_direction() -> float:
    if player == null:
        return 1.0

    var facing := float(player.get("last_facing"))
    if facing == 0.0:
        return 1.0

    return -1.0 if facing < 0.0 else 1.0


func release_captured_enemy() -> void:
    if captured_enemy == null:
        return

    var released_enemy = captured_enemy
    captured_enemy = null
    released_enemy.call("release")
    play_sfx(SfxKirdySpit)
    var spit_profile := {
        "damage": 2,
        "range": 220.0,
        "half_height": 48.0,
        "knockback": 28.0,
    }
    trace_recorder.call("record_player_event", "enemy.released", {
        "level_id": current_level_id,
        "player": get_player_trace(),
        "payload": get_enemy_payload(released_enemy),
    })
    trace_recorder.call("record_player_event", "spit.projectile.fired", {
        "level_id": current_level_id,
        "player": get_player_trace(),
        "payload": {
            "enemy": get_enemy_payload(released_enemy),
            "profile": spit_profile,
        },
    })
    var targets := find_enemy_targets(spit_profile, released_enemy)
    if targets.is_empty():
        return

    var target = targets[0]
    var result := apply_damage_to_enemy(target, int(spit_profile.get("damage", 2)), {
        "source_type": "spit_projectile",
        "projectile_enemy_id": released_enemy.enemy_id,
    }, float(spit_profile.get("knockback", 0.0)))
    trace_recorder.call("record_player_event", "spit.projectile.hit", {
        "level_id": current_level_id,
        "player": get_player_trace(),
        "payload": result,
    })


func swallow_captured_enemy() -> void:
    if captured_enemy == null:
        return

    var swallowed_enemy = captured_enemy
    captured_enemy = null
    swallowed_enemy.call("swallow")
    player.call("set_ability_type", swallowed_enemy.ability_type)
    clear_resolved_locked_door_reason("missing_ability", String(swallowed_enemy.ability_type))
    play_sfx(SfxKirdySwallow)
    trace_recorder.call("record_player_event", "enemy.swallowed", {
        "level_id": current_level_id,
        "player": get_player_trace(),
        "payload": get_enemy_payload(swallowed_enemy),
    })
    trace_recorder.call("record_player_event", "ability.acquired", {
        "level_id": current_level_id,
        "player": get_player_trace(),
        "payload": {
            "ability_type": swallowed_enemy.ability_type,
            "enemy_id": swallowed_enemy.enemy_id,
        },
    })
    sync_hud_overlay("ability.acquired", true)
    sync_inventory_overlay("ability.acquired", true)
    write_persistent_state()


func use_ability() -> void:
    if String(player.ability_type) == "":
        return

    if ability_cooldown_remaining_ms > 0:
        return

    var ability_type := String(player.ability_type)
    var profile := get_ability_profile(ability_type)
    ability_cooldown_remaining_ms = int(profile.get("cooldown_ms", 0))
    play_sfx(get_ability_sfx(String(player.ability_type)))
    trace_recorder.call("record_player_event", "ability.used", {
        "level_id": current_level_id,
        "player": get_player_trace(),
        "payload": {
            "ability_type": ability_type,
            "profile": profile,
        },
    })
    check_ability_gate_interactions(ability_type, profile)
    var targets := find_enemy_targets(profile)
    for target in targets:
        apply_damage_to_enemy(target, int(profile.get("damage", 1)), {
            "source_type": "ability",
            "ability_type": ability_type,
        }, float(profile.get("knockback", 0.0)))


func get_ability_profile(ability_type: String) -> Dictionary:
    match ability_type:
        "fire", "flame":
            return {
                "damage": 2,
                "range": 240.0,
                "half_height": 36.0,
                "cooldown_ms": 260,
                "knockback": 22.0,
                "attack_type": "projectile",
            }
        "ice", "frost":
            return {
                "damage": 1,
                "range": 180.0,
                "half_height": 44.0,
                "cooldown_ms": 220,
                "knockback": 10.0,
                "status": "frozen",
                "attack_type": "beam",
            }
        "sword":
            return {
                "damage": 2,
                "range": 92.0,
                "half_height": 52.0,
                "cooldown_ms": 180,
                "knockback": 18.0,
                "attack_type": "melee",
            }
        "spark":
            return {
                "damage": 2,
                "range": 128.0,
                "half_height": 84.0,
                "cooldown_ms": 240,
                "knockback": 12.0,
                "attack_type": "burst",
            }
        "leaf":
            return {
                "damage": 1,
                "range": 220.0,
                "half_height": 32.0,
                "cooldown_ms": 160,
                "knockback": 16.0,
                "attack_type": "cutter",
            }
        "stone":
            return {
                "damage": 3,
                "range": 76.0,
                "half_height": 58.0,
                "cooldown_ms": 320,
                "knockback": 30.0,
                "attack_type": "heavy",
            }
        _:
            return {
                "damage": 1,
                "range": 160.0,
                "half_height": 40.0,
                "cooldown_ms": 220,
                "knockback": 12.0,
                "attack_type": "generic",
            }


func find_enemy_targets(profile: Dictionary, ignored_enemy: Node = null) -> Array:
    var targets := []
    if player == null:
        return targets

    var facing := get_player_facing_direction()
    var attack_range := float(profile.get("range", 120.0))
    var half_height := float(profile.get("half_height", 48.0))
    for enemy in enemies:
        if enemy == ignored_enemy or not is_instance_valid(enemy) or not can_target_enemy(enemy):
            continue

        var offset: Vector2 = enemy.global_position - player.global_position
        if offset.x * facing < -16.0:
            continue
        if abs(offset.x) > attack_range or abs(offset.y) > half_height:
            continue

        targets.append(enemy)

    return targets


func can_target_enemy(enemy: Node) -> bool:
    if enemy == null or not is_instance_valid(enemy):
        return false

    return not ["enemy.captured", "enemy.swallowed", "enemy.defeated"].has(String(enemy.state))


func apply_damage_to_enemy(enemy: Node, amount: int, source: Dictionary = {}, knockback: float = 0.0) -> Dictionary:
    var result: Dictionary = enemy.call("take_damage", amount, source)
    if knockback != 0.0:
        enemy.call("apply_knockback", Vector2(get_player_facing_direction() * knockback, 0.0))

    if int(result.get("damage", 0)) <= 0:
        return result

    trace_recorder.call("record_player_event", "enemy.damaged", {
        "level_id": current_level_id,
        "player": get_player_trace(),
        "payload": result,
    })

    if bool(result.get("defeated", false)):
        mark_enemy_defeated(result)
        trace_recorder.call("record_player_event", "enemy.defeated", {
            "level_id": current_level_id,
            "player": get_player_trace(),
            "payload": result,
        })
        sync_inventory_overlay("enemy.defeated", true)

    sync_hud_overlay("enemy.damaged", true)
    write_persistent_state()
    return result


func check_ability_gate_interactions(ability_type: String, profile: Dictionary) -> void:
    if player == null or current_definition == null:
        return

    var gate_range := float(profile.get("range", 120.0))
    for gate in current_definition.ability_gates:
        var gate_id := String(gate.get("id", "ability_gate"))
        if opened_ability_gate_ids.has(gate_id):
            continue

        var payload: Dictionary = gate.get("payload", {})
        var required_ability_type := String(payload.get("required_ability_type", ""))
        if not ability_matches_requirement(ability_type, required_ability_type):
            continue

        var radius := float(payload.get("trigger_radius", gate_range))
        var gate_position := dictionary_to_vector2(gate.get("position", {}))
        if player.global_position.distance_to(gate_position) > radius:
            continue

        opened_ability_gate_ids[gate_id] = true
        var grants_item_id := String(payload.get("grants_item_id", ""))
        trace_recorder.call("record_player_event", "ability_gate.opened", {
            "level_id": current_level_id,
            "player": get_player_trace(),
            "payload": {
                "gate_id": gate_id,
                "required_ability_type": required_ability_type,
                "ability_type": ability_type,
                "gate_effect": String(payload.get("gate_effect", "open")),
                "opened_ability_gate_ids": get_opened_ability_gate_ids(),
                "grants_item_id": grants_item_id,
            },
        })
        if grants_item_id != "":
            acquire_item(grants_item_id, gate_id)
        sync_hud_overlay("ability_gate.opened", true)
        sync_inventory_overlay("ability_gate.opened", true)
        write_persistent_state()
        return


func ability_matches_requirement(ability_type: String, required_ability_type: String) -> bool:
    if required_ability_type == "":
        return false

    if ability_type == required_ability_type:
        return true

    if required_ability_type == "fire" and ability_type == "flame":
        return true

    if required_ability_type == "ice" and ability_type == "frost":
        return true

    return false


func clear_resolved_locked_door_reason(requirement_prefix: String, requirement_value: String) -> void:
    if last_locked_door_reason == "" or requirement_value == "":
        return

    var prefix := "%s:" % requirement_prefix
    if not last_locked_door_reason.begins_with(prefix):
        return

    var required_value := last_locked_door_reason.substr(prefix.length())
    if requirement_prefix == "missing_ability":
        if ability_matches_requirement(requirement_value, required_value):
            last_locked_door_reason = ""
        return

    if required_value == requirement_value:
        last_locked_door_reason = ""


func mark_enemy_defeated(result: Dictionary) -> void:
    var enemy_group_id := String(result.get("enemy_group_id", ""))
    if enemy_group_id != "":
        defeated_enemy_group_ids[enemy_group_id] = true
        clear_resolved_locked_door_reason("missing_defeated_enemy_group", enemy_group_id)

    var boss_id := String(result.get("boss_id", ""))
    if boss_id != "":
        defeated_boss_ids[boss_id] = true
        clear_resolved_locked_door_reason("missing_boss", boss_id)


func check_enemy_attacks(delta: float) -> void:
    if player == null or is_finished():
        return

    for enemy in enemies:
        if not is_instance_valid(enemy) or not can_target_enemy(enemy):
            continue

        if enemy.has_method("tick_attack_cooldown"):
            enemy.call("tick_attack_cooldown", delta)

        if player_invulnerability_remaining_ms > 0:
            continue

        if not enemy.has_method("can_attack_player") or not bool(enemy.call("can_attack_player", player)):
            continue

        var attack_payload: Dictionary = enemy.call("mark_attack_started")
        trace_recorder.call("record_player_event", "enemy.attack.started", {
            "level_id": current_level_id,
            "player": get_player_trace(),
            "payload": attack_payload,
        })
        damage_player(int(attack_payload.get("attack_damage", enemy.contact_damage)), {
            "source_type": "enemy_attack",
            "enemy": get_enemy_payload(enemy),
            "attack": attack_payload,
        })
        return


func check_enemy_contact_damage() -> void:
    if player == null or is_finished() or player_invulnerability_remaining_ms > 0:
        return

    for enemy in enemies:
        if not is_instance_valid(enemy) or not can_target_enemy(enemy):
            continue

        if player.global_position.distance_to(enemy.global_position) > contact_damage_radius:
            continue

        damage_player(int(enemy.contact_damage), {
            "source_type": "enemy_contact",
            "enemy": get_enemy_payload(enemy),
        })
        return


func check_hazard_contacts() -> void:
    if player == null or is_finished() or player_invulnerability_remaining_ms > 0:
        return

    for hazard in current_definition.hazards:
        var payload: Dictionary = hazard.get("payload", {})
        var radius := float(payload.get("trigger_radius", 40.0))
        var hazard_position := dictionary_to_vector2(hazard.get("position", {}))

        if player.global_position.distance_to(hazard_position) > radius:
            continue

        var hazard_id := String(hazard.get("id", "hazard"))
        var hazard_type := String(payload.get("hazard_type", "spike"))
        var damage := int(payload.get("damage", 1))
        trace_recorder.call("record_player_event", "hazard.entered", {
            "level_id": current_level_id,
            "player": get_player_trace(),
            "payload": {
                "hazard_id": hazard_id,
                "hazard_type": hazard_type,
                "damage": damage,
            },
        })
        damage_player(damage, {
            "source_type": "hazard",
            "hazard_id": hazard_id,
            "hazard_type": hazard_type,
        })
        return


func damage_player(amount: int, source: Dictionary = {}) -> void:
    if is_finished():
        return

    var normalized_amount: int = max(amount, 0)
    if normalized_amount <= 0:
        return

    player_hp = max(player_hp - normalized_amount, 0)
    trace_recorder.call("record_player_event", "player.damaged", {
        "level_id": current_level_id,
        "player": get_player_trace(),
        "payload": {
            "damage": normalized_amount,
            "hp": player_hp,
            "max_hp": player_max_hp,
            "source": source,
        },
    })
    sync_hud_overlay("player.damaged", true)
    var difficulty_profile := get_difficulty_profile()
    player_invulnerability_remaining_ms = max(int(difficulty_profile.get("player_invulnerability_ms", player_invulnerability_ms)), 0)

    if player_hp <= 0:
        if consume_player_revive(source):
            return
        write_persistent_state()
        finish_game_over(source)
        return

    write_persistent_state()


func finish_game_over(source: Dictionary = {}) -> void:
    if is_finished():
        return

    outcome = "game_over"
    trace_recorder.call("record_player_event", "player.defeated", {
        "level_id": current_level_id,
        "player": get_player_trace(),
        "payload": {
            "outcome": "game_over",
            "time_ms": run_time_ms,
            "frames": run_frame,
            "source": source,
        },
    })
    trace_recorder.call("record_player_event", "game.over", {
        "level_id": current_level_id,
        "player": get_player_trace(),
        "payload": {
            "outcome": "game_over",
            "time_ms": run_time_ms,
            "frames": run_frame,
        },
    })
    trace_recorder.call("record_player_event", "run.finished", {
        "level_id": current_level_id,
        "player": get_player_trace(),
        "payload": {
            "outcome": "game_over",
            "time_ms": run_time_ms,
            "frames": run_frame,
        },
    })
    sync_hud_overlay("game.over", true)
    show_result_overlay("game.over")


func tick_player_invulnerability(delta: float) -> void:
    if player_invulnerability_remaining_ms <= 0:
        return

    var elapsed_ms: int = int(round(max(delta, 0.0) * 1000.0))
    player_invulnerability_remaining_ms = max(player_invulnerability_remaining_ms - elapsed_ms, 0)


func tick_ability_cooldown(delta: float) -> void:
    if ability_cooldown_remaining_ms <= 0:
        return

    var elapsed_ms: int = int(round(max(delta, 0.0) * 1000.0))
    ability_cooldown_remaining_ms = max(ability_cooldown_remaining_ms - elapsed_ms, 0)


func check_heal_pickups() -> void:
    if player == null or is_finished():
        return

    for heal in current_definition.heals:
        var heal_id := String(heal.get("id", "heal"))
        if consumed_heal_ids.has(heal_id):
            continue

        var payload: Dictionary = heal.get("payload", {})
        var radius := float(payload.get("trigger_radius", heal_pickup_radius))
        var heal_position := dictionary_to_vector2(heal.get("position", {}))

        if player.global_position.distance_to(heal_position) > radius:
            continue

        consumed_heal_ids[heal_id] = true
        var amount := int(payload.get("amount", 1))
        var reward_type := String(payload.get("reward_type", "health"))
        trace_recorder.call("record_player_event", "heal.collected", {
            "level_id": current_level_id,
            "player": get_player_trace(),
            "payload": {
                "heal_id": heal_id,
                "amount": amount,
                "reward_type": reward_type,
            },
        })
        apply_heal_reward(amount, heal_id, reward_type)
        return


func apply_heal_reward(amount: int, heal_id: String = "", reward_type: String = "health") -> void:
    match reward_type:
        "max-health":
            increase_player_max_hp(max(amount, 1), heal_id)
        "revive":
            acquire_player_revive(max(amount, 1), heal_id)
        _:
            heal_player(amount, heal_id)


func increase_player_max_hp(amount: int, heal_id: String = "") -> void:
    var normalized_amount: int = max(amount, 0)
    if normalized_amount <= 0:
        return

    player_max_hp += normalized_amount
    player_hp = min(player_hp + normalized_amount, player_max_hp)
    trace_recorder.call("record_player_event", "player.max_hp_increased", {
        "level_id": current_level_id,
        "player": get_player_trace(),
        "payload": {
            "heal_id": heal_id,
            "amount": normalized_amount,
            "hp": player_hp,
            "max_hp": player_max_hp,
            "reward_type": "max-health",
        },
    })
    sync_hud_overlay("player.max_hp_increased", true)
    write_persistent_state()


func acquire_player_revive(amount: int, heal_id: String = "") -> void:
    var normalized_amount: int = max(amount, 0)
    if normalized_amount <= 0:
        return

    player_revive_count += normalized_amount
    trace_recorder.call("record_player_event", "player.revive_acquired", {
        "level_id": current_level_id,
        "player": get_player_trace(),
        "payload": {
            "heal_id": heal_id,
            "amount": normalized_amount,
            "revive_count": player_revive_count,
            "hp": player_hp,
            "max_hp": player_max_hp,
            "reward_type": "revive",
        },
    })
    sync_hud_overlay("player.revive_acquired", true)
    write_persistent_state()


func consume_player_revive(source: Dictionary = {}) -> bool:
    if player_revive_count <= 0:
        return false

    player_revive_count -= 1
    player_hp = max(player_max_hp, 1)
    trace_recorder.call("record_player_event", "player.revived", {
        "level_id": current_level_id,
        "player": get_player_trace(),
        "payload": {
            "revive_count": player_revive_count,
            "hp": player_hp,
            "max_hp": player_max_hp,
            "source": source,
        },
    })
    sync_hud_overlay("player.revived", true)
    write_persistent_state()
    return true


func heal_player(amount: int, heal_id: String = "") -> void:
    var difficulty_profile := get_difficulty_profile()
    var normalized_amount: int = max(int(round(float(amount) * float(difficulty_profile.get("heal_multiplier", 1.0)))), 0)
    if normalized_amount <= 0:
        return

    var previous_hp := player_hp
    player_hp = min(player_hp + normalized_amount, player_max_hp)
    if player_hp == previous_hp:
        return

    trace_recorder.call("record_player_event", "player.healed", {
        "level_id": current_level_id,
        "player": get_player_trace(),
        "payload": {
            "heal_id": heal_id,
            "amount": normalized_amount,
            "hp": player_hp,
            "max_hp": player_max_hp,
        },
    })
    sync_hud_overlay("player.healed", true)
    write_persistent_state()


func check_collectible_pickups() -> void:
    if player == null or is_finished():
        return

    for collectible in current_definition.collectibles:
        var collectible_id := String(collectible.get("id", "collectible"))
        if collected_collectible_ids.has(collectible_id):
            continue

        var payload: Dictionary = collectible.get("payload", {})
        var radius := float(payload.get("trigger_radius", 48.0))
        var collectible_position := dictionary_to_vector2(collectible.get("position", {}))

        if player.global_position.distance_to(collectible_position) > radius:
            continue

        var item_id := String(payload.get("item_id", collectible_id))
        collected_collectible_ids[collectible_id] = true
        trace_recorder.call("record_player_event", "collectible.collected", {
            "level_id": current_level_id,
            "player": get_player_trace(),
            "payload": {
                "collectible_id": collectible_id,
                "item_id": item_id,
            },
        })
        acquire_item(item_id, collectible_id)
        return


func acquire_item(item_id: String, collectible_id: String = "") -> void:
    if item_id == "" or acquired_item_ids.has(item_id):
        return

    acquired_item_ids[item_id] = true
    clear_resolved_locked_door_reason("missing_item", item_id)
    trace_recorder.call("record_player_event", "item.acquired", {
        "level_id": current_level_id,
        "player": get_player_trace(),
        "payload": {
            "item_id": item_id,
            "collectible_id": collectible_id,
            "items_collected": get_acquired_item_ids(),
        },
    })
    sync_hud_overlay("item.acquired", true)
    sync_inventory_overlay("item.acquired", true)
    write_persistent_state()


func get_acquired_item_ids() -> Array:
    var item_ids := acquired_item_ids.keys()
    item_ids.sort()
    return item_ids


func get_consumed_heal_ids() -> Array:
    var heal_ids := consumed_heal_ids.keys()
    heal_ids.sort()
    return heal_ids


func get_completed_level_ids() -> Array:
    var level_ids := completed_level_ids.keys()
    level_ids.sort()
    return level_ids


func get_visited_level_ids() -> Array:
    var level_ids := visited_level_ids.keys()
    level_ids.sort()
    return level_ids


func get_unlocked_door_ids() -> Array:
    var door_ids := unlocked_door_ids.keys()
    door_ids.sort()
    return door_ids


func get_defeated_enemy_group_ids() -> Array:
    var group_ids := defeated_enemy_group_ids.keys()
    group_ids.sort()
    return group_ids


func get_defeated_boss_ids() -> Array:
    var boss_ids := defeated_boss_ids.keys()
    boss_ids.sort()
    return boss_ids


func get_opened_ability_gate_ids() -> Array:
    var gate_ids := opened_ability_gate_ids.keys()
    gate_ids.sort()
    return gate_ids


func get_explored_tiles_payload() -> Dictionary:
    var payload := {}
    var level_ids := explored_tiles.keys()
    level_ids.sort()
    for level_id in level_ids:
        var level_tiles: Dictionary = explored_tiles[level_id]
        var tile_keys := level_tiles.keys()
        tile_keys.sort()
        payload[String(level_id)] = tile_keys

    return payload


func get_explored_tile_count() -> int:
    var count := 0
    for level_id in explored_tiles.keys():
        var level_tiles: Dictionary = explored_tiles[level_id]
        count += level_tiles.size()

    return count


func setup_map_overlay() -> void:
    if not map_overlay_enabled:
        return

    map_overlay = MapOverlayScene.instantiate()
    add_child(map_overlay)


func setup_hud_overlay() -> void:
    if not hud_overlay_enabled:
        return

    hud_overlay = HudOverlayScene.instantiate()
    add_child(hud_overlay)


func setup_result_overlay() -> void:
    if not result_overlay_enabled:
        return

    result_overlay = ResultOverlayScene.instantiate()
    add_child(result_overlay)


func setup_settings_overlay() -> void:
    if not settings_overlay_enabled:
        return

    settings_overlay = SettingsOverlayScene.instantiate()
    add_child(settings_overlay)


func setup_inventory_overlay() -> void:
    if not inventory_overlay_enabled:
        return

    inventory_overlay = InventoryOverlayScene.instantiate()
    add_child(inventory_overlay)


func setup_audio_players() -> void:
    if not audio_enabled:
        return

    bgm_player = AudioStreamPlayer.new()
    bgm_player.name = "BgmPlayer"
    bgm_player.stream = BgmMain
    bgm_player.volume_db = linear_to_db(clampf(setting_volume, 0.0, 1.0))
    add_child(bgm_player)
    bgm_player.play()

    sfx_player = AudioStreamPlayer.new()
    sfx_player.name = "SfxPlayer"
    sfx_player.volume_db = linear_to_db(clampf(setting_volume, 0.0, 1.0))
    add_child(sfx_player)


func play_sfx(stream: AudioStream) -> void:
    if not audio_enabled or sfx_player == null or stream == null:
        return

    sfx_player.stream = stream
    sfx_player.volume_db = linear_to_db(clampf(setting_volume, 0.0, 1.0))
    sfx_player.play()


func get_ability_sfx(current_ability_type: String) -> AudioStream:
    match current_ability_type:
        "ice", "frost":
            return SfxAbilityIceAttack
        "sword":
            return SfxAbilitySwordAttack
        _:
            return SfxAbilityFireAttack


func get_difficulty_profile() -> Dictionary:
    match sanitize_setting_difficulty(setting_difficulty):
        "easy":
            return {
                "enemy_hp_multiplier": 0.75,
                "contact_damage_multiplier": 0.5,
                "enemy_attack_cooldown_multiplier": 1.25,
                "player_invulnerability_ms": 1100,
                "heal_multiplier": 1.5,
            }
        "hard":
            return {
                "enemy_hp_multiplier": 1.5,
                "contact_damage_multiplier": 1.5,
                "enemy_attack_cooldown_multiplier": 0.75,
                "player_invulnerability_ms": 550,
                "heal_multiplier": 0.75,
            }
        _:
            return {
                "enemy_hp_multiplier": 1.0,
                "contact_damage_multiplier": 1.0,
                "enemy_attack_cooldown_multiplier": 1.0,
                "player_invulnerability_ms": player_invulnerability_ms,
                "heal_multiplier": 1.0,
            }


func apply_difficulty_to_enemy(enemy: Node) -> void:
    var profile := get_difficulty_profile()
    enemy.max_hp = max(int(round(float(enemy.max_hp) * float(profile.get("enemy_hp_multiplier", 1.0)))), 1)
    enemy.hp = enemy.max_hp
    enemy.contact_damage = scale_enemy_damage_for_difficulty(int(enemy.contact_damage), profile)
    enemy.attack_damage = scale_enemy_damage_for_difficulty(int(enemy.attack_damage), profile)
    enemy.attack_cooldown_ms = max(int(round(float(enemy.attack_cooldown_ms) * float(profile.get("enemy_attack_cooldown_multiplier", 1.0)))), 120)


func scale_enemy_damage_for_difficulty(amount: int, profile: Dictionary) -> int:
    if amount <= 0:
        return 0

    return max(int(ceil(float(amount) * float(profile.get("contact_damage_multiplier", 1.0)))), 1)


func sync_map_overlay(reason: String = "", emit_trace: bool = false) -> void:
    var explored_payload := get_explored_tiles_payload()
    if map_overlay != null and is_instance_valid(map_overlay):
        map_overlay.call("set_map_state", current_level_id, explored_payload)

    if not emit_trace or trace_recorder == null:
        return

    trace_recorder.call("record_event", "map.updated", {
        "reason": reason,
        "current_level_id": current_level_id,
        "explored_tiles": explored_payload,
        "explored_tile_count": get_explored_tile_count(),
        "visible_tile_count": int(map_overlay.call("get_visible_tile_count")) if map_overlay != null and is_instance_valid(map_overlay) else get_explored_tile_count(),
    })


func sync_hud_overlay(reason: String = "", emit_trace: bool = false) -> void:
    var hud_payload := build_hud_payload()
    if hud_overlay != null and is_instance_valid(hud_overlay):
        hud_overlay.call("set_hud_state", hud_payload)

    if not emit_trace or trace_recorder == null:
        return

    hud_payload["reason"] = reason
    trace_recorder.call("record_event", "hud.updated", hud_payload)


func build_hud_payload() -> Dictionary:
    return {
        "level_id": current_level_id,
        "hp": player_hp,
        "max_hp": player_max_hp,
        "revive_count": player_revive_count,
        "ability_type": get_player_ability_type(),
        "items_collected": get_acquired_item_ids(),
        "difficulty": sanitize_setting_difficulty(setting_difficulty),
        "objective_text": get_current_objective_text(),
        "ability_cooldown_ms": ability_cooldown_remaining_ms,
        "locked_door_reason": last_locked_door_reason,
        "target_enemy_hp": get_target_enemy_hp(),
        "outcome": outcome,
    }


func get_current_objective_text() -> String:
    if last_locked_door_reason != "":
        return "Unlock door: %s" % last_locked_door_reason
    if get_player_ability_type() == "" and captured_enemy == null and current_level_id == "combat_room":
        return "Inhale an enemy and swallow it to gain an ability"
    if get_target_enemy_hp() > 0:
        return "Defeat nearby enemies"
    if current_definition != null and current_definition.doors.size() > 0:
        return "Find the next door"
    return "Reach the goal"


func get_target_enemy_hp() -> int:
    if player == null:
        return 0

    var nearest_enemy = null
    var nearest_distance := 999999.0
    for enemy in enemies:
        if not is_instance_valid(enemy) or not can_target_enemy(enemy):
            continue

        var distance: float = player.global_position.distance_to(enemy.global_position)
        if distance >= nearest_distance:
            continue

        nearest_enemy = enemy
        nearest_distance = distance

    if nearest_enemy == null:
        return 0

    return int(nearest_enemy.hp)


func sync_inventory_overlay(reason: String = "", emit_trace: bool = false) -> void:
    var inventory_payload := build_inventory_payload()
    if inventory_overlay != null and is_instance_valid(inventory_overlay):
        inventory_overlay.call("set_inventory_state", inventory_payload)

    if not emit_trace or trace_recorder == null:
        return

    inventory_payload["reason"] = reason
    trace_recorder.call("record_event", "inventory.updated", inventory_payload)


func build_inventory_payload() -> Dictionary:
    return {
        "items_collected": get_acquired_item_ids(),
        "ability_type": get_player_ability_type(),
        "completed_level_ids": get_completed_level_ids(),
        "visited_level_ids": get_visited_level_ids(),
        "unlocked_door_ids": get_unlocked_door_ids(),
        "defeated_enemy_group_ids": get_defeated_enemy_group_ids(),
        "defeated_boss_ids": get_defeated_boss_ids(),
        "opened_ability_gate_ids": get_opened_ability_gate_ids(),
    }


func sync_settings_overlay(reason: String = "", emit_trace: bool = false) -> void:
    var settings_payload := build_settings_payload()
    if settings_overlay != null and is_instance_valid(settings_overlay):
        settings_overlay.call("set_settings_state", settings_payload)

    if not emit_trace or trace_recorder == null:
        return

    settings_payload["reason"] = reason
    trace_recorder.call("record_event", "settings.updated", settings_payload)


func build_settings_payload() -> Dictionary:
    return get_settings_payload()


func check_settings_actions() -> void:
    if is_session_action_just_pressed(settings_volume_up_action):
        apply_settings_update({
            "volume": setting_volume + settings_volume_step,
        }, "settings.volume_up")

    if is_session_action_just_pressed(settings_volume_down_action):
        apply_settings_update({
            "volume": setting_volume - settings_volume_step,
        }, "settings.volume_down")

    if is_session_action_just_pressed(settings_cycle_controls_action):
        apply_settings_update({
            "controls": cycle_string(setting_controls, ["keyboard", "touch", "controller"]),
        }, "settings.controls.cycled")

    if is_session_action_just_pressed(settings_cycle_difficulty_action):
        apply_settings_update({
            "difficulty": cycle_string(setting_difficulty, ["easy", "normal", "hard"]),
        }, "settings.difficulty.cycled")


func apply_settings_update(next_settings: Dictionary, reason: String = "settings.updated") -> void:
    apply_settings_payload(next_settings)
    sync_settings_overlay(reason, true)
    write_persistent_state()


func is_session_action_just_pressed(action: StringName) -> bool:
    if input_source != null and input_source.has_method("is_action_just_pressed"):
        return input_source.is_action_just_pressed(action)

    return Input.is_action_just_pressed(action)


func cycle_string(current_value: String, values: Array) -> String:
    if values.is_empty():
        return current_value

    var current_index := values.find(current_value)
    if current_index < 0:
        return String(values[0])

    return String(values[(current_index + 1) % values.size()])


func show_result_overlay(reason: String = "") -> void:
    var result_payload := build_result_payload()
    if result_overlay != null and is_instance_valid(result_overlay):
        result_overlay.call("set_result_state", result_payload)

    if trace_recorder == null:
        return

    result_payload["reason"] = reason
    trace_recorder.call("record_event", "result.overlay.shown", result_payload)


func build_result_payload() -> Dictionary:
    return {
        "level_id": current_level_id,
        "outcome": outcome,
        "time_ms": run_time_ms,
        "frames": run_frame,
        "items_collected": get_acquired_item_ids(),
        "completed_level_ids": get_completed_level_ids(),
    }


func load_persistent_state() -> void:
    if not save_enabled:
        return

    var state = save_store.call("load_state", save_path)
    saved_level_id = String(state.current_level_id)
    saved_ability_type = String(state.ability_type)
    for item_id in state.acquired_item_ids:
        acquired_item_ids[String(item_id)] = true
    for heal_id in state.consumed_heal_ids:
        consumed_heal_ids[String(heal_id)] = true
    for level_id in state.completed_level_ids:
        completed_level_ids[String(level_id)] = true
    for level_id in state.visited_level_ids:
        visited_level_ids[String(level_id)] = true
    for door_id in state.unlocked_door_ids:
        unlocked_door_ids[String(door_id)] = true
    for group_id in state.defeated_enemy_group_ids:
        defeated_enemy_group_ids[String(group_id)] = true
    for boss_id in state.defeated_boss_ids:
        defeated_boss_ids[String(boss_id)] = true
    for gate_id in state.opened_ability_gate_ids:
        opened_ability_gate_ids[String(gate_id)] = true
    for level_id in state.explored_tiles.keys():
        var normalized_level_id := String(level_id)
        var level_tiles := {}
        for tile_key in state.explored_tiles[level_id]:
            level_tiles[String(tile_key)] = true
        explored_tiles[normalized_level_id] = level_tiles
    apply_settings_payload(state.settings)

    if int(state.player_max_hp) > 0:
        player_max_hp = int(state.player_max_hp)
    if int(state.player_hp) > 0:
        player_hp = min(int(state.player_hp), player_max_hp)
    player_revive_count = max(int(state.player_revive_count), 0)
    if typeof(state.player_position) == TYPE_DICTIONARY and not state.player_position.is_empty():
        saved_player_position = dictionary_to_vector2(state.player_position)
        has_saved_player_position = true

    trace_recorder.call("record_event", "save.loaded", {
        "save_path": save_path,
        "items_collected": get_acquired_item_ids(),
        "consumed_heal_ids": get_consumed_heal_ids(),
        "completed_level_ids": get_completed_level_ids(),
        "visited_level_ids": get_visited_level_ids(),
        "unlocked_door_ids": get_unlocked_door_ids(),
        "defeated_enemy_group_ids": get_defeated_enemy_group_ids(),
        "defeated_boss_ids": get_defeated_boss_ids(),
        "opened_ability_gate_ids": get_opened_ability_gate_ids(),
        "explored_tiles": get_explored_tiles_payload(),
        "current_level_id": String(state.current_level_id),
        "player_position": get_saved_player_position_payload(),
        "ability_type": saved_ability_type,
        "settings": get_settings_payload(),
        "player_hp": player_hp,
        "player_max_hp": player_max_hp,
        "player_revive_count": player_revive_count,
    })

    if String(save_store.get("error_message")) != "":
        trace_recorder.call("record_event", "save.error", {
            "operation": "load",
            "save_path": save_path,
            "message": save_store.get("error_message"),
        })


func write_persistent_state() -> void:
    if not save_enabled:
        return

    if save_store.call("save_state", save_path, build_save_payload()):
        trace_recorder.call("record_event", "save.written", {
            "save_path": save_path,
            "items_collected": get_acquired_item_ids(),
            "consumed_heal_ids": get_consumed_heal_ids(),
            "completed_level_ids": get_completed_level_ids(),
            "visited_level_ids": get_visited_level_ids(),
            "unlocked_door_ids": get_unlocked_door_ids(),
            "defeated_enemy_group_ids": get_defeated_enemy_group_ids(),
            "defeated_boss_ids": get_defeated_boss_ids(),
            "opened_ability_gate_ids": get_opened_ability_gate_ids(),
            "explored_tiles": get_explored_tiles_payload(),
            "current_level_id": current_level_id,
            "player_position": get_player_position_payload(),
            "ability_type": get_player_ability_type(),
            "settings": get_settings_payload(),
            "player_hp": player_hp,
            "player_max_hp": player_max_hp,
            "player_revive_count": player_revive_count,
        })
        return

    trace_recorder.call("record_event", "save.error", {
        "operation": "write",
        "save_path": save_path,
        "message": save_store.get("error_message"),
    })


func build_save_payload() -> Dictionary:
    return {
        "acquired_item_ids": get_acquired_item_ids(),
        "consumed_heal_ids": get_consumed_heal_ids(),
        "completed_level_ids": get_completed_level_ids(),
        "visited_level_ids": get_visited_level_ids(),
        "unlocked_door_ids": get_unlocked_door_ids(),
        "defeated_enemy_group_ids": get_defeated_enemy_group_ids(),
        "defeated_boss_ids": get_defeated_boss_ids(),
        "opened_ability_gate_ids": get_opened_ability_gate_ids(),
        "explored_tiles": get_explored_tiles_payload(),
        "current_level_id": current_level_id,
        "player_position": get_player_position_payload(),
        "ability_type": get_player_ability_type(),
        "settings": get_settings_payload(),
        "player_hp": player_hp,
        "player_max_hp": player_max_hp,
        "player_revive_count": player_revive_count,
    }


func get_player_position_payload() -> Dictionary:
    if player == null:
        return {}

    return {
        "x": player.global_position.x,
        "y": player.global_position.y,
    }


func get_saved_player_position_payload() -> Dictionary:
    if not has_saved_player_position:
        return {}

    return {
        "x": saved_player_position.x,
        "y": saved_player_position.y,
    }


func apply_saved_player_position() -> void:
    if not has_saved_player_position or player == null or saved_level_id != current_level_id:
        return

    player.global_position = saved_player_position
    player.velocity = Vector2.ZERO


func get_player_ability_type() -> String:
    if player == null:
        return ""

    return String(player.ability_type)


func apply_saved_ability_type() -> void:
    if player == null or saved_ability_type == "":
        return

    player.call("set_ability_type", saved_ability_type)


func get_settings_payload() -> Dictionary:
    return {
        "volume": clampf(setting_volume, 0.0, 1.0),
        "controls": sanitize_setting_controls(setting_controls),
        "difficulty": sanitize_setting_difficulty(setting_difficulty),
    }


func apply_settings_payload(settings: Dictionary) -> void:
    setting_volume = clampf(float(settings.get("volume", setting_volume)), 0.0, 1.0)
    setting_controls = sanitize_setting_controls(String(settings.get("controls", setting_controls)))
    setting_difficulty = sanitize_setting_difficulty(String(settings.get("difficulty", setting_difficulty)))


func sanitize_setting_controls(controls: String) -> String:
    if ["keyboard", "touch", "controller"].has(controls):
        return controls

    return "keyboard"


func sanitize_setting_difficulty(difficulty: String) -> String:
    if ["easy", "normal", "hard"].has(difficulty):
        return difficulty

    return "normal"


func mark_player_tile_explored() -> bool:
    if player == null or current_level_id == "" or exploration_tile_size <= 0:
        return false

    var column: int = max(int(floor(player.global_position.x / float(exploration_tile_size))), 0)
    var row: int = max(int(floor(player.global_position.y / float(exploration_tile_size))), 0)
    var tile_key := "%d,%d" % [column, row]

    if not explored_tiles.has(current_level_id):
        explored_tiles[current_level_id] = {}

    var level_tiles: Dictionary = explored_tiles[current_level_id]
    if level_tiles.has(tile_key):
        return false

    level_tiles[tile_key] = true
    return true


func mark_level_visited(level_id: String) -> void:
    if level_id == "":
        return

    visited_level_ids[level_id] = true


func unlock_door(door_id: String) -> void:
    if door_id == "":
        return

    unlocked_door_ids[door_id] = true


func complete_level(level_id: String) -> void:
    if level_id == "":
        return

    completed_level_ids[level_id] = true
    clear_resolved_locked_door_reason("missing_completed_level", level_id)
    sync_inventory_overlay("level.completed", true)
    write_persistent_state()


func check_door_transitions() -> void:
    for door in current_definition.doors:
        var payload: Dictionary = door.get("payload", {})
        var radius := float(payload.get("trigger_radius", 64.0))
        var door_position := dictionary_to_vector2(door.get("position", {}))

        if player.global_position.distance_to(door_position) > radius:
            continue

        var source_level_id := current_level_id
        var door_id := String(door.get("id", ""))
        var target_level_id := String(payload.get("target_level_id", ""))
        var target_spawn_id := String(payload.get("target_spawn_id", "default"))
        var unlocked_door_id := "%s:%s" % [source_level_id, door_id]
        var lock_reason := get_door_lock_reason(payload)
        if lock_reason != "":
            last_locked_door_reason = lock_reason
            trace_recorder.call("record_player_event", "door.locked", {
                "level_id": current_level_id,
                "player": get_player_trace(),
                "payload": {
                    "door_id": door_id,
                    "target_level_id": target_level_id,
                    "target_spawn_id": target_spawn_id,
                    "reason": lock_reason,
                },
            })
            sync_hud_overlay("door.locked", true)
            return

        last_locked_door_reason = ""
        unlock_door(unlocked_door_id)
        trace_recorder.call("record_player_event", "door.entered", {
            "level_id": current_level_id,
            "player": get_player_trace(),
            "payload": {
                "door_id": door_id,
                "unlocked_door_id": unlocked_door_id,
                "target_level_id": target_level_id,
                "target_spawn_id": target_spawn_id,
            },
        })
        if load_level(target_level_id, target_spawn_id):
            mark_level_visited(current_level_id)
            var transition_tile_changed := mark_player_tile_explored()
            sync_map_overlay("door.transition", transition_tile_changed)
            sync_hud_overlay("door.transition", true)
            sync_inventory_overlay("door.transition", true)
            write_persistent_state()
        return


func get_door_lock_reason(payload: Dictionary) -> String:
    var required_item_id := String(payload.get("required_item_id", ""))
    if required_item_id != "" and not acquired_item_ids.has(required_item_id):
        return "missing_item:" + required_item_id

    var required_ability_type := String(payload.get("required_ability_type", ""))
    if required_ability_type != "" and not ability_matches_requirement(get_player_ability_type(), required_ability_type):
        return "missing_ability:" + required_ability_type

    var required_completed_level_id := String(payload.get("required_completed_level_id", ""))
    if required_completed_level_id != "" and not completed_level_ids.has(required_completed_level_id):
        return "missing_completed_level:" + required_completed_level_id

    var required_defeated_enemy_group_id := String(payload.get("required_defeated_enemy_group_id", ""))
    if required_defeated_enemy_group_id != "" and not defeated_enemy_group_ids.has(required_defeated_enemy_group_id):
        return "missing_defeated_enemy_group:" + required_defeated_enemy_group_id

    var required_boss_id := String(payload.get("required_boss_id", ""))
    if required_boss_id != "" and not defeated_boss_ids.has(required_boss_id):
        return "missing_boss:" + required_boss_id

    return ""


func check_goal_reached() -> void:
    for goal in current_definition.goals:
        var payload: Dictionary = goal.get("payload", {})
        var radius := float(payload.get("trigger_radius", 64.0))
        var goal_position := dictionary_to_vector2(goal.get("position", {}))

        if player.global_position.distance_to(goal_position) > radius:
            continue

        outcome = "completed"
        complete_level(current_level_id)
        trace_recorder.call("record_player_event", "run.finished", {
            "level_id": current_level_id,
            "player": get_player_trace(),
            "payload": {
                "goal_id": goal.get("id", ""),
                "result_label": payload.get("result_label", "complete"),
                "time_ms": run_time_ms,
                "frames": run_frame,
            },
        })
        sync_hud_overlay("run.finished", true)
        show_result_overlay("run.finished")
        return


func is_finished() -> bool:
    return outcome != "running"


func find_marker_by_id(markers: Array, marker_id: String) -> Dictionary:
    for marker in markers:
        if String(marker.get("id", "")) == marker_id:
            return marker

    return {}


func dictionary_to_vector2(data: Dictionary) -> Vector2:
    return Vector2(float(data.get("x", 0.0)), float(data.get("y", 0.0)))


func get_player_trace() -> Dictionary:
    return {
        "position": {
            "x": player.global_position.x,
            "y": player.global_position.y,
        },
        "velocity": {
            "x": player.velocity.x,
            "y": player.velocity.y,
        },
    }


func get_enemy_payload(enemy: Node) -> Dictionary:
    return {
        "enemy_id": enemy.enemy_id,
        "ability_type": enemy.ability_type,
        "state": enemy.state,
        "hp": int(enemy.hp),
        "max_hp": int(enemy.max_hp),
        "attack_damage": int(enemy.attack_damage),
        "attack_radius": float(enemy.attack_radius),
        "attack_cooldown_ms": int(enemy.attack_cooldown_ms),
        "enemy_group_id": String(enemy.enemy_group_id),
        "boss_id": String(enemy.boss_id),
        "position": {
            "x": enemy.global_position.x,
            "y": enemy.global_position.y,
        },
    }


func on_player_trace_event(event_type: String, payload: Dictionary) -> void:
    trace_recorder.call("record_player_event", event_type, payload)
