extends Control
class_name HudOverlay

@onready var level_label: Label = $LevelLabel
@onready var hp_label: Label = $HpLabel
@onready var ability_label: Label = $AbilityLabel
@onready var items_label: Label = $ItemsLabel
@onready var score_label: Label = $ScoreLabel
@onready var outcome_label: Label = $OutcomeLabel
@onready var objective_label: Label = $ObjectiveLabel
@onready var cooldown_label: Label = $CooldownLabel
@onready var status_label: Label = $StatusLabel

var hud_state: Dictionary = {}


func _ready() -> void:
    mouse_filter = Control.MOUSE_FILTER_IGNORE
    custom_minimum_size = Vector2(360.0, 188.0)
    set_hud_state(hud_state)


func set_hud_state(next_state: Dictionary) -> void:
    hud_state = normalize_hud_state(next_state)
    if not is_inside_tree():
        return

    level_label.text = "Level  %s" % String(hud_state.get("level_id", ""))
    hp_label.text = "HP  %d / %d" % [int(hud_state.get("hp", 0)), int(hud_state.get("max_hp", 0))]
    ability_label.text = "Ability  %s" % get_ability_label()
    items_label.text = "Items  %d" % get_items_collected().size()
    score_label.text = "Score  %d" % int(hud_state.get("score", 0))
    outcome_label.text = "Run  %s" % get_readable_outcome_label()
    objective_label.text = "Objective  %s" % String(hud_state.get("objective_text", "Reach the goal"))
    cooldown_label.text = "Z Cooldown  %s" % get_cooldown_label()
    status_label.text = "Status  %s" % get_status_label()


func get_summary_text() -> String:
    return "%s | HP %d/%d | Ability %s | Items %d | Score %d | %s | %s" % [
        String(hud_state.get("level_id", "")),
        int(hud_state.get("hp", 0)),
        int(hud_state.get("max_hp", 0)),
        get_ability_label(),
        get_items_collected().size(),
        int(hud_state.get("score", 0)),
        get_readable_outcome_label(),
        String(hud_state.get("objective_text", "Reach the goal")),
    ]


func normalize_hud_state(source: Dictionary) -> Dictionary:
    return {
        "level_id": String(source.get("level_id", "")),
        "hp": max(int(source.get("hp", 0)), 0),
        "max_hp": max(int(source.get("max_hp", 0)), 0),
        "revive_count": max(int(source.get("revive_count", 0)), 0),
        "ability_type": String(source.get("ability_type", "")),
        "items_collected": normalize_items(source.get("items_collected", [])),
        "score": max(int(source.get("score", 0)), 0),
        "remaining_life_bonus": max(int(source.get("remaining_life_bonus", 0)), 0),
        "objective_text": String(source.get("objective_text", "Reach the goal")),
        "ability_cooldown_ms": max(int(source.get("ability_cooldown_ms", 0)), 0),
        "locked_door_reason": String(source.get("locked_door_reason", "")),
        "target_enemy_hp": max(int(source.get("target_enemy_hp", 0)), 0),
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


func get_cooldown_label() -> String:
    var cooldown_ms := int(hud_state.get("ability_cooldown_ms", 0))
    if cooldown_ms <= 0:
        return "ready"

    return "%d ms" % cooldown_ms


func get_status_label() -> String:
    var locked_reason := String(hud_state.get("locked_door_reason", ""))
    if locked_reason != "":
        return locked_reason

    var target_hp := int(hud_state.get("target_enemy_hp", 0))
    if target_hp > 0:
        return "enemy HP %d" % target_hp

    return "clear"


func get_readable_outcome_label() -> String:
    var current_outcome := String(hud_state.get("outcome", "running"))
    if current_outcome == "completed":
        return "goal reached"
    if current_outcome == "game_over":
        return "game over"
    if current_outcome == "error":
        return "error"

    return "running"
