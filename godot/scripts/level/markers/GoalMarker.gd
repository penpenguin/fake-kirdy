extends Node2D
class_name GoalMarker

@export var goal_id: String = "goal"
@export var result_label: String = "complete"
@export var trigger_radius: float = 64.0


func _ready() -> void:
    add_to_group("level_marker")
    add_to_group("goal_marker")


func to_level_marker() -> Dictionary:
    return {
        "marker_type": "goal",
        "id": goal_id,
        "position": {
            "x": global_position.x,
            "y": global_position.y,
        },
        "payload": {
            "result_label": result_label,
            "trigger_radius": trigger_radius,
        },
    }
