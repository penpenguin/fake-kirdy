extends RefCounted
class_name FrameInput

var frame: int = 0
var actions: Dictionary = {}


static func from_dictionary(data: Dictionary):
    var frame_input = load("res://scripts/sim/FrameInput.gd").new()
    frame_input.frame = int(data.get("frame", 0))
    frame_input.actions = data.get("actions", {}).duplicate(true)
    return frame_input


func is_action_pressed(action: StringName) -> bool:
    return bool(actions.get(String(action), false))


func get_axis(left_action: StringName, right_action: StringName) -> float:
    return float(is_action_pressed(right_action)) - float(is_action_pressed(left_action))
