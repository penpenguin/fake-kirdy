extends Node2D
class_name HazardMarker

const HAZARD_VISUAL_SIZE := 32.0

@export var hazard_id: String = "hazard"
@export var hazard_type: String = "spike"
@export var damage: int = 1
@export var trigger_radius: float = 40.0
@export var knockback: Vector2 = Vector2.ZERO


func _ready() -> void:
    add_to_group("level_marker")
    add_to_group("hazard_marker")
    ensure_visual()


func ensure_visual() -> void:
    if has_node("HazardVisual"):
        return

    var visual := Polygon2D.new()
    visual.name = "HazardVisual"
    visual.color = Color(1.0, 0.28, 0.20, 0.92)
    visual.z_index = 2
    var half_size := HAZARD_VISUAL_SIZE * 0.5
    visual.polygon = PackedVector2Array([
        Vector2(0.0, -half_size),
        Vector2(half_size, half_size),
        Vector2(-half_size, half_size),
    ])
    add_child(visual)


func to_level_marker() -> Dictionary:
    return {
        "marker_type": "hazard",
        "id": hazard_id,
        "position": {
            "x": global_position.x,
            "y": global_position.y,
        },
        "payload": {
            "hazard_type": hazard_type,
            "damage": damage,
            "trigger_radius": trigger_radius,
            "knockback": {
                "x": knockback.x,
                "y": knockback.y,
            },
        },
    }
