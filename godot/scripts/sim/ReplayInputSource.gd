extends Node
class_name ReplayInputSource

const FrameInputScript = preload("res://scripts/sim/FrameInput.gd")

var scene_path: String = ""
var start_level_id: String = ""
var start_spawn_id: String = "default"
var initial_ability_type: String = ""
var initial_item_ids: Array[String] = []
var setting_difficulty: String = ""
var level_id: String = "controller_lab"
var fps: int = 60
var max_frames: int = 0
var continue_after_finished: bool = false
var current_frame: int = -1
var error_message: String = ""

var keyframes: Dictionary = {}
var current_actions: Dictionary = {}
var previous_actions: Dictionary = {}


func load_replay(path: String) -> bool:
    var file := FileAccess.open(path, FileAccess.READ)
    if file == null:
        error_message = "Unable to open replay: %s" % path
        return false

    var parsed = JSON.parse_string(file.get_as_text())
    if typeof(parsed) != TYPE_DICTIONARY:
        error_message = "Replay JSON root must be an object"
        return false

    scene_path = String(parsed.get("scene_path", ""))
    start_level_id = String(parsed.get("start_level_id", ""))
    start_spawn_id = String(parsed.get("start_spawn_id", "default"))
    initial_ability_type = String(parsed.get("initial_ability_type", ""))
    initial_item_ids = parse_string_array(parsed.get("initial_item_ids", []))
    setting_difficulty = String(parsed.get("setting_difficulty", ""))
    level_id = String(parsed.get("level_id", level_id))
    fps = int(parsed.get("fps", fps))
    max_frames = int(parsed.get("max_frames", 0))
    continue_after_finished = bool(parsed.get("continue_after_finished", false))
    keyframes.clear()
    current_actions.clear()
    previous_actions.clear()
    current_frame = -1

    for frame_data in parsed.get("frames", []):
        var frame_input = FrameInputScript.from_dictionary(frame_data)
        keyframes[frame_input.frame] = frame_input.actions

    error_message = ""
    return true


func parse_string_array(value) -> Array[String]:
    var result: Array[String] = []
    if typeof(value) != TYPE_ARRAY:
        return result

    for item in value:
        var item_id := String(item)
        if item_id == "" or result.has(item_id):
            continue

        result.append(item_id)

    return result


func advance_frame() -> RefCounted:
    previous_actions = current_actions.duplicate(true)
    current_frame += 1

    if keyframes.has(current_frame):
        for action in keyframes[current_frame]:
            current_actions[action] = keyframes[current_frame][action]

    var frame_input = FrameInputScript.new()
    frame_input.frame = current_frame
    frame_input.actions = current_actions.duplicate(true)
    return frame_input


func is_action_pressed(action: StringName) -> bool:
    return bool(current_actions.get(String(action), false))


func is_action_just_pressed(action: StringName) -> bool:
    return is_action_pressed(action) and not bool(previous_actions.get(String(action), false))


func is_action_just_released(action: StringName) -> bool:
    return not is_action_pressed(action) and bool(previous_actions.get(String(action), false))


func get_axis(left_action: StringName, right_action: StringName) -> float:
    return float(is_action_pressed(right_action)) - float(is_action_pressed(left_action))
