extends Node
class_name GameSession

const PlayerScene = preload("res://scenes/player/Player.tscn")
const SimpleEnemyScene = preload("res://scenes/enemies/SimpleEnemy.tscn")
const FlyingEnemyScene = preload("res://scenes/enemies/FlyingEnemy.tscn")
const AbilityProjectileScene = preload("res://scenes/combat/AbilityProjectile.tscn")
const LevelLoaderScript = preload("res://scripts/level/LevelLoader.gd")
const LevelVisualAssetsScript = preload("res://scripts/level/LevelVisualAssets.gd")
const TraceRecorderScript = preload("res://scripts/sim/TraceRecorder.gd")
const SaveStoreScript = preload("res://scripts/save/SaveStore.gd")
const MapOverlayScene = preload("res://scenes/ui/MapOverlay.tscn")
const HudOverlayScene = preload("res://scenes/ui/HudOverlay.tscn")
const ResultOverlayScene = preload("res://scenes/ui/ResultOverlay.tscn")
const ResultsSceneScene = preload("res://scenes/ui/ResultsScene.tscn")
const ErrorOverlayScene = preload("res://scenes/ui/ErrorOverlay.tscn")
const PauseOverlayScene = preload("res://scenes/ui/PauseOverlay.tscn")
const PauseSceneScene = preload("res://scenes/ui/PauseScene.tscn")
const SettingsOverlayScene = preload("res://scenes/ui/SettingsOverlay.tscn")
const VirtualControlsOverlayScene = preload("res://scenes/ui/VirtualControlsOverlay.tscn")
const InventoryOverlayScene = preload("res://scenes/ui/InventoryOverlay.tscn")
const BgmMain = preload("res://resources/assets/audio/bgm-main.wav")
const SfxKirdyInhale = preload("res://resources/assets/audio/sfx/kirdy-inhale.wav")
const SfxKirdySwallow = preload("res://resources/assets/audio/sfx/kirdy-swallow.wav")
const SfxKirdySpit = preload("res://resources/assets/audio/sfx/kirdy-spit.wav")
const SfxAbilityFireAttack = preload("res://resources/assets/audio/sfx/ability-fire-attack.wav")
const SfxAbilityIceAttack = preload("res://resources/assets/audio/sfx/ability-ice-attack.wav")
const SfxAbilitySwordAttack = preload("res://resources/assets/audio/sfx/ability-sword-attack.wav")
const SCORE_PER_ITEM := 1000
const SCORE_PER_COMPLETED_LEVEL := 500
const SCORE_PER_DEFEATED_GROUP := 300
const SCORE_PER_DEFEATED_BOSS := 1000
const SCORE_PER_REMAINING_HP := 100
const SCORE_PER_REVIVE := 500
const CLUSTER_KEYSTONE_REQUIREMENTS := {
    "ice": "forest-keystone",
    "fire": "ice-keystone",
    "ruins": "fire-keystone",
    "sky": "cave-keystone",
}

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
var active_ability_projectiles: Array = []
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
var enemy_crowd_spacing_traced_level_ids: Dictionary = {}
var discovered_hidden_feature_ids: Dictionary = {}
var completed_dead_end_ids: Dictionary = {}
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
var results_scene: Control = null
var error_overlay: Control = null
var pause_overlay: Control = null
var settings_overlay: Control = null
var virtual_controls_overlay: Control = null
var inventory_overlay: Control = null
var bgm_player: AudioStreamPlayer = null
var sfx_player: AudioStreamPlayer = null

var level_loader = null
var level_visual_assets = LevelVisualAssetsScript.new()
var requested_spawn_id: String = "default"
var session_paused: bool = false
var pause_settings_open: bool = false
var pause_scene_visible_traced: bool = false
var settings_menu_open: bool = false
var selected_setting_index: int = 0
var result_elapsed_ms: int = 0
var results_scene_shown: bool = false
var runtime_error_message: String = ""
var runtime_error_reason: String = ""
var error_retry_level_id: String = ""
var error_retry_spawn_id: String = "default"
var error_retry_fps: int = 60

@export var auto_start: bool = true
@export var initial_level_id: String = "central_hub"
@export var initial_spawn_id: String = "default"
@export var save_enabled: bool = false
@export var save_path: String = "user://fake_kirdy_save.json"
@export var player_max_hp: int = 3
@export var max_active_enemy_count: int = 3
@export var enemy_crowd_player_radius: float = 112.0
@export var enemy_crowd_min_player_distance: float = 72.0
@export var contact_damage_radius: float = 48.0
@export var heal_pickup_radius: float = 48.0
@export var player_invulnerability_ms: int = 800
@export var setting_volume: float = 0.4
@export var setting_controls: String = "keyboard"
@export var setting_difficulty: String = "normal"
@export var settings_volume_step: float = 0.1
@export var settings_menu_action: StringName = &"settings_menu"
@export var settings_focus_next_action: StringName = &"settings_focus_next"
@export var settings_focus_previous_action: StringName = &"settings_focus_previous"
@export var settings_volume_up_action: StringName = &"settings_volume_up"
@export var settings_volume_down_action: StringName = &"settings_volume_down"
@export var settings_cycle_controls_action: StringName = &"settings_cycle_controls"
@export var settings_cycle_difficulty_action: StringName = &"settings_cycle_difficulty"
@export var exploration_tile_size: int = 32
@export var map_overlay_enabled: bool = true
@export var map_toggle_action: StringName = &"map_toggle"
@export var hud_overlay_enabled: bool = true
@export var result_overlay_enabled: bool = true
@export var result_restart_action: StringName = &"result_restart"
@export var result_continue_action: StringName = &"result_continue"
@export var result_auto_results_delay_ms: int = 3000
@export var cluster_keystone_progression_enabled: bool = true
@export var error_overlay_enabled: bool = true
@export var error_retry_action: StringName = &"result_restart"
@export var pause_menu_enabled: bool = true
@export var pause_scene_enabled: bool = true
@export var pause_toggle_action: StringName = &"pause_toggle"
@export var pause_settings_action: StringName = &"pause_settings"
@export var settings_overlay_enabled: bool = true
@export var virtual_controls_enabled: bool = true
@export var inventory_overlay_enabled: bool = true
@export var audio_enabled: bool = true
@export var bgm_volume_scale: float = 0.65
@export var sfx_volume_scale: float = 1.0
@export var ui_sfx_volume_scale: float = 0.75
@export var audio_ducking_volume_scale: float = 0.45


