extends Node2D
class_name HazardMarker

@export var hazard_id: String = "hazard"
@export var hazard_type: String = "spike"
@export var damage: int = 1
@export var trigger_radius: float = 40.0
@export var knockback: Vector2 = Vector2.ZERO


func _ready() -> void:
    add_to_group("level_marker")
    add_to_group("hazard_marker")


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
