extends SceneTree

const ReplayInputSourceScript = preload("res://scripts/sim/ReplayInputSource.gd")
const GameSessionScript = preload("res://scripts/session/GameSession.gd")


func _init() -> void:
    call_deferred("run")


func run() -> void:
    var args := parse_user_args()
    var replay_path := String(args.get("replay", "res://tests/replays/central_hub_to_heal_goal.json"))
    var output_path := String(args.get("out", "user://playable-quality.png"))
    var capture_frame := int(args.get("frame", 20))
    var viewport_width := int(args.get("width", 1280))
    var viewport_height := int(args.get("height", 720))

    root.size = Vector2i(viewport_width, viewport_height)

    var input_source: Node = ReplayInputSourceScript.new()
    root.add_child(input_source)

    if not input_source.call("load_replay", replay_path):
        printerr("Unable to load replay: %s" % input_source.get("error_message"))
        quit(1)
        return

    var session = GameSessionScript.new()
    session.auto_start = false
    session.input_source = input_source
    if String(input_source.get("setting_difficulty")) != "":
        session.setting_difficulty = String(input_source.get("setting_difficulty"))
    root.add_child(session)

    if not session.call(
        "start_session",
        input_source.get("start_level_id"),
        input_source.get("start_spawn_id"),
        input_source.get("fps")
    ):
        printerr("Unable to start session for replay: %s" % replay_path)
        quit(1)
        return

    if String(input_source.get("initial_ability_type")) != "" and session.player != null:
        session.player.call("set_ability_type", String(input_source.get("initial_ability_type")))
        session.call("sync_hud_overlay", "screenshot.initial_ability", true)

    for item_id in input_source.get("initial_item_ids"):
        session.call("acquire_item", String(item_id), "screenshot_initial_item")

    await process_frame

    var max_frames: int = min(capture_frame, int(input_source.get("max_frames")))
    for _frame in range(max_frames):
        input_source.call("advance_frame")
        await physics_frame
        if session.call("is_finished"):
            break

    await process_frame
    await process_frame

    var viewport_texture := root.get_texture()
    if viewport_texture == null:
        printerr("Unable to capture screenshot: viewport texture is unavailable")
        quit(1)
        return

    var image: Image = viewport_texture.get_image()
    if image == null:
        printerr("Unable to capture screenshot: viewport image is unavailable")
        quit(1)
        return

    var save_error := image.save_png(output_path)
    if save_error != OK:
        printerr("Unable to save screenshot: %s error=%s" % [output_path, save_error])
        quit(1)
        return

    print(output_path)
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
        elif arg == "--frame" and index + 1 < args.size():
            parsed["frame"] = int(args[index + 1])
            index += 2
        elif arg == "--width" and index + 1 < args.size():
            parsed["width"] = int(args[index + 1])
            index += 2
        elif arg == "--height" and index + 1 < args.size():
            parsed["height"] = int(args[index + 1])
            index += 2
        else:
            index += 1

    return parsed