func _ready() -> void:
    set_physics_process(false)
    if auto_start:
        start_session(initial_level_id, initial_spawn_id)


func start_session(start_level_id: String, start_spawn_id: String = "default", fps: int = 60) -> bool:
    replay_fps = max(fps, 1)
    run_frame = 0
    run_time_ms = 0
    outcome = "running"
    session_paused = false
    pause_settings_open = false
    pause_scene_visible_traced = false
    settings_menu_open = false
    selected_setting_index = 0
    result_elapsed_ms = 0
    results_scene_shown = false
    runtime_error_message = ""
    runtime_error_reason = ""
    error_retry_level_id = start_level_id
    error_retry_spawn_id = start_spawn_id
    error_retry_fps = replay_fps
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
    enemy_crowd_spacing_traced_level_ids.clear()
    discovered_hidden_feature_ids.clear()
    completed_dead_end_ids.clear()
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
    if results_scene != null and is_instance_valid(results_scene):
        results_scene.queue_free()
    results_scene = null
    if error_overlay != null and is_instance_valid(error_overlay):
        error_overlay.queue_free()
    error_overlay = null
    if pause_overlay != null and is_instance_valid(pause_overlay):
        pause_overlay.queue_free()
    pause_overlay = null
    if settings_overlay != null and is_instance_valid(settings_overlay):
        settings_overlay.queue_free()
    settings_overlay = null
    if virtual_controls_overlay != null and is_instance_valid(virtual_controls_overlay):
        virtual_controls_overlay.queue_free()
    virtual_controls_overlay = null
    if inventory_overlay != null and is_instance_valid(inventory_overlay):
        inventory_overlay.queue_free()
    inventory_overlay = null
    if bgm_player != null and is_instance_valid(bgm_player):
        bgm_player.queue_free()
    bgm_player = null
    if sfx_player != null and is_instance_valid(sfx_player):
        sfx_player.queue_free()
    sfx_player = null

    level_loader = LevelLoaderScript.new()
    trace_recorder = TraceRecorderScript.new()
    save_store = SaveStoreScript.new()
    add_child(level_loader)
    add_child(trace_recorder)
    add_child(save_store)
    setup_map_overlay()
    setup_hud_overlay()
    setup_result_overlay()
    setup_results_scene()
    setup_error_overlay()
    setup_pause_overlay()
    setup_settings_overlay()
    setup_virtual_controls_overlay()
    setup_inventory_overlay()
    setup_audio_players()
    trace_recorder.call("configure", start_level_id, replay_fps)
    load_persistent_state()
    update_audio_mix("session.started", true)
    sync_map_overlay("save.loaded")
    sync_hud_overlay("save.loaded", save_enabled)
    sync_settings_overlay("save.loaded", save_enabled)
    sync_virtual_controls_overlay("save.loaded", save_enabled)
    sync_inventory_overlay("save.loaded", save_enabled)

    player = PlayerScene.instantiate()
    player.input_source = input_source

    if player.has_signal("trace_event"):
        player.trace_event.connect(on_player_trace_event)

    if not load_level(start_level_id, start_spawn_id):
        var error_message := "Unable to load level: %s" % start_level_id
        trace_recorder.call("record_replay_error", error_message)
        outcome = "error"
        show_error_overlay(error_message, "load_level", start_level_id, start_spawn_id)
        set_physics_process(true)
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
    if outcome == "error":
        check_error_actions()
        return

    if is_finished():
        result_elapsed_ms += int(round(delta * 1000.0))
        check_result_actions()
        return

    check_pause_actions()
    if session_paused:
        if pause_settings_open:
            check_settings_menu_actions()
            check_settings_actions()
        return

    run_frame += 1
    run_time_ms = int(round(float(run_frame) * 1000.0 / float(replay_fps)))
    trace_recorder.call("set_frame", run_frame)
    if mark_player_tile_explored():
        sync_map_overlay("player.moved", true)
        write_persistent_state()

    check_map_actions()
    check_settings_menu_actions()
    if settings_menu_open:
        check_settings_actions()
        return

    tick_player_invulnerability(delta)
    tick_ability_cooldown(delta)
    check_combat_actions()
    check_hazard_contacts()
    if is_finished():
        return

    apply_enemy_crowd_spacing()
    check_enemy_attacks(delta)
    check_enemy_contact_damage()
    if is_finished():
        return

    check_hidden_discoveries()
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
    clear_active_ability_projectiles()
    captured_enemy = null

    for enemy_marker in current_definition.enemy_spawns:
        if enemies.size() >= max_active_enemy_count:
            trace_recorder.call("record_event", "enemy.spawn.skipped", {
                "level_id": current_level_id,
                "reason": "max_active_enemy_count",
                "active_enemy_count": enemies.size(),
                "max_active_enemy_count": max_active_enemy_count,
                "payload": enemy_marker,
            })
            continue

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
        apply_enemy_ability_ai_profile(enemy)


func instantiate_enemy(enemy_type: String) -> Node:
    match enemy_type:
        "flying", "flying_enemy", "generated_flying":
            return FlyingEnemyScene.instantiate()
        _:
            return SimpleEnemyScene.instantiate()


func apply_enemy_crowd_spacing() -> void:
    if player == null or enemy_crowd_player_radius <= 0.0 or enemy_crowd_min_player_distance <= 0.0:
        return

    var nearby_enemies := []
    for enemy in enemies:
        if not is_instance_valid(enemy) or not can_target_enemy(enemy):
            continue

        var distance: float = player.global_position.distance_to(enemy.global_position)
        if distance <= enemy_crowd_player_radius:
            nearby_enemies.append(enemy)

    if nearby_enemies.size() < 2:
        return

    var adjusted_enemies := []
    for index in range(nearby_enemies.size()):
        var enemy = nearby_enemies[index]
        var offset: Vector2 = enemy.global_position - player.global_position
        if offset.length() >= enemy_crowd_min_player_distance:
            continue

        var direction := offset.normalized()
        if direction == Vector2.ZERO:
            direction = Vector2(-1.0 if index % 2 == 0 else 1.0, 0.0)

        enemy.global_position = player.global_position + direction * enemy_crowd_min_player_distance
        enemy.velocity = Vector2.ZERO
        adjusted_enemies.append(get_enemy_payload(enemy))

    if adjusted_enemies.is_empty():
        return

    if enemy_crowd_spacing_traced_level_ids.has(current_level_id):
        return

    enemy_crowd_spacing_traced_level_ids[current_level_id] = true
    trace_recorder.call("record_player_event", "enemy.crowd.spacing_applied", {
        "level_id": current_level_id,
        "player": get_player_trace(),
        "payload": {
            "nearby_enemy_count": nearby_enemies.size(),
            "enemy_crowd_player_radius": enemy_crowd_player_radius,
            "enemy_crowd_min_player_distance": enemy_crowd_min_player_distance,
            "adjusted_enemies": adjusted_enemies,
        },
    })


