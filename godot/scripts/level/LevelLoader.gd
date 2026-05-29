extends Node
class_name LevelLoader

const LevelDefinitionScript = preload("res://scripts/level/LevelDefinition.gd")
const PlayerSpawnScript = preload("res://scripts/level/markers/PlayerSpawn.gd")
const DoorMarkerScript = preload("res://scripts/level/markers/DoorMarker.gd")
const CameraBoundsMarkerScript = preload("res://scripts/level/markers/CameraBoundsMarker.gd")
const EnemySpawnMarkerScript = preload("res://scripts/level/markers/EnemySpawnMarker.gd")
const HealMarkerScript = preload("res://scripts/level/markers/HealMarker.gd")
const CollectibleMarkerScript = preload("res://scripts/level/markers/CollectibleMarker.gd")
const GoalMarkerScript = preload("res://scripts/level/markers/GoalMarker.gd")
const LevelTileMapScript = preload("res://scripts/level/LevelTileMap.gd")

@export var level_catalog_path: String = "res://levels/level_catalog.json"
@export var procedural_levels_path: String = "res://levels/generated/procedural_levels.json"

var catalog_levels: Dictionary = {}
var catalog_loaded: bool = false
var catalog_error: String = ""
var procedural_levels: Dictionary = {}
var procedural_levels_loaded: bool = false
var procedural_levels_error: String = ""


func _ready() -> void:
    load_level_catalog()
    load_procedural_level_catalog()


func load_level_catalog() -> bool:
    catalog_levels.clear()
    catalog_loaded = false
    catalog_error = ""

    var file := FileAccess.open(level_catalog_path, FileAccess.READ)
    if file == null:
        catalog_error = "Unable to open level catalog: %s" % level_catalog_path
        return false

    var parsed = JSON.parse_string(file.get_as_text())
    if typeof(parsed) != TYPE_DICTIONARY:
        catalog_error = "Level catalog root must be an object"
        return false

    var levels: Array = parsed.get("levels", [])
    for entry in levels:
        if typeof(entry) != TYPE_DICTIONARY:
            continue

        var level_id := String(entry.get("id", ""))
        var scene_path := String(entry.get("scene_path", ""))
        if level_id == "" or scene_path == "":
            continue

        catalog_levels[level_id] = entry

    catalog_loaded = true
    return true


func load_procedural_level_catalog() -> bool:
    procedural_levels.clear()
    procedural_levels_loaded = false
    procedural_levels_error = ""

    var file := FileAccess.open(procedural_levels_path, FileAccess.READ)
    if file == null:
        procedural_levels_error = "Unable to open procedural levels: %s" % procedural_levels_path
        return false

    var parsed = JSON.parse_string(file.get_as_text())
    if typeof(parsed) != TYPE_DICTIONARY:
        procedural_levels_error = "Procedural levels root must be an object"
        return false

    var levels: Array = parsed.get("levels", [])
    for entry in levels:
        if typeof(entry) != TYPE_DICTIONARY:
            continue

        var level_id := String(entry.get("id", ""))
        if level_id == "":
            continue

        procedural_levels[level_id] = entry

    procedural_levels_loaded = true
    return true


func get_level_path(level_id: String) -> String:
    if not catalog_loaded:
        load_level_catalog()

    var entry: Dictionary = catalog_levels.get(level_id, {})
    var scene_path := String(entry.get("scene_path", ""))
    if scene_path != "":
        return scene_path

    if get_procedural_level_entry(level_id).is_empty():
        return ""

    return "generated_schema://%s" % level_id


func load_level_by_id(level_id: String) -> Node:
    var level_path := get_level_path(level_id)
    if level_path == "":
        return null

    if level_path.begins_with("generated_schema://"):
        return create_generated_procedural_level(level_id)

    var packed_scene := load(level_path) as PackedScene
    if packed_scene == null:
        return null

    return packed_scene.instantiate()


func get_procedural_level_entry(level_id: String) -> Dictionary:
    if not procedural_levels_loaded:
        load_procedural_level_catalog()

    return procedural_levels.get(level_id, {})


