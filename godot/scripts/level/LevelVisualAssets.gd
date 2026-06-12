extends RefCounted
class_name LevelVisualAssets

const WallTexture = preload("res://resources/assets/images/world/wall-texture.webp")
const BrickTileTexture = preload("res://resources/assets/images/world/brick-tile.webp")
const ForestTileTexture = preload("res://resources/assets/images/world/forest-tile.webp")
const FireTileTexture = preload("res://resources/assets/images/world/fire-tile.webp")
const IceTileTexture = preload("res://resources/assets/images/world/ice-tile.webp")
const StoneTileTexture = preload("res://resources/assets/images/world/stone-tile.webp")
const RoyalTileTexture = preload("res://resources/assets/images/world/royal-tile.webp")


func apply_to_level(level_root: Node, level_id: String) -> void:
    if level_root == null:
        return

    var texture := get_texture_for_level(level_id)
    apply_texture_to_polygons(level_root, texture)


func get_texture_for_level(level_id: String) -> Texture2D:
    var normalized_level_id := level_id.to_lower()

    if normalized_level_id.contains("forest"):
        return ForestTileTexture
    if normalized_level_id.contains("fire"):
        return FireTileTexture
    if normalized_level_id.contains("ice") or normalized_level_id.contains("aurora"):
        return IceTileTexture
    if normalized_level_id.contains("cave") or normalized_level_id.contains("ruin"):
        return StoneTileTexture
    if normalized_level_id.contains("sanctum") or normalized_level_id.contains("keep") or normalized_level_id.contains("spire"):
        return RoyalTileTexture
    if normalized_level_id.contains("hub") or normalized_level_id.contains("room"):
        return BrickTileTexture

    return WallTexture


func apply_texture_to_polygons(node: Node, texture: Texture2D) -> void:
    if node is Polygon2D:
        var polygon := node as Polygon2D
        if should_texture_polygon(polygon):
            polygon.texture = texture
            polygon.texture_repeat = CanvasItem.TEXTURE_REPEAT_ENABLED
            polygon.texture_scale = Vector2(1.0, 1.0)

    for child in node.get_children():
        apply_texture_to_polygons(child, texture)


func should_texture_polygon(polygon: Polygon2D) -> bool:
    var polygon_name := polygon.name.to_lower()
    return polygon_name.contains("floor") or polygon_name.contains("platform") or polygon_name.contains("step") or polygon_name.contains("wall")