func get_enemy_ability_ai_profile(ability_type: String) -> Dictionary:
    match ability_type:
        "ice", "frost":
            return {
                "ai_behavior": "frost_hover",
                "chase_speed": 54.0,
                "detection_radius": 220.0,
                "return_radius": 300.0,
                "attack_cooldown_multiplier": 1.2,
                "hover_amplitude": 24.0,
                "hover_speed": 1.8,
            }
        "fire", "flame":
            return {
                "ai_behavior": "fire_rush",
                "chase_speed": 92.0,
                "detection_radius": 200.0,
                "attack_cooldown_multiplier": 0.85,
            }
        "stone":
            return {
                "ai_behavior": "stone_sentry",
                "chase_speed": 42.0,
                "detection_radius": 140.0,
                "return_radius": 180.0,
                "attack_cooldown_multiplier": 1.35,
            }
        _:
            return {}


func apply_enemy_ability_ai_profile(enemy: Node) -> void:
    if enemy == null or not is_instance_valid(enemy):
        return

    var profile := get_enemy_ability_ai_profile(String(enemy.ability_type))
    if profile.is_empty():
        return

    if profile.has("chase_speed"):
        enemy.chase_speed = float(profile.get("chase_speed", enemy.chase_speed))
    if profile.has("detection_radius"):
        enemy.detection_radius = float(profile.get("detection_radius", enemy.detection_radius))
    if profile.has("return_radius"):
        enemy.return_radius = float(profile.get("return_radius", enemy.return_radius))
    if profile.has("attack_cooldown_multiplier"):
        enemy.attack_cooldown_ms = max(int(round(float(enemy.attack_cooldown_ms) * float(profile.get("attack_cooldown_multiplier", 1.0)))), 120)
    if profile.has("attack_radius_bonus"):
        enemy.attack_radius = max(float(enemy.attack_radius) + float(profile.get("attack_radius_bonus", 0.0)), 1.0)
    if profile.has("hover_amplitude") and enemy.get("hover_amplitude") != null:
        enemy.set("hover_amplitude", float(profile.get("hover_amplitude", enemy.get("hover_amplitude"))))
    if profile.has("hover_speed") and enemy.get("hover_speed") != null:
        enemy.set("hover_speed", float(profile.get("hover_speed", enemy.get("hover_speed"))))

    trace_recorder.call("record_player_event", "enemy.ai.profile.applied", {
        "level_id": current_level_id,
        "player": get_player_trace(),
        "payload": {
            "enemy": get_enemy_payload(enemy),
            "profile": profile,
        },
    })


func check_combat_actions() -> void:
    if player == null:
        return

    clear_defeated_captured_enemy()

    if player.call("is_swallow_pressed"):
        if captured_enemy != null:
            swallow_captured_enemy()
        else:
            detach_current_ability()

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
    if player.has_method("show_inhale_effect_fallback"):
        player.call("show_inhale_effect_fallback", captured_enemy.global_position)
    play_sfx(SfxKirdyInhale)
    trace_recorder.call("record_player_event", "enemy.captured", {
        "level_id": current_level_id,
        "player": get_player_trace(),
        "payload": get_enemy_payload(captured_enemy),
    })
    trace_recorder.call("record_player_event", "inhale.effect.fallback", {
        "level_id": current_level_id,
        "player": get_player_trace(),
        "payload": {
            "effect_type": "line2d_pull",
            "reason": "missing_inhale_effect_asset",
            "enemy_id": get_enemy_payload(captured_enemy).get("enemy_id", ""),
        },
    })


func clear_defeated_captured_enemy() -> void:
    if captured_enemy == null:
        return

    if not is_instance_valid(captured_enemy):
        captured_enemy = null
        return

    if String(captured_enemy.state) == "enemy.defeated":
        var defeated_enemy = captured_enemy
        captured_enemy = null
        hide_inhale_effect_fallback()
        trace_recorder.call("record_player_event", "enemy.capture.cleared", {
            "level_id": current_level_id,
            "player": get_player_trace(),
            "payload": get_enemy_payload(defeated_enemy),
        })
        sync_hud_overlay("enemy.capture.cleared", true)
        sync_inventory_overlay("enemy.capture.cleared", true)


func hide_inhale_effect_fallback() -> void:
    if player != null and player.has_method("hide_inhale_effect_fallback"):
        player.call("hide_inhale_effect_fallback")


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
    hide_inhale_effect_fallback()
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
    hide_inhale_effect_fallback()
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


func detach_current_ability() -> void:
    var ability_type := get_player_ability_type()
    if ability_type == "":
        return

    player.call("clear_ability_type")
    ability_cooldown_remaining_ms = 0
    trace_recorder.call("record_player_event", "ability.detached", {
        "level_id": current_level_id,
        "player": get_player_trace(),
        "payload": {
            "ability_type": ability_type,
        },
    })
    sync_hud_overlay("ability.detached", true)
    sync_inventory_overlay("ability.detached", true)
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
    apply_ability_movement(ability_type, profile)
    trace_recorder.call("record_player_event", "ability.used", {
        "level_id": current_level_id,
        "player": get_player_trace(),
        "payload": {
            "ability_type": ability_type,
            "profile": profile,
        },
    })
    check_ability_gate_interactions(ability_type, profile)
    if String(profile.get("attack_type", "")) == "projectile":
        var projectile := spawn_ability_projectile(ability_type, profile)
        resolve_ability_projectile_hits(projectile, ability_type, profile)
        retire_ability_projectile(projectile)
        return

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
                "projectile_speed": 520.0,
                "pierce": false,
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
                "movement_effect": "dash",
                "movement_impulse": 64.0,
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


func clear_active_ability_projectiles() -> void:
    for projectile in active_ability_projectiles:
        if is_instance_valid(projectile):
            projectile.queue_free()

    active_ability_projectiles.clear()


func spawn_ability_projectile(ability_type: String, profile: Dictionary) -> Node:
    var projectile = AbilityProjectileScene.instantiate()
    projectile.global_position = player.global_position
    add_child(projectile)
    projectile.call("configure_projectile", ability_type, profile, get_player_facing_direction())
    active_ability_projectiles.append(projectile)
    trace_recorder.call("record_player_event", "ability.projectile.spawned", {
        "level_id": current_level_id,
        "player": get_player_trace(),
        "payload": projectile.call("get_projectile_payload"),
    })
    return projectile


