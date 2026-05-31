extends PauseOverlay
class_name PauseScene

@export var blur_managed_by_parent: bool = true
@export var canvas_fallback_blur_enabled: bool = true
@export var paused_fallback_color: Color = Color(0.03, 0.04, 0.08, 0.46)
@export var settings_fallback_color: Color = Color(0.02, 0.03, 0.07, 0.58)
@export var polish_transition_ms: int = 140

@onready var blur_fallback: ColorRect = $BlurFallback

var blur_active: bool = false
var polish_tween: Tween = null


func _ready() -> void:
    super._ready()
    modulate.a = 1.0 if visible else 0.0
    set_blur_active(bool(pause_state.get("blur_active", pause_state.get("is_paused", false))), bool(pause_state.get("settings_open", false)))


func set_pause_state(next_state: Dictionary) -> void:
    super.set_pause_state(next_state)
    var is_paused := bool(pause_state.get("is_paused", false))
    var settings_open := bool(pause_state.get("settings_open", false))
    var requested_blur := bool(pause_state.get("blur_active", is_paused))
    set_blur_active(is_paused and requested_blur, settings_open)
    animate_menu_polish(is_paused)


func set_blur_active(next_blur_active: bool, settings_open: bool = false) -> void:
    blur_active = next_blur_active and canvas_fallback_blur_enabled
    if not is_inside_tree():
        return

    blur_fallback.visible = blur_active
    blur_fallback.mouse_filter = Control.MOUSE_FILTER_IGNORE
    blur_fallback.color = settings_fallback_color if settings_open else paused_fallback_color


func animate_menu_polish(is_visible: bool) -> void:
    if not is_inside_tree():
        return

    if polish_tween != null and polish_tween.is_valid():
        polish_tween.kill()

    var target_alpha := 1.0 if is_visible else 0.0
    var transition_seconds: float = max(float(polish_transition_ms), 0.0) / 1000.0
    polish_tween = create_tween()
    polish_tween.tween_property(self, "modulate:a", target_alpha, transition_seconds)
