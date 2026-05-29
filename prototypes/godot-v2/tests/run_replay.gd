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
        await run_session_replay(input_source, output_path)
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

    recorder.call("set_frame", input_source.get("max_frames"))
    recorder.call("record_run_finished", {"frames": input_source.get("max_frames")})
    recorder.call("write_to_path", output_path)
    quit(0)


func run_session_replay(input_source: Node, output_path: String) -> void:
    var session = GameSessionScript.new()
    session.input_source = input_source
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

    await process_frame

    for frame in range(input_source.get("max_frames")):
        input_source.call("advance_frame")
        await physics_frame

        if session.call("is_finished"):
            break

    if not session.call("is_finished"):
        session.trace_recorder.call("set_frame", input_source.get("max_frames"))
        session.trace_recorder.call("record_run_finished", {
            "outcome": "replay.max_frames_reached",
            "frames": input_source.get("max_frames"),
        })

    session.trace_recorder.call("write_to_path", output_path)
    quit(0)


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
        else:
            index += 1

    return parsed


func load_interactive_scene(scene_path: String) -> PackedScene:
    return load(scene_path) as PackedScene


func on_player_trace_event(event_type: String, payload: Dictionary, recorder: Node) -> void:
    recorder.call("record_player_event", event_type, payload)
