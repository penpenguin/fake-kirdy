extends GoalMarker
class_name GoalDoorController

@export var goal_door_texture_path: String = "res://resources/assets/images/ui/goal-door.webp"
@export var collect_score_metrics: bool = true
@export var collect_time_metrics: bool = true


func _ready() -> void:
    super._ready()
    add_to_group("goal_door_controller")


func to_level_marker() -> Dictionary:
    var marker: Dictionary = super.to_level_marker()
    var payload: Dictionary = marker.get("payload", {})
    payload["controller_type"] = "goal_door"
    payload["goal_door_texture_path"] = goal_door_texture_path
    payload["collect_score_metrics"] = collect_score_metrics
    payload["collect_time_metrics"] = collect_time_metrics
    marker["payload"] = payload
    return marker