func resolve_ability_projectile_hits(projectile: Node, ability_type: String, profile: Dictionary) -> void:
    if projectile == null or not is_instance_valid(projectile):
        return

    var targets := find_enemy_targets(profile)
    for target in targets:
        projectile.call("mark_hit", target.global_position)
        var hit_payload: Dictionary = projectile.call("get_projectile_payload")
        hit_payload["enemy_id"] = String(target.enemy_id)
        hit_payload["pierce"] = bool(profile.get("pierce", false))
        trace_recorder.call("record_player_event", "ability.projectile.hit", {
            "level_id": current_level_id,
            "player": get_player_trace(),
            "payload": hit_payload,
        })
        apply_damage_to_enemy(target, int(profile.get("damage", 1)), {
            "source_type": "ability_projectile",
            "ability_type": ability_type,
            "attack_type": String(profile.get("attack_type", "projectile")),
        }, float(profile.get("knockback", 0.0)))
        if not bool(profile.get("pierce", false)):
            return


func retire_ability_projectile(projectile: Node) -> void:
    if projectile == null:
        return

    active_ability_projectiles.erase(projectile)
    if is_instance_valid(projectile):
        projectile.queue_free()


func apply_ability_movement(ability_type: String, profile: Dictionary) -> void:
    if player == null:
        return

    var movement_effect := String(profile.get("movement_effect", ""))
    if movement_effect == "":
        return

    var start_position: Vector2 = player.global_position
    var impulse := float(profile.get("movement_impulse", 0.0))
    match movement_effect:
        "dash":
            var facing := get_player_facing_direction()
            player.global_position += Vector2(facing * impulse, 0.0)
            player.velocity.x = facing * max(abs(player.velocity.x), impulse * 6.0)
        _:
            return

    trace_recorder.call("record_player_event", "ability.movement.applied", {
        "level_id": current_level_id,
        "player": get_player_trace(),
        "payload": {
            "ability_type": ability_type,
            "movement_effect": movement_effect,
            "movement_impulse": impulse,
            "from": {
                "x": start_position.x,
                "y": start_position.y,
            },
            "to": {
                "x": player.global_position.x,
                "y": player.global_position.y,
            },
        },
    })


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
    trace_recorder.call("record_player_event", "enemy.feedback.shown", {
        "level_id": current_level_id,
        "player": get_player_trace(),
        "payload": {
            "enemy_id": result.get("enemy_id", ""),
            "ability_type": result.get("ability_type", ""),
            "damage": result.get("damage", 0),
            "hp": result.get("hp", 0),
            "max_hp": result.get("max_hp", 0),
            "defeated": result.get("defeated", false),
            "feedback_type": result.get("feedback_type", "hit_flash"),
            "feedback_flash_ms": result.get("feedback_flash_ms", 0),
            "source": result.get("source", {}),
        },
    })

    if bool(result.get("defeated", false)):
        mark_enemy_defeated(result)
        trace_recorder.call("record_player_event", "enemy.defeated", {
            "level_id": current_level_id,
            "player": get_player_trace(),
            "payload": result,
        })
        clear_defeated_captured_enemy()
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


func check_hidden_discoveries() -> void:
    if player == null or current_definition == null or is_finished():
        return

    check_hidden_marker_discoveries(current_definition.collectibles, "collectible")
    check_hidden_marker_discoveries(current_definition.doors, "door")


func check_hidden_marker_discoveries(markers: Array, feature_type: String) -> void:
    for marker in markers:
        if not is_hidden_feature(marker):
            continue

        var feature_id := String(marker.get("id", ""))
        if is_hidden_feature_discovered(feature_type, feature_id):
            continue

        var payload: Dictionary = marker.get("payload", {})
        var discovery_radius := float(payload.get("discovery_radius", payload.get("trigger_radius", 64.0)))
        var marker_position := dictionary_to_vector2(marker.get("position", {}))
        if player.global_position.distance_to(marker_position) > discovery_radius:
            continue

        var hidden_key := get_hidden_feature_key(feature_type, feature_id)
        discovered_hidden_feature_ids[hidden_key] = true
        reveal_hidden_marker_visual(feature_type, feature_id)
        trace_recorder.call("record_player_event", "hidden.discovered", {
            "level_id": current_level_id,
            "player": get_player_trace(),
            "payload": {
                "feature_type": feature_type,
                "feature_id": feature_id,
                "tile_key": position_to_tile_key(marker_position),
            },
        })
        sync_map_overlay("hidden.discovered", true)


func is_hidden_feature(marker: Dictionary) -> bool:
    var payload: Dictionary = marker.get("payload", {})
    return bool(payload.get("hidden_until_discovered", false))


func get_hidden_feature_key(feature_type: String, feature_id: String) -> String:
    return "%s:%s:%s" % [current_level_id, feature_type, feature_id]


func is_hidden_feature_discovered(feature_type: String, feature_id: String) -> bool:
    if feature_id == "":
        return false

    return discovered_hidden_feature_ids.has(get_hidden_feature_key(feature_type, feature_id))


func reveal_hidden_marker_visual(feature_type: String, feature_id: String) -> void:
    if current_level == null:
        return

    var marker_group := "%s_marker" % feature_type
    for marker in current_level.get_tree().get_nodes_in_group(marker_group):
        if not current_level.is_ancestor_of(marker):
            continue

        var marker_id := ""
        if feature_type == "collectible":
            marker_id = String(marker.get("collectible_id"))
        elif feature_type == "door":
            marker_id = String(marker.get("door_id"))

        if marker_id != feature_id or not marker.has_node("Visual"):
            continue

        marker.get_node("Visual").visible = true
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
        var dead_end_id := String(payload.get("dead_end_id", ""))
        trace_recorder.call("record_player_event", "heal.collected", {
            "level_id": current_level_id,
            "player": get_player_trace(),
            "payload": {
                "heal_id": heal_id,
                "amount": amount,
                "reward_type": reward_type,
                "dead_end_id": dead_end_id,
            },
        })
        apply_heal_reward(amount, heal_id, reward_type)
        complete_dead_end(dead_end_id, heal_id)
        return


func apply_heal_reward(amount: int, heal_id: String = "", reward_type: String = "health") -> void:
    match reward_type:
        "max-health":
            increase_player_max_hp(max(amount, 1), heal_id)
        "revive":
            acquire_player_revive(max(amount, 1), heal_id)
        _:
            heal_player(amount, heal_id)