func create_generated_procedural_level(level_id: String) -> Node2D:
    var entry := get_procedural_level_entry(level_id)
    if entry.is_empty():
        return null

    var root := Node2D.new()
    root.name = level_id.to_pascal_case()
    root.set_meta("generated_schema", true)
    root.set_meta("phaser_stage_id", String(entry.get("phaser_stage_id", "")))
    root.set_meta("scene_strategy", String(entry.get("scene_strategy", "generated_schema")))

    var runtime_layout := get_runtime_layout(entry)
    add_generated_tilemap(root, entry, runtime_layout)
    add_generated_spawn(root, "default", get_generated_spawn_position("default", runtime_layout))
    add_generated_directional_spawns(root, runtime_layout)
    add_generated_camera_bounds(root, runtime_layout)
    add_generated_floor(root, runtime_layout)
    add_generated_platforms(root, entry, runtime_layout)
    add_generated_content_markers(root, runtime_layout)
    add_generated_doors(root, entry, runtime_layout)

    return root


func get_runtime_layout(entry: Dictionary) -> Dictionary:
    return entry.get("runtime_layout", {})


func add_generated_tilemap(root: Node2D, entry: Dictionary, runtime_layout: Dictionary) -> void:
    var tilemap := TileMap.new()
    tilemap.name = "GeneratedTileMap"
    tilemap.set_script(LevelTileMapScript)
    tilemap.set("metadata_tile_size", get_layout_vector2i(runtime_layout, "tile_size", Vector2i(32, 32)))
    tilemap.set("columns", int(get_layout_number(runtime_layout, "grid", "columns", float(entry.get("layout", {}).get("columns", 0)))))
    tilemap.set("rows", int(get_layout_number(runtime_layout, "grid", "rows", float(entry.get("layout", {}).get("rows", 0)))))
    tilemap.set("collision_source", "static_body")
    root.add_child(tilemap)


func add_generated_spawn(root: Node2D, spawn_id: String, position: Vector2) -> void:
    var spawn := Node2D.new()
    spawn.name = "PlayerSpawn%s" % spawn_id.to_pascal_case()
    spawn.position = position
    spawn.set_script(PlayerSpawnScript)
    spawn.set("spawn_id", spawn_id)
    root.add_child(spawn)


func add_generated_directional_spawns(root: Node2D, runtime_layout: Dictionary) -> void:
    for spawn_id in ["west", "east", "north", "south"]:
        add_generated_spawn(root, spawn_id, get_generated_spawn_position(spawn_id, runtime_layout))


func get_generated_spawn_position(spawn_id: String, runtime_layout: Dictionary = {}) -> Vector2:
    var fallback := Vector2(96.0, 368.0)
    match spawn_id:
        "west":
            fallback = Vector2(112.0, 368.0)
        "east":
            fallback = Vector2(624.0, 368.0)
        "north":
            fallback = Vector2(380.0, 160.0)
        "south":
            fallback = Vector2(380.0, 336.0)

    return get_layout_vector2(runtime_layout, "spawns", spawn_id, fallback)


func add_generated_camera_bounds(root: Node2D, runtime_layout: Dictionary) -> void:
    var camera_bounds: Dictionary = runtime_layout.get("camera_bounds", {})
    var bounds := Node2D.new()
    bounds.name = "CameraBoundsMarker"
    bounds.position = dictionary_to_vector2(camera_bounds.get("position", {}), Vector2(380.0, 270.0))
    bounds.set_script(CameraBoundsMarkerScript)
    bounds.set("size", dictionary_to_vector2(camera_bounds.get("size", {}), Vector2(840.0, 540.0)))
    root.add_child(bounds)


func add_generated_floor(root: Node2D, runtime_layout: Dictionary) -> void:
    var floor: Dictionary = runtime_layout.get("floor", {})
    add_generated_solid_platform(
        root,
        String(floor.get("id", "Floor")),
        dictionary_to_vector2(floor.get("position", {}), Vector2(380.0, 432.0)),
        dictionary_to_vector2(floor.get("size", {}), Vector2(760.0, 32.0)),
        Color(0.18, 0.28, 0.34, 1.0)
    )


