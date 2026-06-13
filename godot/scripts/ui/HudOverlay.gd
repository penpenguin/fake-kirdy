extends Control
class_name HudOverlay

const HUD_SEMANTIC_LABELS := ["HEALTH", "ABILITY", "ITEMS", "SCORE", "OBJECTIVE", "ATTACK", "STATUS"]

@onready var panel: Panel = $Panel
@onready var top_bar_row: HBoxContainer = $Panel/TopBarRow
@onready var area_caption: Label = $Panel/TopBarRow/AreaChip/AreaCaption
@onready var level_label: Label = $Panel/TopBarRow/AreaChip/LevelLabel
@onready var health_caption: Label = $Panel/TopBarRow/HealthCluster/HealthCaption
@onready var hp_icon: ColorRect = $Panel/TopBarRow/HealthCluster/HpIcon
@onready var hp_bar: ProgressBar = $Panel/TopBarRow/HealthCluster/HpBar
@onready var hp_label: Label = $Panel/TopBarRow/HealthCluster/HpLabel
@onready var ability_chip: Panel = $Panel/TopBarRow/AbilityChip
@onready var ability_icon: ColorRect = $Panel/TopBarRow/AbilityChip/AbilityIcon
@onready var ability_caption: Label = $Panel/TopBarRow/AbilityChip/AbilityCaption
@onready var ability_label: Label = $Panel/TopBarRow/AbilityChip/AbilityLabel
@onready var items_chip: Panel = $Panel/TopBarRow/ItemsChip
@onready var items_icon: ColorRect = $Panel/TopBarRow/ItemsChip/ItemsIcon
@onready var items_caption: Label = $Panel/TopBarRow/ItemsChip/ItemsCaption
@onready var items_label: Label = $Panel/TopBarRow/ItemsChip/ItemsLabel
@onready var score_chip: Panel = $Panel/TopBarRow/ScoreChip
@onready var score_icon: ColorRect = $Panel/TopBarRow/ScoreChip/ScoreIcon
@onready var score_caption: Label = $Panel/TopBarRow/ScoreChip/ScoreCaption
@onready var score_label: Label = $Panel/TopBarRow/ScoreChip/ScoreLabel
@onready var objective_caption: Label = $Panel/TopBarRow/ObjectiveChip/ObjectiveCaption
@onready var objective_label: Label = $Panel/TopBarRow/ObjectiveChip/ObjectiveLabel
@onready var attack_caption: Label = $Panel/TopBarRow/AttackChip/AttackCaption
@onready var cooldown_label: Label = $Panel/TopBarRow/AttackChip/CooldownLabel
@onready var outcome_badge: Panel = $Panel/TopBarRow/OutcomeBadge
@onready var status_icon: ColorRect = $Panel/TopBarRow/OutcomeBadge/StatusIcon
@onready var outcome_label: Label = $Panel/TopBarRow/OutcomeBadge/OutcomeLabel
@onready var status_caption: Label = $Panel/TopBarRow/StatusChip/StatusCaption
@onready var status_label: Label = $Panel/TopBarRow/StatusChip/StatusLabel

var hud_state: Dictionary = {}


func _ready() -> void:
    mouse_filter = Control.MOUSE_FILTER_IGNORE
    layout_top_bar()
    apply_hud_theme()
    set_hud_state(hud_state)


func layout_top_bar() -> void:
    anchor_left = 0.0
    anchor_top = 0.0
    anchor_right = 1.0
    anchor_bottom = 0.0
    offset_left = 0.0
    offset_top = 0.0
    offset_right = 0.0
    offset_bottom = 64.0
    custom_minimum_size = Vector2(960.0, 64.0)


