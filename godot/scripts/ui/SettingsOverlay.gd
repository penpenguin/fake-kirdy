extends Control
class_name SettingsOverlay

@onready var volume_label: Label = $VolumeLabel
@onready var controls_label: Label = $ControlsLabel
@onready var difficulty_label: Label = $DifficultyLabel
@onready var post_process_blur: ColorRect = $PostProcessBlur
@onready var blur_fallback: ColorRect = $BlurFallback

@export var post_processing_blur_enabled: bool = true
@export var canvas_fallback_blur_enabled: bool = true
@export var polish_transition_ms: int = 140
@export var focus_pulse_scale: float = 1.03

var settings_state: Dictionary = {}
var selected_setting_index: int = 0
var blur_active: bool = false
var focus_prefix: String = "> "
var unfocused_prefix: String = "  "
var polish_tween: Tween = null
var focus_tween: Tween = null


func _ready() -> void:
    mouse_filter = Control.MOUSE_FILTER_IGNORE
    custom_minimum_size = Vector2(288.0, 88.0)
    modulate.a = 1.0 if visible else 0.0
    set_settings_state(settings_state)


func set_menu_visible(is_visible: bool) -> void:
    visible = is_visible
    set_blur_active(is_visible and bool(settings_state.get("blur_active", false)))
    animate_menu_polish(is_visible)


func set_settings_state(next_state: Dictionary) -> void:
    settings_state = normalize_settings_state(next_state)
    set_focus_index(int(settings_state.get("selected_setting_index", selected_setting_index)))
    set_blur_active(bool(settings_state.get("menu_open", visible)) and bool(settings_state.get("blur_active", false)))
    if not is_inside_tree():
        return

    refresh_labels()
    animate_focus_polish()


func set_focus_index(next_index: int) -> void:
    selected_setting_index = wrapi(next_index, 0, 3)
    if not is_inside_tree():
        return

    refresh_labels()
    animate_focus_polish()


func set_blur_active(next_blur_active: bool) -> void:
    blur_active = next_blur_active
    if not is_inside_tree():
        return

    post_process_blur.visible = blur_active and post_processing_blur_enabled
    post_process_blur.mouse_filter = Control.MOUSE_FILTER_IGNORE
    blur_fallback.visible = blur_active and canvas_fallback_blur_enabled
    blur_fallback.mouse_filter = Control.MOUSE_FILTER_IGNORE


func refresh_labels() -> void:
    volume_label.text = "%sVolume  %d%%" % [get_focus_prefix(0), int(round(float(settings_state.get("volume", 0.0)) * 100.0))]
    controls_label.text = "%sControls  %s" % [get_focus_prefix(1), String(settings_state.get("controls", "keyboard"))]
    difficulty_label.text = "%sDifficulty  %s" % [get_focus_prefix(2), String(settings_state.get("difficulty", "normal"))]


func get_focus_prefix(index: int) -> String:
    if bool(settings_state.get("menu_open", false)) and selected_setting_index == index:
        return focus_prefix

    return unfocused_prefix


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
        "menu_open": bool(source.get("menu_open", false)),
        "selected_setting_index": wrapi(int(source.get("selected_setting_index", 0)), 0, 3),
        "focus_target": String(source.get("focus_target", "volume")),
        "blur_active": bool(source.get("blur_active", false)),
    }


func sanitize_controls(controls: String) -> String:
    if ["keyboard", "touch", "controller"].has(controls):
        return controls

    return "keyboard"


func sanitize_difficulty(difficulty: String) -> String:
    if ["easy", "normal", "hard"].has(difficulty):
        return difficulty

    return "normal"


func animate_menu_polish(is_visible: bool) -> void:
    if not is_inside_tree():
        return

    if polish_tween != null and polish_tween.is_valid():
        polish_tween.kill()

    var target_alpha := 1.0 if is_visible else 0.0
    var transition_seconds: float = max(float(polish_transition_ms), 0.0) / 1000.0
    polish_tween = create_tween()
    polish_tween.tween_property(self, "modulate:a", target_alpha, transition_seconds)


func animate_focus_polish() -> void:
    if not is_inside_tree() or not bool(settings_state.get("menu_open", false)):
        return

    if focus_tween != null and focus_tween.is_valid():
        focus_tween.kill()

    scale = Vector2.ONE
    var half_transition_seconds: float = max(float(polish_transition_ms), 0.0) / 2000.0
    focus_tween = create_tween()
    focus_tween.tween_property(self, "scale", Vector2.ONE * focus_pulse_scale, half_transition_seconds)
    focus_tween.tween_property(self, "scale", Vector2.ONE, half_transition_seconds)
