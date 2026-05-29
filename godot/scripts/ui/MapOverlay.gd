extends Control
class_name MapOverlay

@export var map_tile_size: float = 6.0
@export var level_gap: float = 8.0
@export var current_level_color: Color = Color(0.95, 0.80, 0.36, 0.9)
@export var visited_level_color: Color = Color(0.35, 0.65, 0.82, 0.72)
@export var background_color: Color = Color(0.03, 0.04, 0.05, 0.72)

var current_level_id: String = ""
var explored_tiles: Dictionary = {}


func _ready() -> void:
    mouse_filter = Control.MOUSE_FILTER_IGNORE
    custom_minimum_size = Vector2(160.0, 96.0)


func set_map_state(level_id: String, next_explored_tiles: Dictionary) -> void:
    current_level_id = level_id
    explored_tiles = duplicate_explored_tiles(next_explored_tiles)
    queue_redraw()


func get_visible_tile_count() -> int:
    var count := 0
    for level_id in explored_tiles.keys():
        var tiles: Array = explored_tiles[level_id]
        count += tiles.size()

    return count


func build_tile_rects() -> Array:
    var rects := []
    var level_ids := explored_tiles.keys()
    level_ids.sort()
    var level_index := 0

    for level_id in level_ids:
        var tiles: Array = explored_tiles[level_id]
        var tile_keys := tiles.duplicate()
        tile_keys.sort()
        var level_offset := Vector2(0.0, float(level_index) * (map_tile_size * 4.0 + level_gap))

        for tile_key in tile_keys:
            var tile_position := parse_tile_key(String(tile_key))
            if tile_position.x < 0 or tile_position.y < 0:
                continue

            rects.append({
                "level_id": String(level_id),
                "tile_key": String(tile_key),
                "rect": Rect2(
                    level_offset + Vector2(tile_position.x * map_tile_size, tile_position.y * map_tile_size),
                    Vector2(map_tile_size, map_tile_size)
                ),
                "is_current_level": String(level_id) == current_level_id,
            })

        level_index += 1

    return rects


func _draw() -> void:
    draw_rect(Rect2(Vector2.ZERO, custom_minimum_size), background_color, true)
    for tile in build_tile_rects():
        var color := current_level_color if bool(tile.get("is_current_level", false)) else visited_level_color
        draw_rect(tile["rect"], color, true)


func duplicate_explored_tiles(source: Dictionary) -> Dictionary:
    var copy := {}
    for level_id in source.keys():
        var tiles = source[level_id]
        if typeof(tiles) != TYPE_ARRAY:
            continue

        var normalized_tiles := []
        for tile in tiles:
            normalized_tiles.append(String(tile))

        normalized_tiles.sort()
        copy[String(level_id)] = normalized_tiles

    return copy


func parse_tile_key(tile_key: String) -> Vector2i:
    var parts := tile_key.split(",")
    if parts.size() != 2:
        return Vector2i(-1, -1)

    if not String(parts[0]).is_valid_int() or not String(parts[1]).is_valid_int():
        return Vector2i(-1, -1)

    return Vector2i(int(parts[0]), int(parts[1]))
