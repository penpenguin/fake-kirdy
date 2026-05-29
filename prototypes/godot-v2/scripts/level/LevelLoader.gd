extends Node
class_name LevelLoader

const LevelDefinitionScript = preload("res://scripts/level/LevelDefinition.gd")

var level_paths: Dictionary = {
    "controller_lab": "res://levels/controller_lab.tscn",
    "flat_room": "res://levels/flat_room.tscn",
    "jump_room": "res://levels/jump_room.tscn",
    "door_room": "res://levels/door_room.tscn",
    "combat_room": "res://levels/combat_room.tscn",
}


func get_level_path(level_id: String) -> String:
    return String(level_paths.get(level_id, ""))


func load_level_by_id(level_id: String) -> Node:
    var level_path := get_level_path(level_id)
    if level_path == "":
        return null

    var packed_scene := load(level_path) as PackedScene
    if packed_scene == null:
        return null

    return packed_scene.instantiate()


func build_level_definition(root: Node, level_id: String = "") -> Resource:
    var definition = LevelDefinitionScript.new()
    definition.level_id = level_id if level_id != "" else root.name
    scan_marker_nodes(root, definition)
    return definition


func scan_marker_nodes(node: Node, definition: Resource) -> void:
    if node.has_method("to_level_marker"):
        definition.add_marker(node.to_level_marker())

    for child in node.get_children():
        scan_marker_nodes(child, definition)
