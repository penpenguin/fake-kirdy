extends Node2D
class_name DoorMarker

const DoorTexture = preload("res://resources/assets/images/ui/door-marker.webp")

@export var door_id: String = "door"
@export var target_level_id: String = ""
@export var target_spawn_id: String = "default"
@export var trigger_radius: float = 64.0
@export var required_item_id: String = ""
@export var required_keystone_item_id: String = ""
@export var required_ability_type: String = ""
@export var required_completed_level_id: String = ""
@export var required_defeated_enemy_group_id: String = ""
@export var required_boss_id: String = ""
@export var bypass_cluster_lock: bool = false
@export var hidden_until_discovered: bool = false
@export var discovery_radius: float = 80.0
@export var requires_interact: bool = true


func _ready() -> void:
    add_to_group("level_marker")
    add_to_group("door_marker")
    ensure_visual()


func ensure_visual() -> void:
    if has_node("Visual"):
        return

    var visual := Sprite2D.new()
    visual.name = "Visual"
    visual.texture = DoorTexture
    visual.scale = Vector2(0.34, 0.34)
    visual.z_index = 2
    visual.visible = not hidden_until_discovered
    add_child(visual)


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
            "required_item_id": required_item_id,
            "required_keystone_item_id": required_keystone_item_id,
            "required_ability_type": required_ability_type,
            "required_completed_level_id": required_completed_level_id,
            "required_defeated_enemy_group_id": required_defeated_enemy_group_id,
            "required_boss_id": required_boss_id,
            "bypass_cluster_lock": bypass_cluster_lock,
            "hidden_until_discovered": hidden_until_discovered,
            "discovery_radius": discovery_radius,
            "requires_interact": requires_interact,
        },
    }
