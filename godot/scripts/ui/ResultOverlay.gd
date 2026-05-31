extends Control
class_name ResultOverlay

@onready var title_label: Label = $TitleLabel
@onready var outcome_label: Label = $OutcomeLabel
@onready var time_label: Label = $TimeLabel
@onready var score_label: Label = $ScoreLabel
@onready var bonus_label: Label = $BonusLabel
@onready var items_label: Label = $ItemsLabel
@onready var restart_label: Label = $RestartLabel

@export var polish_transition_ms: int = 180
@export var score_countup_ms: int = 420

var result_state: Dictionary = {}
var displayed_score: int = 0
var polish_tween: Tween = null
var score_tween: Tween = null


func _ready() -> void:
    mouse_filter = Control.MOUSE_FILTER_IGNORE
    custom_minimum_size = Vector2(360.0, 268.0)
    visible = has_finished_result(result_state)
    modulate.a = 1.0 if visible else 0.0
    displayed_score = int(result_state.get("score", 0))
    refresh_labels()


func set_result_state(next_state: Dictionary) -> void:
    result_state = normalize_result_state(next_state)
    visible = has_finished_result(result_state)
    if not visible:
        displayed_score = 0
    if not is_inside_tree():
        displayed_score = int(result_state.get("score", 0))
        return

    animate_result_polish(visible)
    animate_score_countup()
    refresh_labels()


func refresh_labels() -> void:
    if not is_inside_tree():
        return

    var normalized_outcome := String(result_state.get("outcome", ""))
    title_label.text = "Run Complete" if normalized_outcome == "completed" or normalized_outcome == "complete" else "Run Ended"
    outcome_label.text = "Outcome  %s" % normalized_outcome
    time_label.text = "Time  %s" % format_time_ms(int(result_state.get("time_ms", 0)))
    score_label.text = "Score  %d" % displayed_score
    bonus_label.text = "Life Bonus  %d" % int(result_state.get("remaining_life_bonus", 0))
    items_label.text = "Items  %d" % get_items_collected().size()
    restart_label.text = "Press R to restart" if bool(result_state.get("restart_available", false)) else ""


func get_summary_text() -> String:
    return "%s | %s | %s | Score %d | Life Bonus %d | Items %d" % [
        String(result_state.get("level_id", "")),
        String(result_state.get("outcome", "")),
        format_time_ms(int(result_state.get("time_ms", 0))),
        int(result_state.get("score", 0)),
        int(result_state.get("remaining_life_bonus", 0)),
        get_items_collected().size(),
    ]


func normalize_result_state(source: Dictionary) -> Dictionary:
    return {
        "level_id": String(source.get("level_id", "")),
        "outcome": String(source.get("outcome", "")),
        "time_ms": max(int(source.get("time_ms", 0)), 0),
        "frames": max(int(source.get("frames", 0)), 0),
        "items_collected": normalize_items(source.get("items_collected", [])),
        "completed_level_ids": normalize_items(source.get("completed_level_ids", [])),
        "score": max(int(source.get("score", 0)), 0),
        "remaining_life_bonus": max(int(source.get("remaining_life_bonus", 0)), 0),
        "restart_available": bool(source.get("restart_available", false)),
    }


func has_finished_result(state: Dictionary) -> bool:
    return ["completed", "complete", "game_over"].has(String(state.get("outcome", "")))


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
    return result_state.get("items_collected", [])


func format_time_ms(time_ms: int) -> String:
    var seconds := int(time_ms / 1000)
    var milliseconds := time_ms % 1000
    return "%d.%03ds" % [seconds, milliseconds]


func animate_result_polish(is_visible: bool) -> void:
    if not is_inside_tree():
        return

    if polish_tween != null and polish_tween.is_valid():
        polish_tween.kill()

    if is_visible:
        modulate.a = 0.0

    var target_alpha := 1.0 if is_visible else 0.0
    var transition_seconds: float = max(float(polish_transition_ms), 0.0) / 1000.0
    polish_tween = create_tween()
    polish_tween.tween_property(self, "modulate:a", target_alpha, transition_seconds)


func animate_score_countup() -> void:
    var target_score := int(result_state.get("score", 0))
    if not visible or not is_inside_tree() or score_countup_ms <= 0:
        set_displayed_score(target_score)
        return

    if score_tween != null and score_tween.is_valid():
        score_tween.kill()

    displayed_score = 0
    score_tween = create_tween()
    score_tween.tween_method(Callable(self, "set_displayed_score"), 0, target_score, float(score_countup_ms) / 1000.0)


func set_displayed_score(next_score) -> void:
    displayed_score = max(int(round(float(next_score))), 0)
    refresh_labels()
