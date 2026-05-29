extends Node2D
class_name CameraBoundsMarker

@export var bounds_id: String = "main"
@export var size: Vector2 = Vector2(960, 540)


func _ready() -> void:
    add_to_group("level_marker")
    add_to_group("camera_bounds_marker")


func to_level_marker() -> Dictionary:
    return {
        "marker_type": "camera_bounds",
        "id": bounds_id,
        "position": {
            "x": global_position.x,
            "y": global_position.y,
        },
        "payload": {
            "size": {
                "x": size.x,
                "y": size.y,
            },
        },
    }
