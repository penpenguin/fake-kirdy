extends Control
class_name ResultOverlay

@onready var title_label: Label = $TitleLabel
@onready var outcome_label: Label = $OutcomeLabel
@onready var time_label: Label = $TimeLabel
@onready var items_label: Label = $ItemsLabel

var result_state: Dictionary = {}


func _ready() -> void:
    mouse_filter = Control.MOUSE_FILTER_IGNORE
    custom_minimum_size = Vector2(360.0, 180.0)
    visible = false
    set_result_state(result_state)


func set_result_state(next_state: Dictionary) -> void:
    result_state = normalize_result_state(next_state)
    visible = true
    if not is_inside_tree():
        return

    var normalized_outcome := String(result_state.get("outcome", ""))
    title_label.text = "Run Complete" if normalized_outcome == "completed" or normalized_outcome == "complete" else "Run Ended"
    outcome_label.text = "Outcome  %s" % normalized_outcome
    time_label.text = "Time  %s" % format_time_ms(int(result_state.get("time_ms", 0)))
    items_label.text = "Items  %d" % get_items_collected().size()


func get_summary_text() -> String:
    return "%s | %s | %s | Items %d" % [
        String(result_state.get("level_id", "")),
        String(result_state.get("outcome", "")),
        format_time_ms(int(result_state.get("time_ms", 0))),
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
    return result_state.get("items_collected", [])


func format_time_ms(time_ms: int) -> String:
    var seconds := int(time_ms / 1000)
    var milliseconds := time_ms % 1000
    return "%d.%03ds" % [seconds, milliseconds]
