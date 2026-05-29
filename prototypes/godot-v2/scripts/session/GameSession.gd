extends Node
class_name GameSession

const PlayerScene = preload("res://scenes/player/Player.tscn")
const SimpleEnemyScene = preload("res://scenes/enemies/SimpleEnemy.tscn")
const LevelLoaderScript = preload("res://scripts/level/LevelLoader.gd")
const TraceRecorderScript = preload("res://scripts/sim/TraceRecorder.gd")

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

var level_loader = null
var requested_spawn_id: String = "default"


func _ready() -> void:
    set_physics_process(false)


func start_session(start_level_id: String, start_spawn_id: String = "default", fps: int = 60) -> bool:
    replay_fps = max(fps, 1)
    run_frame = 0
    run_time_ms = 0
    outcome = "running"

    level_loader = LevelLoaderScript.new()
    trace_recorder = TraceRecorderScript.new()
    add_child(level_loader)
    add_child(trace_recorder)
    trace_recorder.call("configure", start_level_id, replay_fps)

    player = PlayerScene.instantiate()
    player.input_source = input_source

    if player.has_signal("trace_event"):
        player.trace_event.connect(on_player_trace_event)

    if not load_level(start_level_id, start_spawn_id):
        trace_recorder.call("record_replay_error", "Unable to load level: %s" % start_level_id)
        outcome = "error"
        return false

    set_physics_process(true)
    return true


func _physics_process(delta: float) -> void:
    if is_finished():
        return

    run_frame += 1
    run_time_ms = int(round(float(run_frame) * 1000.0 / float(replay_fps)))
    trace_recorder.call("set_frame", run_frame)
    check_combat_actions()
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
    current_definition = level_loader.call("build_level_definition", current_level, level_id)
    spawn_player(spawn_id)
    spawn_enemies()
    trace_recorder.call("configure", current_level_id, replay_fps)
    trace_recorder.call("record_event", "level.loaded", {
        "level_id": current_level_id,
        "spawn_id": spawn_id,
        "level_path": level_loader.call("get_level_path", current_level_id),
    })
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


func spawn_enemies() -> void:
    for enemy in enemies:
        if is_instance_valid(enemy):
            enemy.queue_free()

    enemies.clear()
    captured_enemy = null

    for enemy_marker in current_definition.enemy_spawns:
        var enemy = SimpleEnemyScene.instantiate()
        var payload: Dictionary = enemy_marker.get("payload", {})
        enemy.enemy_id = String(enemy_marker.get("id", "enemy"))
        enemy.ability_type = String(payload.get("ability_type", "spark"))
        enemy.global_position = dictionary_to_vector2(enemy_marker.get("position", {}))
        add_child(enemy)
        enemies.append(enemy)


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

    for enemy in enemies:
        if not is_instance_valid(enemy) or enemy.state != "enemy.idle":
            continue

        var distance: float = player.global_position.distance_to(enemy.global_position)
        if distance > nearest_distance:
            continue

        var delta_x: float = enemy.global_position.x - player.global_position.x
        if delta_x < -16.0:
            continue

        nearest_enemy = enemy
        nearest_distance = distance

    if nearest_enemy == null:
        return

    captured_enemy = nearest_enemy
    captured_enemy.call("capture", player)
    trace_recorder.call("record_player_event", "enemy.captured", {
        "level_id": current_level_id,
        "player": get_player_trace(),
        "payload": get_enemy_payload(captured_enemy),
    })


func release_captured_enemy() -> void:
    if captured_enemy == null:
        return

    var released_enemy = captured_enemy
    captured_enemy = null
    released_enemy.call("release")
    trace_recorder.call("record_player_event", "enemy.released", {
        "level_id": current_level_id,
        "player": get_player_trace(),
        "payload": get_enemy_payload(released_enemy),
    })


func swallow_captured_enemy() -> void:
    if captured_enemy == null:
        return

    var swallowed_enemy = captured_enemy
    captured_enemy = null
    swallowed_enemy.call("swallow")
    player.call("set_ability_type", swallowed_enemy.ability_type)
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


func use_ability() -> void:
    if String(player.ability_type) == "":
        return

    trace_recorder.call("record_player_event", "ability.used", {
        "level_id": current_level_id,
        "player": get_player_trace(),
        "payload": {
            "ability_type": player.ability_type,
        },
    })


func check_door_transitions() -> void:
    for door in current_definition.doors:
        var payload: Dictionary = door.get("payload", {})
        var radius := float(payload.get("trigger_radius", 64.0))
        var door_position := dictionary_to_vector2(door.get("position", {}))

        if player.global_position.distance_to(door_position) > radius:
            continue

        trace_recorder.call("record_player_event", "door.entered", {
            "level_id": current_level_id,
            "player": get_player_trace(),
            "payload": {
                "door_id": door.get("id", ""),
                "target_level_id": payload.get("target_level_id", ""),
                "target_spawn_id": payload.get("target_spawn_id", "default"),
            },
        })
        load_level(String(payload.get("target_level_id", "")), String(payload.get("target_spawn_id", "default")))
        return


func check_goal_reached() -> void:
    for goal in current_definition.goals:
        var payload: Dictionary = goal.get("payload", {})
        var radius := float(payload.get("trigger_radius", 64.0))
        var goal_position := dictionary_to_vector2(goal.get("position", {}))

        if player.global_position.distance_to(goal_position) > radius:
            continue

        outcome = "completed"
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
        "position": {
            "x": enemy.global_position.x,
            "y": enemy.global_position.y,
        },
    }


func on_player_trace_event(event_type: String, payload: Dictionary) -> void:
    trace_recorder.call("record_player_event", event_type, payload)