func complete_dead_end(dead_end_id: String, heal_id: String) -> void:
    if dead_end_id == "" or completed_dead_end_ids.has(dead_end_id):
        return

    completed_dead_end_ids[dead_end_id] = true
    trace_recorder.call("record_player_event", "dead_end.completed", {
        "level_id": current_level_id,
        "player": get_player_trace(),
        "payload": {
            "dead_end_id": dead_end_id,
            "heal_id": heal_id,
            "completed_dead_end_ids": get_completed_dead_end_ids(),
        },
    })
    sync_map_overlay("dead_end.completed", true)
    sync_inventory_overlay("dead_end.completed", true)
    write_persistent_state()


func get_completed_dead_end_ids() -> Array:
    var dead_end_ids := completed_dead_end_ids.keys()
    dead_end_ids.sort()
    return dead_end_ids


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
        if is_hidden_feature(collectible) and not is_hidden_feature_discovered("collectible", collectible_id):
            continue

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
    clear_resolved_locked_door_reason("missing_cluster_keystone", item_id)
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


func get_map_features_payload() -> Array:
    var features := []
    if current_definition == null:
        return features

    append_map_features(features, current_definition.doors, "door")
    append_map_features(features, current_definition.heals, "heal")
    append_dead_end_map_features(features, current_definition.heals)
    append_map_features(features, current_definition.collectibles, "collectible")
    append_map_features(features, current_definition.hazards, "hazard")
    append_map_features(features, current_definition.ability_gates, "ability_gate")
    append_map_features(features, current_definition.goals, "goal")
    return features


func append_map_features(features: Array, markers: Array, feature_type: String) -> void:
    for marker in markers:
        var marker_position := dictionary_to_vector2(marker.get("position", {}))
        var tile_key := position_to_tile_key(marker_position)
        var feature_id := String(marker.get("id", ""))
        var hidden := is_hidden_feature(marker)
        var discovered := is_tile_explored(current_level_id, tile_key)
        if hidden:
            discovered = is_hidden_feature_discovered(feature_type, feature_id)
        features.append({
            "level_id": current_level_id,
            "feature_type": feature_type,
            "feature_id": feature_id,
            "tile_key": tile_key,
            "discovered": discovered,
            "hidden": hidden,
        })


func append_dead_end_map_features(features: Array, markers: Array) -> void:
    for marker in markers:
        var payload: Dictionary = marker.get("payload", {})
        var dead_end_id := String(payload.get("dead_end_id", ""))
        if dead_end_id == "":
            continue

        var marker_position := dictionary_to_vector2(marker.get("position", {}))
        features.append({
            "level_id": current_level_id,
            "feature_type": "dead_end",
            "feature_id": dead_end_id,
            "tile_key": position_to_tile_key(marker_position),
            "discovered": completed_dead_end_ids.has(dead_end_id),
            "completed": completed_dead_end_ids.has(dead_end_id),
        })


func position_to_tile_key(position: Vector2) -> String:
    if exploration_tile_size <= 0:
        return "0,0"

    var column: int = max(int(floor(position.x / float(exploration_tile_size))), 0)
    var row: int = max(int(floor(position.y / float(exploration_tile_size))), 0)
    return "%d,%d" % [column, row]


func is_tile_explored(level_id: String, tile_key: String) -> bool:
    if not explored_tiles.has(level_id):
        return false

    var level_tiles: Dictionary = explored_tiles[level_id]
    return level_tiles.has(tile_key)


func setup_map_overlay() -> void:
    if not map_overlay_enabled:
        return

    map_overlay = MapOverlayScene.instantiate()
    map_overlay.visible = true
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


func setup_results_scene() -> void:
    if not result_overlay_enabled:
        return

    results_scene = ResultsSceneScene.instantiate()
    add_child(results_scene)


func setup_error_overlay() -> void:
    if not error_overlay_enabled:
        return

    error_overlay = ErrorOverlayScene.instantiate()
    add_child(error_overlay)


func setup_pause_overlay() -> void:
    setup_pause_scene()


func setup_pause_scene() -> void:
    if not pause_menu_enabled:
        return

    pause_overlay = PauseSceneScene.instantiate() if pause_scene_enabled else PauseOverlayScene.instantiate()
    add_child(pause_overlay)
    sync_pause_overlay("session.started")


func setup_settings_overlay() -> void:
    if not settings_overlay_enabled:
        return

    settings_overlay = SettingsOverlayScene.instantiate()
    add_child(settings_overlay)
    sync_settings_menu_visibility()


func setup_virtual_controls_overlay() -> void:
    if not virtual_controls_enabled:
        return

    virtual_controls_overlay = VirtualControlsOverlayScene.instantiate()
    add_child(virtual_controls_overlay)
    sync_virtual_controls_overlay("session.started")


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
    add_child(bgm_player)
    bgm_player.play()

    sfx_player = AudioStreamPlayer.new()
    sfx_player.name = "SfxPlayer"
    add_child(sfx_player)
    update_audio_mix("audio.players.ready")


func update_audio_mix(reason: String = "audio.mix.updated", emit_trace: bool = false) -> void:
    if not audio_enabled:
        return

    var mix_payload := get_audio_mix_payload(reason)
    if bgm_player != null and is_instance_valid(bgm_player):
        bgm_player.volume_db = volume_to_db(float(mix_payload.get("bgm_volume", 0.0)))
    if sfx_player != null and is_instance_valid(sfx_player):
        sfx_player.volume_db = volume_to_db(float(mix_payload.get("sfx_volume", 0.0)))

    if emit_trace and trace_recorder != null:
        trace_recorder.call("record_event", "audio.mix.updated", mix_payload)


func get_audio_mix_payload(reason: String = "") -> Dictionary:
    var normalized_volume := clampf(setting_volume, 0.0, 1.0)
    var ducking_active := session_paused or settings_menu_open or pause_settings_open
    var bgm_volume := clampf(normalized_volume * bgm_volume_scale, 0.0, 1.0)
    if ducking_active:
        bgm_volume = clampf(bgm_volume * audio_ducking_volume_scale, 0.0, 1.0)

    return {
        "setting_volume": normalized_volume,
        "bgm_volume": bgm_volume,
        "sfx_volume": clampf(normalized_volume * sfx_volume_scale, 0.0, 1.0),
        "ui_sfx_volume": clampf(normalized_volume * ui_sfx_volume_scale, 0.0, 1.0),
        "ducking_active": ducking_active,
        "audio_enabled": audio_enabled,
        "bgm_playing": bgm_player != null and is_instance_valid(bgm_player) and bgm_player.playing,
        "reason": reason,
    }


