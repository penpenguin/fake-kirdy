extends GoalMarker
class_name GoalDoorController

const GoalDoorTexture = preload("res://resources/assets/images/ui/goal-marker.webp")

@export var goal_door_texture_path: String = "res://resources/assets/images/ui/goal-marker.webp"
@export var collect_score_metrics: bool = true
@export var collect_time_metrics: bool = true


func _ready() -> void:
    super._ready()
    add_to_group("goal_door_controller")
    ensure_visual()


func ensure_visual() -> void:
    var goal_texture := get_goal_door_texture()
    if has_node("Visual"):
        var existing_visual := $Visual as Sprite2D
        existing_visual.texture = goal_texture
        existing_visual.centered = true
        existing_visual.scale = Vector2(1.0, 1.0)
        existing_visual.z_index = 2
        return

    var visual := Sprite2D.new()
    visual.name = "Visual"
    visual.texture = goal_texture
    visual.centered = true
    visual.scale = Vector2(1.0, 1.0)
    visual.z_index = 2
    add_child(visual)


func get_goal_door_texture() -> Texture2D:
    var loaded_texture = load(goal_door_texture_path)
    if loaded_texture is Texture2D:
        return loaded_texture

    return GoalDoorTexture


func to_level_marker() -> Dictionary:
    var marker: Dictionary = super.to_level_marker()
    var payload: Dictionary = marker.get("payload", {})
    payload["controller_type"] = "goal_door"
    payload["goal_door_texture_path"] = goal_door_texture_path
    payload["collect_score_metrics"] = collect_score_metrics
    payload["collect_time_metrics"] = collect_time_metrics
    marker["payload"] = payload
    return marker
