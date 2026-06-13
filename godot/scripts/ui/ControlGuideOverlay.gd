extends Control
class_name ControlGuideOverlay

@export var presentation_mode: String = "initial_popup"
@export var dismiss_event_type: String = "guide.dismissed"

@onready var popup_panel: Panel = $PopupPanel
@onready var title_label: Label = $PopupPanel/TitleLabel
@onready var controls_label: Label = $PopupPanel/ControlsLabel
@onready var dismiss_label: Label = $PopupPanel/DismissLabel

var guide_state: Dictionary = {}
var dismissed: bool = false


func _ready() -> void:
    mouse_filter = Control.MOUSE_FILTER_IGNORE
    set_guide_state({
        "visible": true,
        "dismissed": dismissed,
        "presentation_mode": presentation_mode,
    })


func set_guide_state(next_state: Dictionary) -> void:
    guide_state = normalize_guide_state(next_state)
    dismissed = bool(guide_state.get("dismissed", dismissed))
    presentation_mode = String(guide_state.get("presentation_mode", presentation_mode))
    visible = bool(guide_state.get("visible", true)) and not dismissed
    if not is_inside_tree():
        return

    popup_panel.visible = visible
    title_label.text = "Controls"
    controls_label.text = get_controls_text()
    dismiss_label.text = "Press Space to close"


func dismiss(reason: String = "guide.dismissed") -> Dictionary:
    dismissed = true
    visible = false
    if is_inside_tree():
        popup_panel.visible = false

    return {
        "event_type": dismiss_event_type,
        "reason": reason,
        "presentation_mode": presentation_mode,
        "dismissed": dismissed,
    }


func normalize_guide_state(source: Dictionary) -> Dictionary:
    return {
        "visible": bool(source.get("visible", true)),
        "dismissed": bool(source.get("dismissed", false)),
        "presentation_mode": String(source.get("presentation_mode", presentation_mode)),
    }


func get_controls_text() -> String:
    return "Move  A/D or arrows\nJump  Space\nInhale  C\nSwallow  X\nSpark Burst  Z\nMap  M\nPause  Esc"