func volume_to_db(linear_volume: float) -> float:
    var clamped_volume := clampf(linear_volume, 0.0, 1.0)
    if clamped_volume <= 0.0:
        return -80.0

    return linear_to_db(clamped_volume)


func play_sfx(stream: AudioStream, volume_scale: float = -1.0) -> void:
    if not audio_enabled or sfx_player == null or stream == null:
        return

    var resolved_volume_scale := sfx_volume_scale if volume_scale < 0.0 else volume_scale
    sfx_player.stream = stream
    sfx_player.volume_db = volume_to_db(clampf(setting_volume * resolved_volume_scale, 0.0, 1.0))
    sfx_player.play()


func play_ui_sfx(stream: AudioStream = null) -> void:
    var resolved_stream := SfxKirdySwallow if stream == null else stream
    play_sfx(resolved_stream, ui_sfx_volume_scale)


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
    var map_features_payload := get_map_features_payload()
    if map_overlay != null and is_instance_valid(map_overlay):
        map_overlay.call("set_map_state", current_level_id, explored_payload, map_features_payload)

    if not emit_trace or trace_recorder == null:
        return

    trace_recorder.call("record_event", "map.updated", {
        "reason": reason,
        "current_level_id": current_level_id,
        "explored_tiles": explored_payload,
        "explored_tile_count": get_explored_tile_count(),
        "features": map_features_payload,
        "map_visible": map_overlay.visible if map_overlay != null and is_instance_valid(map_overlay) else false,
        "visible_tile_count": int(map_overlay.call("get_visible_tile_count")) if map_overlay != null and is_instance_valid(map_overlay) else get_explored_tile_count(),
    })


func check_map_actions() -> void:
    if is_session_action_just_pressed(map_toggle_action):
        toggle_map_overlay()


func toggle_map_overlay() -> void:
    if map_overlay == null or not is_instance_valid(map_overlay):
        return

    map_overlay.visible = not map_overlay.visible
    trace_recorder.call("record_event", "map.toggled", {
        "current_level_id": current_level_id,
        "map_visible": map_overlay.visible,
        "explored_tile_count": get_explored_tile_count(),
        "visible_tile_count": int(map_overlay.call("get_visible_tile_count")),
    })


func check_pause_actions() -> void:
    if is_session_action_just_pressed(pause_toggle_action):
        if settings_menu_open:
            close_settings_menu("settings.menu.closed")
        elif pause_settings_open:
            close_pause_settings()
        else:
            toggle_pause_menu()
        return

    if session_paused and not pause_settings_open and is_session_action_just_pressed(pause_settings_action):
        open_pause_settings()


func toggle_pause_menu() -> void:
    session_paused = not session_paused
    if not session_paused:
        pause_settings_open = false
    play_ui_sfx()
    sync_settings_menu_visibility()
    sync_virtual_controls_overlay("pause.toggled")
    sync_pause_overlay("pause.toggled", true)
    update_audio_mix("pause.toggled", true)


func open_pause_settings() -> void:
    if not session_paused or pause_settings_open:
        return

    pause_settings_open = true
    selected_setting_index = 0
    play_ui_sfx()
    sync_settings_menu_visibility()
    sync_settings_overlay("pause.settings.opened")
    sync_virtual_controls_overlay("pause.settings.opened")
    sync_pause_overlay("pause.settings.opened")
    update_audio_mix("pause.settings.opened", true)
    trace_recorder.call("record_event", "pause.settings.opened", build_pause_payload("pause.settings.opened"))


func close_pause_settings() -> void:
    if not pause_settings_open:
        return

    pause_settings_open = false
    play_ui_sfx()
    sync_settings_menu_visibility()
    sync_settings_overlay("pause.settings.closed")
    sync_virtual_controls_overlay("pause.settings.closed")
    sync_pause_overlay("pause.settings.closed")
    update_audio_mix("pause.settings.closed", true)
    trace_recorder.call("record_event", "pause.settings.closed", build_pause_payload("pause.settings.closed"))


func sync_pause_overlay(reason: String = "", emit_trace: bool = false) -> void:
    var pause_payload := build_pause_payload(reason)
    if pause_overlay != null and is_instance_valid(pause_overlay):
        pause_overlay.call("set_pause_state", pause_payload)

    if not emit_trace or trace_recorder == null:
        sync_pause_scene(pause_payload, false)
        return

    trace_recorder.call("record_event", "pause.toggled", pause_payload)
    sync_pause_scene(pause_payload, true)


func sync_pause_scene(pause_payload: Dictionary, emit_trace: bool = false) -> void:
    if not bool(pause_payload.get("is_paused", false)):
        pause_scene_visible_traced = false
        return

    if not pause_scene_enabled or not emit_trace or trace_recorder == null or pause_scene_visible_traced:
        return

    pause_scene_visible_traced = true
    trace_recorder.call("record_event", "pause.scene.shown", pause_payload)


func build_pause_payload(reason: String = "") -> Dictionary:
    return {
        "is_paused": session_paused,
        "settings_open": pause_settings_open,
        "pause_scene_active": pause_scene_enabled and session_paused,
        "blur_active": pause_scene_enabled and session_paused,
        "blur_mode": "canvas_fallback" if pause_scene_enabled and session_paused else "none",
        "reason": reason,
    }


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
        "score": calculate_total_score(),
        "remaining_life_bonus": calculate_remaining_life_bonus(),
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


func calculate_progress_score() -> int:
    return (
        get_acquired_item_ids().size() * SCORE_PER_ITEM
        + get_completed_level_ids().size() * SCORE_PER_COMPLETED_LEVEL
        + get_defeated_enemy_group_ids().size() * SCORE_PER_DEFEATED_GROUP
        + get_defeated_boss_ids().size() * SCORE_PER_DEFEATED_BOSS
    )


func calculate_remaining_life_bonus() -> int:
    return max(player_hp, 0) * SCORE_PER_REMAINING_HP + max(player_revive_count, 0) * SCORE_PER_REVIVE


func calculate_total_score() -> int:
    return calculate_progress_score() + calculate_remaining_life_bonus()


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
        sync_settings_menu_visibility()

    if not emit_trace or trace_recorder == null:
        return

    settings_payload["reason"] = reason
    trace_recorder.call("record_event", "settings.updated", settings_payload)


