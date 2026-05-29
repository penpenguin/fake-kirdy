extends Control
class_name InventoryOverlay

@onready var items_label: Label = $ItemsLabel
@onready var ability_label: Label = $AbilityLabel
@onready var progress_label: Label = $ProgressLabel

var inventory_state: Dictionary = {}


func _ready() -> void:
    mouse_filter = Control.MOUSE_FILTER_IGNORE
    custom_minimum_size = Vector2(304.0, 82.0)
    set_inventory_state(inventory_state)


func set_inventory_state(next_state: Dictionary) -> void:
    inventory_state = normalize_inventory_state(next_state)
    if not is_inside_tree():
        return

    items_label.text = "Items  %s" % get_items_label()
    ability_label.text = "Ability  %s" % get_ability_label()
    progress_label.text = "Progress  completed %d / visited %d" % [
        get_completed_level_ids().size(),
        get_visited_level_ids().size(),
    ]


func get_summary_text() -> String:
    return "Items %s | Ability %s | Completed %d | Visited %d" % [
        get_items_label(),
        get_ability_label(),
        get_completed_level_ids().size(),
        get_visited_level_ids().size(),
    ]


func normalize_inventory_state(source: Dictionary) -> Dictionary:
    return {
        "items_collected": normalize_string_array(source.get("items_collected", [])),
        "ability_type": String(source.get("ability_type", "")),
        "completed_level_ids": normalize_string_array(source.get("completed_level_ids", [])),
        "visited_level_ids": normalize_string_array(source.get("visited_level_ids", [])),
        "unlocked_door_ids": normalize_string_array(source.get("unlocked_door_ids", [])),
    }


func normalize_string_array(values) -> Array:
    if typeof(values) != TYPE_ARRAY:
        return []

    var normalized := []
    for value in values:
        var text := String(value)
        if text != "":
            normalized.append(text)

    normalized.sort()
    return normalized


func get_items_collected() -> Array:
    return inventory_state.get("items_collected", [])


func get_completed_level_ids() -> Array:
    return inventory_state.get("completed_level_ids", [])


func get_visited_level_ids() -> Array:
    return inventory_state.get("visited_level_ids", [])


func get_items_label() -> String:
    var items_collected := get_items_collected()
    return "none" if items_collected.is_empty() else ", ".join(items_collected)


func get_ability_label() -> String:
    var ability_type := String(inventory_state.get("ability_type", ""))
    return "none" if ability_type == "" else ability_type
