extends Node
class_name TraceRecorder

var events: Array[Dictionary] = []
var frame: int = 0
var fps: int = 60
var level_id: String = "controller_lab"


func configure(run_level_id: String, run_fps: int) -> void:
    level_id = run_level_id
    fps = max(run_fps, 1)


func set_frame(next_frame: int) -> void:
    frame = next_frame


func record_player_event(event_type: String, player_trace: Dictionary = {}) -> void:
    events.append(build_event(event_type, player_trace))


func record_event(event_type: String, payload: Dictionary = {}) -> void:
    events.append(build_event(event_type, {"payload": payload}))


func record_run_finished(payload: Dictionary = {}) -> void:
    record_event("run.finished", payload)


func record_replay_error(message: String, payload: Dictionary = {}) -> void:
    var error_payload := payload.duplicate(true)
    error_payload["message"] = message
    record_event("replay.error", error_payload)


func build_event(event_type: String, data: Dictionary = {}) -> Dictionary:
    return {
        "frame": frame,
        "time_ms": int(round(float(frame) * 1000.0 / float(fps))),
        "event_type": event_type,
        "level_id": String(data.get("level_id", level_id)),
        "player": data.get("player", {}),
        "payload": data.get("payload", {}),
    }


func to_json() -> String:
    return JSON.stringify(events, "  ")


func to_ndjson() -> String:
    var lines: Array[String] = []

    for event in events:
        lines.append(JSON.stringify(event))

    return "\n".join(lines)


func write_to_path(path: String, format: String = "") -> bool:
    var selected_format := format
    if selected_format == "":
        selected_format = "ndjson" if path.ends_with(".ndjson") else "json"

    var file := FileAccess.open(path, FileAccess.WRITE)
    if file == null:
        return false

    if selected_format == "ndjson":
        file.store_string(to_ndjson())
        if events.size() > 0:
            file.store_string("\n")
    else:
        file.store_string(to_json())

    return true