func build_settings_payload() -> Dictionary:
    var settings_payload := get_settings_payload()
    settings_payload["menu_open"] = is_settings_menu_active()
    settings_payload["selected_setting_index"] = selected_setting_index
    settings_payload["focus_target"] = get_settings_focus_target()
    settings_payload["blur_active"] = is_settings_menu_active()
    return settings_payload


func sync_virtual_controls_overlay(reason: String = "", emit_trace: bool = false) -> void:
    var controls_mode := sanitize_setting_controls(setting_controls)
    var controls_visible := virtual_controls_enabled and setting_controls == "touch" and not session_paused and not settings_menu_open and outcome == "running"
    var controls_payload := {
        "visible": controls_visible,
        "controls": controls_mode,
        "reason": reason,
    }
    if virtual_controls_overlay != null and is_instance_valid(virtual_controls_overlay):
        virtual_controls_overlay.call("set_virtual_controls_state", controls_payload)

    if not emit_trace or trace_recorder == null:
        return

    trace_recorder.call("record_event", "virtual_controls.updated", controls_payload)


func sync_settings_menu_visibility() -> void:
    if settings_overlay == null or not is_instance_valid(settings_overlay):
        return

    settings_overlay.call("set_menu_visible", is_settings_menu_active())


func check_settings_menu_actions() -> void:
    if settings_menu_open and is_session_action_just_pressed(pause_toggle_action):
        close_settings_menu("settings.menu.closed")
        return

    if is_session_action_just_pressed(settings_menu_action):
        if settings_menu_open:
            close_settings_menu("settings.menu.closed")
        elif not session_paused:
            open_settings_menu("settings.menu.opened")
        return

    if not is_settings_menu_active():
        return

    if is_session_action_just_pressed(settings_focus_next_action):
        move_settings_focus(1)
        return

    if is_session_action_just_pressed(settings_focus_previous_action):
        move_settings_focus(-1)


func open_settings_menu(reason: String = "settings.menu.opened") -> void:
    if settings_menu_open or session_paused:
        return

    settings_menu_open = true
    selected_setting_index = 0
    play_ui_sfx()
    sync_settings_overlay(reason)
    sync_virtual_controls_overlay(reason, true)
    update_audio_mix(reason, true)
    if trace_recorder != null:
        trace_recorder.call("record_event", "settings.menu.opened", build_settings_payload())


func close_settings_menu(reason: String = "settings.menu.closed") -> void:
    if not settings_menu_open:
        return

    settings_menu_open = false
    play_ui_sfx()
    sync_settings_overlay(reason)
    sync_virtual_controls_overlay(reason, true)
    update_audio_mix(reason, true)
    if trace_recorder != null:
        trace_recorder.call("record_event", "settings.menu.closed", build_settings_payload())


func move_settings_focus(direction: int) -> void:
    if not is_settings_menu_active() or direction == 0:
        return

    selected_setting_index = wrapi(selected_setting_index + direction, 0, 3)
    play_ui_sfx()
    sync_settings_overlay("settings.focus.changed")
    if trace_recorder != null:
        trace_recorder.call("record_event", "settings.focus.changed", build_settings_payload())


func is_settings_menu_active() -> bool:
    return settings_menu_open or pause_settings_open


func get_settings_focus_target() -> String:
    match selected_setting_index:
        1:
            return "controls"
        2:
            return "difficulty"
        _:
            return "volume"


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
    play_ui_sfx()
    sync_settings_overlay(reason, true)
    sync_virtual_controls_overlay(reason, true)
    update_audio_mix(reason, true)
    write_persistent_state()


func is_session_action_just_pressed(action: StringName) -> bool:
    if input_source != null and input_source.has_method("is_action_just_pressed"):
        return input_source.is_action_just_pressed(action)

    return Input.is_action_just_pressed(action)


func check_error_actions() -> void:
    if outcome == "error" and is_session_action_just_pressed(error_retry_action):
        retry_after_error()


func retry_after_error() -> void:
    if outcome != "error":
        return

    var retry_payload := build_error_payload(runtime_error_message, runtime_error_reason, error_retry_level_id, error_retry_spawn_id)
    if trace_recorder != null:
        trace_recorder.call("record_event", "runtime.error.retry_selected", retry_payload)

    start_session(error_retry_level_id, error_retry_spawn_id, error_retry_fps)


func cycle_string(current_value: String, values: Array) -> String:
    if values.is_empty():
        return current_value

    var current_index := values.find(current_value)
    if current_index < 0:
        return String(values[0])

    return String(values[(current_index + 1) % values.size()])


func check_result_actions() -> void:
    if outcome == "game_over" and is_session_action_just_pressed(result_restart_action):
        restart_current_run()
        return

    if results_scene_shown:
        return

    if is_session_action_just_pressed(result_continue_action):
        show_results_scene("result.continued")
        return

    if result_auto_results_delay_ms > 0 and result_elapsed_ms >= result_auto_results_delay_ms:
        show_results_scene("result.auto_timeout")


func restart_current_run() -> void:
    if outcome != "game_over":
        return

    var restart_level_id := current_level_id
    var restart_spawn_id := requested_spawn_id
    trace_recorder.call("record_event", "run.restart.selected", {
        "level_id": restart_level_id,
        "spawn_id": restart_spawn_id,
        "previous_outcome": outcome,
    })
    outcome = "running"
    session_paused = false
    pause_settings_open = false
    result_elapsed_ms = 0
    results_scene_shown = false
    player_hp = max(player_max_hp, 1)
    player_invulnerability_remaining_ms = 0
    ability_cooldown_remaining_ms = 0
    last_locked_door_reason = ""
    captured_enemy = null
    if player != null:
        player.call("set_ability_type", "")
    if result_overlay != null and is_instance_valid(result_overlay):
        result_overlay.call("set_result_state", {})
    if results_scene != null and is_instance_valid(results_scene):
        results_scene.call("set_results_state", {})

    load_level(restart_level_id, restart_spawn_id)
    player_invulnerability_remaining_ms = max(int(get_difficulty_profile().get("player_invulnerability_ms", player_invulnerability_ms)), 0)
    mark_level_visited(current_level_id)
    mark_player_tile_explored()
    sync_map_overlay("run.restarted", true)
    sync_hud_overlay("run.restarted", true)
    sync_inventory_overlay("run.restarted", true)
    sync_virtual_controls_overlay("run.restarted", true)