func add_generated_platforms(root: Node2D, entry: Dictionary, runtime_layout: Dictionary) -> void:
    var metadata: Dictionary = entry.get("metadata", {})
    var cluster := String(metadata.get("cluster", "void"))
    var platforms: Array = runtime_layout.get("platforms", [])

    for platform in platforms:
        if typeof(platform) != TYPE_DICTIONARY:
            continue

        var platform_id := String(platform.get("id", "GeneratedPlatform"))
        var color := get_generated_platform_color(cluster)
        if platform_id.ends_with("High"):
            color = color.lightened(0.15)
        add_generated_solid_platform(
            root,
            platform_id,
            dictionary_to_vector2(platform.get("position", {}), Vector2(328.0, 344.0)),
            dictionary_to_vector2(platform.get("size", {}), Vector2(144.0, 24.0)),
            color
        )


func add_generated_solid_platform(root: Node2D, node_name: String, position: Vector2, size: Vector2, color: Color) -> void:
    var floor := StaticBody2D.new()
    floor.name = node_name
    floor.position = position

    var floor_shape := CollisionShape2D.new()
    floor_shape.name = "CollisionShape2D"
    var rectangle_shape := RectangleShape2D.new()
    rectangle_shape.size = size
    floor_shape.shape = rectangle_shape
    floor.add_child(floor_shape)

    var floor_visual := Polygon2D.new()
    floor_visual.name = "FloorVisual"
    floor_visual.color = color
    var half_size := size * 0.5
    floor_visual.polygon = PackedVector2Array([
        Vector2(-half_size.x, -half_size.y),
        Vector2(half_size.x, -half_size.y),
        Vector2(half_size.x, half_size.y),
        Vector2(-half_size.x, half_size.y),
    ])
    floor.add_child(floor_visual)

    root.add_child(floor)


func add_generated_content_markers(root: Node2D, runtime_layout: Dictionary) -> void:
    var content: Dictionary = runtime_layout.get("content", {})
    for enemy_payload in content.get("enemies", []):
        if typeof(enemy_payload) == TYPE_DICTIONARY:
            add_generated_enemy_marker(root, enemy_payload)

    for heal_payload in content.get("heals", []):
        if typeof(heal_payload) == TYPE_DICTIONARY:
            add_generated_heal_marker(root, heal_payload)

    for collectible_payload in content.get("collectibles", []):
        if typeof(collectible_payload) == TYPE_DICTIONARY:
            add_generated_collectible_marker(root, collectible_payload)

    for goal_payload in content.get("goals", []):
        if typeof(goal_payload) == TYPE_DICTIONARY:
            add_generated_goal_marker(root, goal_payload)


func add_generated_enemy_marker(root: Node2D, payload: Dictionary) -> void:
    var enemy := Node2D.new()
    enemy.name = String(payload.get("id", "GeneratedEnemySpawn"))
    enemy.position = dictionary_to_vector2(payload.get("position", {}), Vector2(336.0, 400.0))
    enemy.set_script(EnemySpawnMarkerScript)
    enemy.set("spawn_id", String(payload.get("spawn_id", "generated_enemy")))
    enemy.set("enemy_type", String(payload.get("enemy_type", "generated_ground")))
    enemy.set("ability_type", String(payload.get("ability_type", "spark")))
    enemy.set("contact_damage", int(payload.get("contact_damage", 1)))
    root.add_child(enemy)


func add_generated_heal_marker(root: Node2D, payload: Dictionary) -> void:
    var heal := Node2D.new()
    heal.name = String(payload.get("id", "GeneratedHealMarker"))
    heal.position = dictionary_to_vector2(payload.get("position", {}), Vector2(456.0, 368.0))
    heal.set_script(HealMarkerScript)
    heal.set("heal_id", String(payload.get("heal_id", "generated_heal")))
    heal.set("amount", int(payload.get("amount", 1)))
    heal.set("reward_type", String(payload.get("reward_type", "health")))
    root.add_child(heal)


func add_generated_collectible_marker(root: Node2D, payload: Dictionary) -> void:
    var collectible := Node2D.new()
    collectible.name = String(payload.get("id", "GeneratedCollectibleMarker"))
    collectible.position = dictionary_to_vector2(payload.get("position", {}), Vector2(592.0, 368.0))
    collectible.set_script(CollectibleMarkerScript)
    collectible.set("collectible_id", String(payload.get("collectible_id", "generated_shard")))
    collectible.set("item_id", String(payload.get("item_id", "generated-shard")))
    collectible.set("trigger_radius", float(payload.get("trigger_radius", 48.0)))
    root.add_child(collectible)


