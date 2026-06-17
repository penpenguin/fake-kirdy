extends Node2D
class_name HazardMarker

const LavaHazardTexture = preload("res://resources/assets/images/hazards/lava-hazard.webp")
const SpikeHazardTexture = preload("res://resources/assets/images/hazards/spike-hazard.webp")

@export var hazard_id: String = "hazard"
@export var hazard_type: String = "spike"
@export var hazard_visual_style: String = ""
@export var hazard_texture_path: String = ""
@export var damage: int = 1
@export var trigger_radius: float = 40.0
@export var knockback: Vector2 = Vector2.ZERO
@export var visual_target_size: Vector2 = Vector2(64.0, 48.0)


func _ready() -> void:
    add_to_group("level_marker")
    add_to_group("hazard_marker")
    ensure_visual()


func ensure_visual() -> void:
    var visual := get_node_or_null("HazardVisual") as Sprite2D
    if visual == null:
        visual = Sprite2D.new()
        visual.name = "HazardVisual"
        add_child(visual)

    visual.texture = get_hazard_texture()
    visual.z_index = 2
    fit_visual_to_target_size(visual)


func get_hazard_texture() -> Texture2D:
    if hazard_texture_path != "":
        var loaded_texture := load(hazard_texture_path) as Texture2D
        if loaded_texture != null:
            return loaded_texture

    if hazard_visual_style == "lava_texture" or hazard_type == "lava":
        return LavaHazardTexture

    return SpikeHazardTexture


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
        "marker_type": "hazard",
        "id": hazard_id,
        "position": {
            "x": global_position.x,
            "y": global_position.y,
        },
        "payload": {
            "hazard_type": hazard_type,
            "hazard_visual_style": hazard_visual_style,
            "hazard_texture_path": hazard_texture_path,
            "damage": damage,
            "trigger_radius": trigger_radius,
            "knockback": {
                "x": knockback.x,
                "y": knockback.y,
            },
        },
    }
