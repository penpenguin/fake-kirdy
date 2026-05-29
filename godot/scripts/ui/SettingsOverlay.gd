extends Control
class_name SettingsOverlay

@onready var volume_label: Label = $VolumeLabel
@onready var controls_label: Label = $ControlsLabel
@onready var difficulty_label: Label = $DifficultyLabel

var settings_state: Dictionary = {}


func _ready() -> void:
    mouse_filter = Control.MOUSE_FILTER_IGNORE
    custom_minimum_size = Vector2(288.0, 88.0)
    set_settings_state(settings_state)


func set_settings_state(next_state: Dictionary) -> void:
    settings_state = normalize_settings_state(next_state)
    if not is_inside_tree():
        return

    volume_label.text = "Volume  %d%%" % int(round(float(settings_state.get("volume", 0.0)) * 100.0))
    controls_label.text = "Controls  %s" % String(settings_state.get("controls", "keyboard"))
    difficulty_label.text = "Difficulty  %s" % String(settings_state.get("difficulty", "normal"))


func get_summary_text() -> String:
    return "Volume %d%% | Controls %s | Difficulty %s" % [
        int(round(float(settings_state.get("volume", 0.0)) * 100.0)),
        String(settings_state.get("controls", "keyboard")),
        String(settings_state.get("difficulty", "normal")),
    ]


func normalize_settings_state(source: Dictionary) -> Dictionary:
    return {
        "volume": clampf(float(source.get("volume", 0.4)), 0.0, 1.0),
        "controls": sanitize_controls(String(source.get("controls", "keyboard"))),
        "difficulty": sanitize_difficulty(String(source.get("difficulty", "normal"))),
    }


func sanitize_controls(controls: String) -> String:
    if ["keyboard", "touch", "controller"].has(controls):
        return controls

    return "keyboard"


func sanitize_difficulty(difficulty: String) -> String:
    if ["easy", "normal", "hard"].has(difficulty):
        return difficulty

    return "normal"
