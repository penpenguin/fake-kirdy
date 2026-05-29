extends Node2D
class_name CollectibleMarker

const FireArtifactTexture = preload("res://resources/assets/images/items/fire-artifact.webp")
const IceArtifactTexture = preload("res://resources/assets/images/items/ice-artifact.webp")
const LeafArtifactTexture = preload("res://resources/assets/images/items/leaf-artifact.webp")
const RuinArtifactTexture = preload("res://resources/assets/images/items/ruin-artifact.webp")

@export var collectible_id: String = "collectible"
@export var item_id: String = "collectible"
@export var trigger_radius: float = 48.0


func _ready() -> void:
    add_to_group("level_marker")
    add_to_group("collectible_marker")
    ensure_visual()


func ensure_visual() -> void:
    if has_node("Visual"):
        return

    var visual := Sprite2D.new()
    visual.name = "Visual"
    visual.texture = get_artifact_texture()
    visual.scale = Vector2(0.16, 0.16)
    visual.z_index = 2
    add_child(visual)


func get_artifact_texture() -> Texture2D:
    var normalized_item_id := item_id.to_lower()

    if normalized_item_id.contains("ice"):
        return IceArtifactTexture
    if normalized_item_id.contains("leaf") or normalized_item_id.contains("forest"):
        return LeafArtifactTexture
    if normalized_item_id.contains("ruin") or normalized_item_id.contains("cave"):
        return RuinArtifactTexture

    return FireArtifactTexture


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
