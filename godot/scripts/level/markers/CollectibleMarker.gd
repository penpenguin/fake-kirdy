extends Node2D
class_name CollectibleMarker

@export var collectible_id: String = "collectible"
@export var item_id: String = "collectible"
@export var trigger_radius: float = 48.0


func _ready() -> void:
    add_to_group("level_marker")
    add_to_group("collectible_marker")


func to_level_marker() -> Dictionary:
    return {
        "marker_type": "collectible",
        "id": collectible_id,
        "position": {
            "x": global_position.x,
            "y": global_position.y,
        },
        "payload": {
            "item_id": item_id,
            "trigger_radius": trigger_radius,
        },
    }