func show_result_overlay(reason: String = "") -> void:
    result_elapsed_ms = 0
    results_scene_shown = false
    var result_payload := build_result_payload()
    if result_overlay != null and is_instance_valid(result_overlay):
        result_overlay.call("set_result_state", result_payload)

    if trace_recorder == null:
        return

    result_payload["reason"] = reason
    trace_recorder.call("record_event", "result.overlay.shown", result_payload)


func show_results_scene(reason: String = "") -> void:
    if results_scene_shown:
        return

    results_scene_shown = true
    var results_payload := build_result_payload()
    if results_scene != null and is_instance_valid(results_scene):
        results_scene.call("set_results_state", results_payload)

    if trace_recorder == null:
        return

    results_payload["reason"] = reason
    trace_recorder.call("record_event", "results.scene.shown", results_payload)


func show_error_overlay(message: String, reason: String = "", requested_level_id: String = "", requested_spawn_id: String = "default") -> void:
    runtime_error_message = message
    runtime_error_reason = reason
    error_retry_level_id = requested_level_id if requested_level_id != "" else initial_level_id
    error_retry_spawn_id = requested_spawn_id if requested_spawn_id != "" else initial_spawn_id
    var error_payload := build_error_payload(message, reason, error_retry_level_id, error_retry_spawn_id)
    if error_overlay != null and is_instance_valid(error_overlay):
        error_overlay.call("set_error_state", error_payload)

    if trace_recorder == null:
        return

    trace_recorder.call("record_event", "runtime.error.shown", error_payload)


func build_error_payload(message: String = "", reason: String = "", requested_level_id: String = "", requested_spawn_id: String = "default") -> Dictionary:
    var normalized_message := message if message != "" else runtime_error_message
    var normalized_reason := reason if reason != "" else runtime_error_reason
    var normalized_level_id := requested_level_id if requested_level_id != "" else error_retry_level_id
    var normalized_spawn_id := requested_spawn_id if requested_spawn_id != "" else error_retry_spawn_id
    return {
        "runtime_error": normalized_message != "",
        "level_id": current_level_id,
        "requested_level_id": normalized_level_id,
        "requested_spawn_id": normalized_spawn_id,
        "outcome": outcome,
        "reason": normalized_reason,
        "message": normalized_message,
        "retry_available": normalized_level_id != "",
        "retry_action": String(error_retry_action),
    }


func build_result_payload() -> Dictionary:
    return {
        "level_id": current_level_id,
        "outcome": outcome,
        "time_ms": run_time_ms,
        "frames": run_frame,
        "items_collected": get_acquired_item_ids(),
        "completed_level_ids": get_completed_level_ids(),
        "score": calculate_total_score(),
        "remaining_life_bonus": calculate_remaining_life_bonus(),
        "restart_available": outcome == "game_over",
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
        "storage_backend": save_store.get("last_storage_backend"),
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
        var save_written_payload := {
            "save_path": save_path,
            "storage_backend": save_store.get("last_storage_backend"),
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
        }
        trace_recorder.call("record_event", "save.written", save_written_payload)
        if String(save_store.get("last_storage_backend")) == "localStorage":
            trace_recorder.call("record_event", "save.local_storage.written", save_written_payload)
        if String(save_store.get("last_storage_backend")) == "sessionStorage":
            trace_recorder.call("record_event", "save.session_storage_fallback.written", save_written_payload)
        return

    trace_recorder.call("record_event", "save.error", {
        "operation": "write",
        "save_path": save_path,
        "storage_backend": save_store.get("last_storage_backend"),
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

    var tile_key := position_to_tile_key(player.global_position)

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
        var door_id := String(door.get("id", ""))
        if is_hidden_feature(door) and not is_hidden_feature_discovered("door", door_id):
            continue

        var radius := float(payload.get("trigger_radius", 64.0))
        var door_position := dictionary_to_vector2(door.get("position", {}))

        if player.global_position.distance_to(door_position) > radius:
            continue

        var source_level_id := current_level_id
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

    var cluster_lock_reason := get_cluster_transition_lock_reason(payload)
    if cluster_lock_reason != "":
        return cluster_lock_reason

    return ""


func get_cluster_transition_lock_reason(payload: Dictionary) -> String:
    if not cluster_keystone_progression_enabled:
        return ""

    var explicit_required_item_id := String(payload.get("required_keystone_item_id", ""))
    if explicit_required_item_id != "":
        if acquired_item_ids.has(explicit_required_item_id):
            return ""
        return "missing_cluster_keystone:" + explicit_required_item_id

    var target_level_id := String(payload.get("target_level_id", ""))
    if target_level_id == "" or level_loader == null or not level_loader.has_method("get_level_cluster"):
        return ""

    var target_cluster := String(level_loader.call("get_level_cluster", target_level_id))
    if target_cluster == "" or target_cluster == "hub":
        return ""

    var source_cluster := String(level_loader.call("get_level_cluster", current_level_id))
    if source_cluster == target_cluster:
        return ""

    var required_item_id := String(CLUSTER_KEYSTONE_REQUIREMENTS.get(target_cluster, ""))
    if required_item_id == "" or acquired_item_ids.has(required_item_id):
        return ""

    return "missing_cluster_keystone:" + required_item_id


func check_goal_reached() -> void:
    for goal in current_definition.goals:
        var payload: Dictionary = goal.get("payload", {})
        var radius := float(payload.get("trigger_radius", 64.0))
        var goal_position := dictionary_to_vector2(goal.get("position", {}))

        if player.global_position.distance_to(goal_position) > radius:
            continue

        outcome = "completed"
        complete_level(current_level_id)
        var finish_payload := {
            "goal_id": goal.get("id", ""),
            "result_label": payload.get("result_label", "complete"),
            "time_ms": run_time_ms,
            "frames": run_frame,
            "score": calculate_total_score(),
            "remaining_life_bonus": calculate_remaining_life_bonus(),
        }
        if String(payload.get("controller_type", "")) != "":
            finish_payload["controller_type"] = String(payload.get("controller_type", ""))
        if not bool(payload.get("collect_time_metrics", true)):
            finish_payload.erase("time_ms")
            finish_payload.erase("frames")
        if not bool(payload.get("collect_score_metrics", true)):
            finish_payload.erase("score")
            finish_payload.erase("remaining_life_bonus")
        if String(finish_payload.get("controller_type", "")) == "goal_door":
            trace_recorder.call("record_player_event", "goal.door.entered", {
                "level_id": current_level_id,
                "player": get_player_trace(),
                "payload": finish_payload,
            })
        trace_recorder.call("record_player_event", "run.finished", {
            "level_id": current_level_id,
            "player": get_player_trace(),
            "payload": finish_payload,
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
