extends Control
class_name PauseOverlay

@onready var title_label: Label = $TitleLabel
@onready var resume_label: Label = $ResumeLabel
@onready var settings_label: Label = $SettingsLabel
@onready var controls_help_label: Label = $ControlsHelpLabel

var pause_state: Dictionary = {}


func _ready() -> void:
    mouse_filter = Control.MOUSE_FILTER_IGNORE
    custom_minimum_size = Vector2(320.0, 120.0)
    set_pause_state(pause_state)


func set_pause_state(next_state: Dictionary) -> void:
    pause_state = normalize_pause_state(next_state)
    var is_paused := bool(pause_state.get("is_paused", false))
    var settings_open := bool(pause_state.get("settings_open", false))
    visible = is_paused
    if not is_inside_tree():
        return

    title_label.text = "Paused" if is_paused else ""
    resume_label.text = "Press Esc to return to pause" if settings_open else "Press Esc to resume" if is_paused else ""
    settings_label.text = "Settings open" if settings_open else "Press Enter for settings" if is_paused else ""
    controls_help_label.text = get_controls_help_text() if is_paused and not settings_open else ""


func normalize_pause_state(source: Dictionary) -> Dictionary:
    return {
        "is_paused": bool(source.get("is_paused", false)),
        "settings_open": bool(source.get("settings_open", false)),
    }


func get_controls_help_text() -> String:
    return "Move  A/D or arrows  |  Jump  Space  |  Inhale  C  |  Swallow  X  |  Ability  Z  |  Map  M"
