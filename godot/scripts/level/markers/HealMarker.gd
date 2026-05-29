extends Node2D
class_name HealMarker

@export var heal_id: String = "heal"
@export var amount: int = 1
@export var reward_type: String = "health"


func _ready() -> void:
    add_to_group("level_marker")
    add_to_group("heal_marker")


func to_level_marker() -> Dictionary:
    return {
        "marker_type": "heal",
        "id": heal_id,
        "position": {
            "x": global_position.x,
            "y": global_position.y,
        },
        "payload": {
            "amount": amount,
            "reward_type": reward_type,
        },
    }
