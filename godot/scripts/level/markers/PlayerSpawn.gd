extends Node2D
class_name PlayerSpawn

@export var spawn_id: String = "default"
@export var facing: int = 1


func _ready() -> void:
    add_to_group("level_marker")
    add_to_group("player_spawn")


func to_level_marker() -> Dictionary:
    return {
        "marker_type": "player_spawn",
        "id": spawn_id,
        "position": {
            "x": global_position.x,
            "y": global_position.y,
        },
        "payload": {
            "facing": facing,
        },
    }
