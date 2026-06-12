extends Node2D
class_name HealMarker

const HealTexture = preload("res://resources/assets/images/items/heal-orb.webp")

@export var heal_id: String = "heal"
@export var amount: int = 1
@export var reward_type: String = "health"
@export var dead_end_id: String = ""


func _ready() -> void:
    add_to_group("level_marker")
    add_to_group("heal_marker")
    ensure_visual()


func ensure_visual() -> void:
    if has_node("Visual"):
        return

    var visual := Sprite2D.new()
    visual.name = "Visual"
    visual.texture = HealTexture
    visual.scale = Vector2(0.30, 0.30)
    visual.z_index = 2
    add_child(visual)


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
            "dead_end_id": dead_end_id,
        },
    }
