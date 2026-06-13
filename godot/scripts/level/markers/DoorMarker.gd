extends Node2D
class_name DoorMarker

const DoorTexture = preload("res://resources/assets/images/ui/door-marker.webp")

@export var door_id: String = "door"
@export var door_role: String = "progress"
@export var door_label: String = ""
@export var door_visual_style: String = "region"
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
@export var visual_target_size: Vector2 = Vector2(56.0, 72.0)


func _ready() -> void:
    add_to_group("level_marker")
    add_to_group("door_marker")
    ensure_visual()
    fit_visual_to_target_size($Visual)


func ensure_visual() -> void:
    if has_node("Visual"):
        return

    var visual := Sprite2D.new()
    visual.name = "Visual"
    visual.texture = DoorTexture
    visual.z_index = 2
    visual.visible = not hidden_until_discovered
    visual.scale = Vector2(0.36, 0.36)
    add_child(visual)


func fit_visual_to_target_size(visual: Sprite2D) -> void:
    if visual == null or visual.texture == null:
        return

    var texture_size := visual.texture.get_size()
    if texture_size.x <= 0.0 or texture_size.y <= 0.0:
        return

    var scale_factor: float = minf(visual_target_size.x / texture_size.x, visual_target_size.y / texture_size.y)
    visual.scale = Vector2(scale_factor, scale_factor)


func to_level_marker() -> Dictionary:
    return {
        "marker_type": "door",
        "id": door_id,
        "position": {
            "x": global_position.x,
            "y": global_position.y,
        },
        "payload": {
            "door_role": door_role,
            "door_label": door_label,
            "door_visual_style": door_visual_style,
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