func set_hud_state(next_state: Dictionary) -> void:
    hud_state = normalize_hud_state(next_state)
    if not is_inside_tree():
        return

    set_caption_value(area_caption, level_label, "AREA", format_level_value(String(hud_state.get("level_id", ""))))
    hp_bar.max_value = max(int(hud_state.get("max_hp", 0)), 1)
    hp_bar.value = clampi(int(hud_state.get("hp", 0)), 0, int(hp_bar.max_value))
    set_caption_value(health_caption, hp_label, "HEALTH", "%d/%d" % [int(hud_state.get("hp", 0)), int(hud_state.get("max_hp", 0))])
    set_caption_value(ability_caption, ability_label, "ABILITY", get_ability_label().to_upper())
    set_caption_value(items_caption, items_label, "ITEMS", format_item_progress())
    set_caption_value(score_caption, score_label, "SCORE", "%d" % int(hud_state.get("score", 0)))
    outcome_label.text = get_readable_outcome_label().to_upper()
    set_caption_value(objective_caption, objective_label, "OBJECTIVE", String(hud_state.get("objective_text", "Reach the goal")))
    set_caption_value(attack_caption, cooldown_label, "ATTACK", get_cooldown_label())
    set_caption_value(status_caption, status_label, "STATUS", get_status_label())
    apply_hud_theme()


func set_caption_value(caption_label: Label, value_label: Label, caption_text: String, value_text: String) -> void:
    if caption_label != null:
        caption_label.text = caption_text
    if value_label != null:
        value_label.text = value_text


func apply_hud_theme() -> void:
    if outcome_badge != null:
        outcome_badge.modulate = get_outcome_badge_color()
    if ability_chip != null:
        ability_chip.modulate = Color(0.94, 1.0, 1.0, 1.0) if get_ability_label() == "none" else Color(1.0, 0.93, 0.74, 1.0)
    if hp_icon != null:
        hp_icon.color = Color(0.95, 0.18, 0.28, 1.0)
    if ability_icon != null:
        ability_icon.color = Color(0.2, 0.62, 1.0, 1.0) if get_ability_label() == "none" else Color(1.0, 0.76, 0.18, 1.0)
    if items_icon != null:
        items_icon.color = Color(0.5, 0.95, 0.62, 1.0)
    if score_icon != null:
        score_icon.color = Color(1.0, 0.86, 0.25, 1.0)
    if status_icon != null:
        status_icon.color = get_outcome_badge_color()


func get_summary_text() -> String:
    return "%s | HP %d/%d | Ability %s | Items %s | Score %d | %s | %s" % [
        String(hud_state.get("level_id", "")),
        int(hud_state.get("hp", 0)),
        int(hud_state.get("max_hp", 0)),
        get_ability_label(),
        format_item_progress(),
        int(hud_state.get("score", 0)),
        get_readable_outcome_label(),
        String(hud_state.get("objective_text", "Reach the goal")),
    ]


func get_hud_semantic_labels() -> Array:
    return HUD_SEMANTIC_LABELS.duplicate()


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


func format_item_progress() -> String:
    var items: Array = get_items_collected()
    if items.is_empty():
        return "0"

    return "%d collected" % items.size()


func format_level_value(level_id: String) -> String:
    var readable := level_id.replace("_", " ").strip_edges()
    if readable == "":
        return "unknown"

    return readable


func get_hp_ratio() -> float:
    var max_hp: int = maxi(int(hud_state.get("max_hp", 0)), 1)
    return clampf(float(int(hud_state.get("hp", 0))) / float(max_hp), 0.0, 1.0)


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
        return "LOCKED  %s" % locked_reason

    var target_hp := int(hud_state.get("target_enemy_hp", 0))
    if target_hp > 0:
        return "ENEMY HP  %d" % target_hp

    return "CLEAR"


func get_outcome_badge_color() -> Color:
    var current_outcome := String(hud_state.get("outcome", "running"))
    if current_outcome == "completed":
        return Color(0.72, 1.0, 0.68, 1.0)
    if current_outcome == "game_over":
        return Color(1.0, 0.58, 0.58, 1.0)
    if current_outcome == "error":
        return Color(1.0, 0.75, 0.48, 1.0)

    return Color(0.76, 0.9, 1.0, 1.0)


func get_readable_outcome_label() -> String:
    var current_outcome := String(hud_state.get("outcome", "running"))
    if current_outcome == "completed":
        return "goal reached"
    if current_outcome == "game_over":
        return "game over"
    if current_outcome == "error":
        return "error"

    return "running"
