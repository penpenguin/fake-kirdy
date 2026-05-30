extends Node2D
class_name AbilityGateMarker

@export var gate_id: String = "ability_gate"
@export var required_ability_type: String = "fire"
@export var gate_effect: String = "open"
@export var trigger_radius: float = 72.0
@export var grants_item_id: String = ""


func _ready() -> void:
    add_to_group("level_marker")
    add_to_group("ability_gate_marker")


func to_level_marker() -> Dictionary:
    return {
        "marker_type": "ability_gate",
        "id": gate_id,
        "position": {
            "x": global_position.x,
            "y": global_position.y,
        },
        "payload": {
            "required_ability_type": required_ability_type,
            "gate_effect": gate_effect,
            "trigger_radius": trigger_radius,
            "grants_item_id": grants_item_id,
        },
    }
