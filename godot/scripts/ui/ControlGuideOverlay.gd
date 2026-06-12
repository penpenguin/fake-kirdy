extends Control
class_name ControlGuideOverlay

@onready var controls_label: Label = $ControlsLabel


func _ready() -> void:
    mouse_filter = Control.MOUSE_FILTER_IGNORE
    controls_label.text = get_controls_text()


func get_controls_text() -> String:
    return "Move: A/D or arrows\nJump: Space\nInhale: C\nSwallow: X\nAbility: Z\nMap: M"