func add_generated_goal_marker(root: Node2D, payload: Dictionary) -> void:
    var goal := Node2D.new()
    goal.name = String(payload.get("id", "GeneratedGoalMarker"))
    goal.position = dictionary_to_vector2(payload.get("position", {}), Vector2(224.0, 368.0))
    goal.set_script(GoalMarkerScript)
    goal.set("goal_id", String(payload.get("goal_id", "generated_goal")))
    goal.set("result_label", String(payload.get("result_label", "complete")))
    goal.set("trigger_radius", float(payload.get("trigger_radius", 48.0)))
    root.add_child(goal)


func get_generated_platform_color(cluster: String) -> Color:
    match cluster:
        "forest":
            return Color(0.20, 0.42, 0.26, 1.0)
        "ice":
            return Color(0.28, 0.46, 0.58, 1.0)
        "fire":
            return Color(0.55, 0.25, 0.18, 1.0)
        "sky":
            return Color(0.34, 0.38, 0.58, 1.0)
        "ruins":
            return Color(0.34, 0.32, 0.30, 1.0)
        _:
            return Color(0.22, 0.25, 0.30, 1.0)


func add_generated_doors(root: Node2D, entry: Dictionary, runtime_layout: Dictionary) -> void:
    var neighbors: Dictionary = entry.get("neighbors", {})
    var directions := neighbors.keys()
    directions.sort()

    for direction in directions:
        var direction_name := String(direction)
        var target_level_id := String(neighbors[direction])
        if target_level_id == "":
            continue

        var door := Node2D.new()
        door.name = "Door%s" % direction_name.to_pascal_case()
        door.position = get_generated_door_position(direction_name, runtime_layout)
        door.set_script(DoorMarkerScript)
        door.set("door_id", "%s_to_%s" % [String(entry.get("id", root.name)), target_level_id])
        door.set("target_level_id", target_level_id)
        door.set("target_spawn_id", get_generated_target_spawn_id(direction_name))
        door.set("trigger_radius", get_layout_number(runtime_layout, "safety", "door_trigger_radius", 48.0))
        root.add_child(door)


func get_generated_door_position(direction: String, runtime_layout: Dictionary = {}) -> Vector2:
    var fallback := Vector2(704.0, 368.0)
    match direction:
        "west":
            fallback = Vector2(16.0, 368.0)
        "east":
            fallback = Vector2(704.0, 368.0)
        "north":
            fallback = Vector2(380.0, 96.0)
        "south":
            fallback = Vector2(380.0, 416.0)

    return get_layout_vector2(runtime_layout, "doors", direction, fallback)


func get_generated_target_spawn_id(direction: String) -> String:
    match direction:
        "west":
            return "east"
        "east":
            return "west"
        "north":
            return "south"
        "south":
            return "north"
        _:
            return "default"


func get_layout_vector2(runtime_layout: Dictionary, section_name: String, key: String, fallback: Vector2) -> Vector2:
    var section: Dictionary = runtime_layout.get(section_name, {})
    return dictionary_to_vector2(section.get(key, {}), fallback)


func get_layout_vector2i(runtime_layout: Dictionary, key: String, fallback: Vector2i) -> Vector2i:
    var payload: Dictionary = runtime_layout.get(key, {})
    return Vector2i(int(payload.get("x", fallback.x)), int(payload.get("y", fallback.y)))


func get_layout_number(runtime_layout: Dictionary, section_name: String, key: String, fallback: float) -> float:
    var section: Dictionary = runtime_layout.get(section_name, {})
    return float(section.get(key, fallback))


func dictionary_to_vector2(data: Dictionary, fallback: Vector2) -> Vector2:
    return Vector2(float(data.get("x", fallback.x)), float(data.get("y", fallback.y)))


func build_level_definition(root: Node, level_id: String = "") -> Resource:
    var definition = LevelDefinitionScript.new()
    definition.level_id = level_id if level_id != "" else root.name
    scan_marker_nodes(root, definition)
    return definition


func scan_marker_nodes(node: Node, definition: Resource) -> void:
    if node.has_method("to_level_marker"):
        definition.add_marker(node.to_level_marker())
    if node.has_method("to_level_tilemap"):
        definition.add_tilemap(node.to_level_tilemap())

    for child in node.get_children():
        scan_marker_nodes(child, definition)
