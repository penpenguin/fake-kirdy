extends SceneTree

const ReplayInputSourceScript = preload("res://scripts/sim/ReplayInputSource.gd")
const TraceRecorderScript = preload("res://scripts/sim/TraceRecorder.gd")
const GameSessionScript = preload("res://scripts/session/GameSession.gd")


func _init() -> void:
    call_deferred("run")


func run() -> void:
    var args := parse_user_args()
    var replay_path := String(args.get("replay", "res://tests/replays/controller_lab_jump.json"))
    var output_path := String(args.get("out", "user://controller_lab_jump.ndjson"))
    var input_source: Node = ReplayInputSourceScript.new()
    var recorder: Node = TraceRecorderScript.new()
    root.add_child(input_source)
    root.add_child(recorder)

    if not input_source.call("load_replay", replay_path):
        recorder.call("record_replay_error", input_source.get("error_message"))
        recorder.call("write_to_path", output_path)
        quit(1)
        return

    if String(input_source.get("start_level_id")) != "":
        await run_session_replay(input_source, output_path, args)
        return

    await run_scene_replay(input_source, recorder, output_path)


func run_scene_replay(input_source: Node, recorder: Node, output_path: String) -> void:
    recorder.call("configure", input_source.get("level_id"), input_source.get("fps"))

    var packed_scene := load_interactive_scene(input_source.get("scene_path"))
    if packed_scene == null:
        recorder.call("record_replay_error", "Unable to load scene: %s" % input_source.get("scene_path"))
        recorder.call("write_to_path", output_path)
        quit(1)
        return

    var scene := packed_scene.instantiate()
    var player := scene.find_child("Player", true, false)
    if player == null:
        recorder.call("record_replay_error", "Replay scene does not contain a Player node")
        recorder.call("write_to_path", output_path)
        quit(1)
        return

    player.input_source = input_source

    if player.has_signal("trace_event"):
        player.trace_event.connect(on_player_trace_event.bind(recorder))

    root.add_child(scene)
    await process_frame

    for frame in range(input_source.get("max_frames")):
        recorder.call("set_frame", frame)
        input_source.call("advance_frame")
        await physics_frame
        record_player_sample(player, recorder)

    recorder.call("set_frame", input_source.get("max_frames"))
    recorder.call("record_run_finished", {"frames": input_source.get("max_frames")})
    recorder.call("write_to_path", output_path)
    quit(0)


func run_session_replay(input_source: Node, output_path: String, args: Dictionary) -> void:
    var session = GameSessionScript.new()
    session.auto_start = false
    session.input_source = input_source
    if String(input_source.get("setting_difficulty")) != "":
        session.setting_difficulty = String(input_source.get("setting_difficulty"))
    if args.has("save"):
        session.save_enabled = true
        session.save_path = String(args["save"])
    root.add_child(session)

    if not session.call(
        "start_session",
        input_source.get("start_level_id"),
        input_source.get("start_spawn_id"),
        input_source.get("fps")
    ):
        session.trace_recorder.call("write_to_path", output_path)
        quit(1)
        return

    if String(input_source.get("initial_ability_type")) != "" and session.player != null:
        session.player.call("set_ability_type", String(input_source.get("initial_ability_type")))
        session.call("sync_hud_overlay", "replay.initial_ability", true)

    for item_id in input_source.get("initial_item_ids"):
        session.call("acquire_item", String(item_id), "replay_initial_item")

    apply_initial_player_health(input_source, session)

    await process_frame

    for frame in range(input_source.get("max_frames")):
        input_source.call("advance_frame")
        await physics_frame
        apply_session_replay_hooks(input_source, session)

        if session.call("is_finished") and not input_source.get("continue_after_finished"):
            break

    if not session.call("is_finished"):
        session.trace_recorder.call("set_frame", input_source.get("max_frames"))
        session.trace_recorder.call("record_run_finished", {
            "outcome": "replay.max_frames_reached",
            "frames": input_source.get("max_frames"),
        })

    session.trace_recorder.call("write_to_path", output_path)
    quit(0)


func apply_initial_player_health(input_source: Node, session: Node) -> void:
    var initial_player_max_hp := int(input_source.get("initial_player_max_hp"))
    var initial_player_hp := int(input_source.get("initial_player_hp"))
    if initial_player_max_hp <= 0 and initial_player_hp <= 0:
        return

    if initial_player_max_hp > 0:
        session.player_max_hp = max(initial_player_max_hp, 1)
    if initial_player_hp > 0:
        session.player_max_hp = max(session.player_max_hp, initial_player_hp)
        session.player_hp = min(initial_player_hp, session.player_max_hp)
    else:
        session.player_hp = max(session.player_max_hp, 1)

    session.call("sync_hud_overlay", "replay.initial_player_health", true)
    if session.save_enabled:
        session.call("write_persistent_state")


func apply_session_replay_hooks(input_source: Node, session: Node) -> void:
    if input_source.call("is_action_just_pressed", &"defeat_captured_enemy"):
        var captured_enemy = session.get("captured_enemy")
        if captured_enemy == null or not is_instance_valid(captured_enemy):
            return

        session.call("apply_damage_to_enemy", captured_enemy, 999, {
            "source_type": "replay_external",
            "action": "defeat_captured_enemy",
        })


func parse_user_args() -> Dictionary:
    var parsed := {}
    var args := OS.get_cmdline_user_args()
    var index := 0

    while index < args.size():
        var arg := String(args[index])
        if arg == "--replay" and index + 1 < args.size():
            parsed["replay"] = args[index + 1]
            index += 2
        elif arg == "--out" and index + 1 < args.size():
            parsed["out"] = args[index + 1]
            index += 2
        elif arg == "--save" and index + 1 < args.size():
            parsed["save"] = args[index + 1]
            index += 2
        else:
            index += 1

    return parsed


func load_interactive_scene(scene_path: String) -> PackedScene:
    return load(scene_path) as PackedScene


func on_player_trace_event(event_type: String, payload: Dictionary, recorder: Node) -> void:
    recorder.call("record_player_event", event_type, payload)


func record_player_sample(player: Node, recorder: Node) -> void:
    recorder.call("record_player_event", "player.sampled", {
        "player": {
            "position": {
                "x": player.global_position.x,
                "y": player.global_position.y,
            },
            "velocity": {
                "x": player.velocity.x,
                "y": player.velocity.y,
            },
        },
        "payload": {},
    })
