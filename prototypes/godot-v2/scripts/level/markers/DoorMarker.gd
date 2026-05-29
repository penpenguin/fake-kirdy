extends Node2D
class_name DoorMarker

@export var door_id: String = "door"
@export var target_level_id: String = ""
@export var target_spawn_id: String = "default"
@export var trigger_radius: float = 64.0


func _ready() -> void:
    add_to_group("level_marker")
    add_to_group("door_marker")


func to_level_marker() -> Dictionary:
    return {
        "marker_type": "door",
        "id": door_id,
        "position": {
            "x": global_position.x,
            "y": global_position.y,
        },
        "payload": {
            "target_level_id": target_level_id,
            "target_spawn_id": target_spawn_id,
            "trigger_radius": trigger_radius,
        },
    }
