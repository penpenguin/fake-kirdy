extends Control
class_name ResultsScene

@onready var title_label: Label = $TitleLabel
@onready var outcome_label: Label = $OutcomeLabel
@onready var time_label: Label = $TimeLabel
@onready var score_label: Label = $ScoreLabel
@onready var bonus_label: Label = $BonusLabel

var results_state: Dictionary = {}


func _ready() -> void:
    mouse_filter = Control.MOUSE_FILTER_IGNORE
    custom_minimum_size = Vector2(420.0, 220.0)
    visible = has_results_state(results_state)
    refresh_labels()


func set_results_state(next_state: Dictionary) -> void:
    results_state = normalize_results_state(next_state)
    visible = has_results_state(results_state)
    if not is_inside_tree():
        return

    refresh_labels()


func refresh_labels() -> void:
    if not is_inside_tree():
        return

    title_label.text = "Results"
    outcome_label.text = "Outcome  %s" % String(results_state.get("outcome", ""))
    time_label.text = "Time  %s" % format_time_ms(int(results_state.get("time_ms", 0)))
    score_label.text = "Score  %d" % int(results_state.get("score", 0))
    bonus_label.text = "Life Bonus  %d" % int(results_state.get("remaining_life_bonus", 0))


func get_summary_text() -> String:
    return "%s | %s | %s | Score %d | Life Bonus %d" % [
        String(results_state.get("level_id", "")),
        String(results_state.get("outcome", "")),
        format_time_ms(int(results_state.get("time_ms", 0))),
        int(results_state.get("score", 0)),
        int(results_state.get("remaining_life_bonus", 0)),
    ]


func normalize_results_state(source: Dictionary) -> Dictionary:
    return {
        "level_id": String(source.get("level_id", "")),
        "outcome": String(source.get("outcome", "")),
        "time_ms": max(int(source.get("time_ms", 0)), 0),
        "frames": max(int(source.get("frames", 0)), 0),
        "score": max(int(source.get("score", 0)), 0),
        "remaining_life_bonus": max(int(source.get("remaining_life_bonus", 0)), 0),
    }


func has_results_state(state: Dictionary) -> bool:
    return ["completed", "complete", "game_over"].has(String(state.get("outcome", "")))


func format_time_ms(time_ms: int) -> String:
    var seconds := int(time_ms / 1000)
    var milliseconds := time_ms % 1000
    return "%d.%03ds" % [seconds, milliseconds]
