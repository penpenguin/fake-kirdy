extends Control
class_name MapOverlay

const FEATURE_MARKER_SIZE := 8.0
const FEATURE_MARKER_STYLES := {
    "door": {"shape": "rect", "label": "Door"},
    "goal": {"shape": "diamond", "label": "Goal"},
    "collectible": {"shape": "circle", "label": "Item"},
    "heal": {"shape": "cross", "label": "Heal"},
    "hazard": {"shape": "triangle", "label": "Hazard"},
    "ability_gate": {"shape": "bar", "label": "Gate"},
    "dead_end": {"shape": "square", "label": "Dead End"},
}

@export var map_tile_size: float = 6.0
@export var level_gap: float = 8.0
@export var current_level_color: Color = Color(0.95, 0.80, 0.36, 0.9)
@export var visited_level_color: Color = Color(0.35, 0.65, 0.82, 0.72)
@export var discovered_feature_color: Color = Color(0.68, 0.95, 0.52, 0.95)
@export var undiscovered_feature_color: Color = Color(0.82, 0.82, 0.88, 0.42)
@export var dead_end_completed_color: Color = Color(1.0, 0.35, 0.70, 0.95)
@export var background_color: Color = Color(0.03, 0.04, 0.05, 0.72)
@export var legend_label_font_size: int = 12

var current_level_id: String = ""
var explored_tiles: Dictionary = {}
var map_features: Array = []


func _ready() -> void:
    mouse_filter = Control.MOUSE_FILTER_IGNORE
    custom_minimum_size = Vector2(220.0, 132.0)


func set_map_state(level_id: String, next_explored_tiles: Dictionary, next_features: Array = []) -> void:
    current_level_id = level_id
    explored_tiles = duplicate_explored_tiles(next_explored_tiles)
    map_features = duplicate_map_features(next_features)
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


func build_feature_markers() -> Array:
    var markers := []
    var level_ids := explored_tiles.keys()
    level_ids.sort()

    for feature in map_features:
        if typeof(feature) != TYPE_DICTIONARY:
            continue

        var feature_level_id := String(feature.get("level_id", current_level_id))
        var level_index := level_ids.find(feature_level_id)
        if level_index < 0:
            continue

        var tile_position := parse_tile_key(String(feature.get("tile_key", "")))
        if tile_position.x < 0 or tile_position.y < 0:
            continue

        var level_offset := Vector2(0.0, float(level_index) * (map_tile_size * 4.0 + level_gap))
        markers.append({
            "level_id": feature_level_id,
            "feature_type": String(feature.get("feature_type", "")),
            "feature_id": String(feature.get("feature_id", "")),
            "position": level_offset + Vector2(
                (float(tile_position.x) + 0.5) * map_tile_size,
                (float(tile_position.y) + 0.5) * map_tile_size
            ),
            "discovered": bool(feature.get("discovered", false)),
            "completed": bool(feature.get("completed", false)),
        })

    return markers


func _draw() -> void:
    draw_rect(Rect2(Vector2.ZERO, custom_minimum_size), background_color, true)
    for tile in build_tile_rects():
        var color := current_level_color if bool(tile.get("is_current_level", false)) else visited_level_color
        draw_rect(tile["rect"], color, true)
    for marker in build_feature_markers():
        draw_feature_marker(marker)
    draw_feature_legend()


func draw_feature_marker(marker: Dictionary) -> void:
    var feature_type := String(marker.get("feature_type", ""))
    var marker_color := get_marker_color(marker)
    var marker_position: Vector2 = marker.get("position", Vector2.ZERO)
    var marker_size: float = maxf(FEATURE_MARKER_SIZE, map_tile_size)
    var style: Dictionary = FEATURE_MARKER_STYLES.get(feature_type, {"shape": "circle"})
    var shape := String(style.get("shape", "circle"))

    match shape:
        "rect", "square":
            draw_rect(Rect2(marker["position"] - Vector2(marker_size * 0.5, marker_size * 0.5), Vector2(marker_size, marker_size)), marker_color, true)
        "diamond":
            draw_polygon(PackedVector2Array([
                marker_position + Vector2(0.0, -marker_size * 0.62),
                marker_position + Vector2(marker_size * 0.62, 0.0),
                marker_position + Vector2(0.0, marker_size * 0.62),
                marker_position + Vector2(-marker_size * 0.62, 0.0),
            ]), PackedColorArray([marker_color]))
        "triangle":
            draw_polygon(PackedVector2Array([
                marker_position + Vector2(0.0, -marker_size * 0.62),
                marker_position + Vector2(marker_size * 0.62, marker_size * 0.5),
                marker_position + Vector2(-marker_size * 0.62, marker_size * 0.5),
            ]), PackedColorArray([marker_color]))
        "cross":
            var thickness := maxf(marker_size * 0.32, 3.0)
            draw_rect(Rect2(marker_position - Vector2(thickness * 0.5, marker_size * 0.5), Vector2(thickness, marker_size)), marker_color, true)
            draw_rect(Rect2(marker_position - Vector2(marker_size * 0.5, thickness * 0.5), Vector2(marker_size, thickness)), marker_color, true)
        "bar":
            draw_rect(Rect2(marker_position - Vector2(marker_size * 0.32, marker_size * 0.7), Vector2(marker_size * 0.64, marker_size * 1.4)), marker_color, true)
        _:
            draw_circle(marker_position, marker_size * 0.5, marker_color)


func get_marker_color(marker: Dictionary) -> Color:
    if String(marker.get("feature_type", "")) == "dead_end" and bool(marker.get("completed", false)):
        return dead_end_completed_color

    return discovered_feature_color if bool(marker.get("discovered", false)) else undiscovered_feature_color


func draw_feature_legend() -> void:
    var font := get_theme_default_font()
    if font == null:
        return

    var labels := ["door", "goal", "collectible", "heal", "hazard", "ability_gate"]
    var start := Vector2(112.0, 18.0)
    for index in range(labels.size()):
        var feature_type := String(labels[index])
        var position := start + Vector2(0.0, float(index) * 17.0)
        draw_feature_marker({
            "feature_type": feature_type,
            "position": position,
            "discovered": true,
            "completed": false,
        })
        var style: Dictionary = FEATURE_MARKER_STYLES.get(feature_type, {})
        draw_string(font, position + Vector2(10.0, 4.0), String(style.get("label", feature_type)), HORIZONTAL_ALIGNMENT_LEFT, -1.0, legend_label_font_size, discovered_feature_color)


func duplicate_map_features(source: Array) -> Array:
    var copy := []
    for feature in source:
        if typeof(feature) != TYPE_DICTIONARY:
            continue

        copy.append({
            "level_id": String(feature.get("level_id", "")),
            "feature_type": String(feature.get("feature_type", "")),
            "feature_id": String(feature.get("feature_id", "")),
            "tile_key": String(feature.get("tile_key", "")),
            "discovered": bool(feature.get("discovered", false)),
            "hidden": bool(feature.get("hidden", false)),
            "completed": bool(feature.get("completed", false)),
        })

    return copy


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
