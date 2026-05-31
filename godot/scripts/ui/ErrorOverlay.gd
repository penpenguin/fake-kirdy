extends Control
class_name ErrorOverlay

@onready var title_label: Label = $TitleLabel
@onready var message_label: Label = $MessageLabel
@onready var retry_label: Label = $RetryLabel

var error_state: Dictionary = {}


func _ready() -> void:
    mouse_filter = Control.MOUSE_FILTER_IGNORE
    custom_minimum_size = Vector2(420.0, 148.0)
    visible = has_runtime_error(error_state)
    refresh_labels()


func set_error_state(next_state: Dictionary) -> void:
    error_state = normalize_error_state(next_state)
    visible = has_runtime_error(error_state)
    if not is_inside_tree():
        return

    refresh_labels()


func refresh_labels() -> void:
    if not is_inside_tree():
        return

    title_label.text = "Runtime Error"
    message_label.text = String(error_state.get("message", ""))
    retry_label.text = "Press R to retry" if bool(error_state.get("retry_available", false)) else ""


func get_summary_text() -> String:
    return "%s | %s | %s" % [
        String(error_state.get("outcome", "")),
        String(error_state.get("reason", "")),
        String(error_state.get("message", "")),
    ]


func normalize_error_state(source: Dictionary) -> Dictionary:
    var message := String(source.get("message", ""))
    return {
        "runtime_error": bool(source.get("runtime_error", message != "")),
        "level_id": String(source.get("level_id", "")),
        "requested_level_id": String(source.get("requested_level_id", "")),
        "requested_spawn_id": String(source.get("requested_spawn_id", "default")),
        "outcome": String(source.get("outcome", "error")),
        "reason": String(source.get("reason", "")),
        "message": message,
        "retry_available": bool(source.get("retry_available", false)),
        "retry_action": String(source.get("retry_action", "result_restart")),
    }


func has_runtime_error(state: Dictionary) -> bool:
    return bool(state.get("runtime_error", false)) and String(state.get("message", "")) != ""
