extends Control
class_name VirtualControlsOverlay

const BUTTON_NORMAL_MODULATE := Color(1.0, 1.0, 1.0, 0.72)
const BUTTON_PRESSED_MODULATE := Color(0.72, 1.0, 0.92, 0.96)
const ACTION_BINDINGS := {
    "DpadLeftButton": &"move_left",
    "DpadRightButton": &"move_right",
    "DpadUpButton": &"jump",
    "ActionZButton": &"use_ability",
    "ActionXButton": &"swallow",
    "ActionCButton": &"inhale",
}

var pressed_actions: Dictionary = {}


func _ready() -> void:
    mouse_filter = Control.MOUSE_FILTER_IGNORE
    for button_name in ACTION_BINDINGS.keys():
        var button := get_node_or_null(String(button_name))
        if button == null or not button is BaseButton:
            continue

        button.focus_mode = Control.FOCUS_NONE
        button.mouse_filter = Control.MOUSE_FILTER_STOP
        button.modulate = BUTTON_NORMAL_MODULATE
        button.button_down.connect(handle_button_pressed.bind(String(button_name)))
        button.button_up.connect(handle_button_released.bind(String(button_name)))

    set_virtual_controls_state({
        "visible": visible,
    })


func set_virtual_controls_state(next_state: Dictionary) -> void:
    visible = bool(next_state.get("visible", false))
    if not visible:
        release_all_actions()


func handle_button_pressed(button_name: String) -> void:
    var action: StringName = ACTION_BINDINGS.get(button_name, &"")
    if action == &"":
        return

    pressed_actions[action] = button_name
    Input.action_press(action)
    set_button_pressed(button_name, true)


func handle_button_released(button_name: String) -> void:
    var action: StringName = ACTION_BINDINGS.get(button_name, &"")
    if action == &"":
        return

    pressed_actions.erase(action)
    Input.action_release(action)
    set_button_pressed(button_name, false)


func release_all_actions() -> void:
    for action in pressed_actions.keys():
        Input.action_release(action)
        set_button_pressed(String(pressed_actions[action]), false)

    pressed_actions.clear()


func set_button_pressed(button_name: String, is_pressed: bool) -> void:
    var button := get_node_or_null(button_name)
    if button == null or not button is CanvasItem:
        return

    button.modulate = BUTTON_PRESSED_MODULATE if is_pressed else BUTTON_NORMAL_MODULATE


func _exit_tree() -> void:
    release_all_actions()
