extends Node2D
class_name GoalMarker

const GoalTexture = preload("res://resources/assets/images/ui/goal-marker.webp")

@export var goal_id: String = "goal"
@export var result_label: String = "complete"
@export var trigger_radius: float = 64.0


func _ready() -> void:
    add_to_group("level_marker")
    add_to_group("goal_marker")
    ensure_visual()


func ensure_visual() -> void:
    if has_node("Visual"):
        return

    var visual := Sprite2D.new()
    visual.name = "Visual"
    visual.texture = GoalTexture
    visual.centered = true
    visual.scale = Vector2(1.0, 1.0)
    visual.z_index = 2
    add_child(visual)


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
