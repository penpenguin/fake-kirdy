extends Control
class_name HudOverlay

@onready var level_label: Label = $LevelLabel
@onready var hp_label: Label = $HpLabel
@onready var ability_label: Label = $AbilityLabel
@onready var items_label: Label = $ItemsLabel
@onready var outcome_label: Label = $OutcomeLabel

var hud_state: Dictionary = {}


func _ready() -> void:
    mouse_filter = Control.MOUSE_FILTER_IGNORE
    custom_minimum_size = Vector2(288.0, 112.0)
    set_hud_state(hud_state)


func set_hud_state(next_state: Dictionary) -> void:
    hud_state = normalize_hud_state(next_state)
    if not is_inside_tree():
        return

    level_label.text = "Level  %s" % String(hud_state.get("level_id", ""))
    hp_label.text = "HP  %d / %d" % [int(hud_state.get("hp", 0)), int(hud_state.get("max_hp", 0))]
    ability_label.text = "Ability  %s" % get_ability_label()
    items_label.text = "Items  %d" % get_items_collected().size()
    outcome_label.text = "Run  %s" % String(hud_state.get("outcome", "running"))


func get_summary_text() -> String:
    return "%s | HP %d/%d | Ability %s | Items %d | %s" % [
        String(hud_state.get("level_id", "")),
        int(hud_state.get("hp", 0)),
        int(hud_state.get("max_hp", 0)),
        get_ability_label(),
        get_items_collected().size(),
        String(hud_state.get("outcome", "running")),
    ]


func normalize_hud_state(source: Dictionary) -> Dictionary:
    return {
        "level_id": String(source.get("level_id", "")),
        "hp": max(int(source.get("hp", 0)), 0),
        "max_hp": max(int(source.get("max_hp", 0)), 0),
        "revive_count": max(int(source.get("revive_count", 0)), 0),
        "ability_type": String(source.get("ability_type", "")),
        "items_collected": normalize_items(source.get("items_collected", [])),
        "outcome": String(source.get("outcome", "running")),
    }


func normalize_items(items) -> Array:
    if typeof(items) != TYPE_ARRAY:
        return []

    var normalized := []
    for item in items:
        var item_id := String(item)
        if item_id != "":
            normalized.append(item_id)

    normalized.sort()
    return normalized


func get_items_collected() -> Array:
    return hud_state.get("items_collected", [])


func get_ability_label() -> String:
    var ability_type := String(hud_state.get("ability_type", ""))
    return "none" if ability_type == "" else ability_type
