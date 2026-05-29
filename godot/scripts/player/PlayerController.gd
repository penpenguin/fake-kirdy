extends CharacterBody2D
class_name PlayerController

const PlayerTuningScript = preload("res://scripts/player/PlayerTuning.gd")

signal trace_event(event_type: String, payload: Dictionary)

@export var tuning: Resource = PlayerTuningScript.new()
@export var move_left_action: StringName = &"move_left"
@export var move_right_action: StringName = &"move_right"
@export var jump_action: StringName = &"jump"
@export var inhale_action: StringName = &"inhale"
@export var swallow_action: StringName = &"swallow"
@export var use_ability_action: StringName = &"use_ability"
@export var level_id: String = "controller_lab"
@export var kirdy_idle_texture: Texture2D
@export var kirdy_run_texture: Texture2D
@export var kirdy_jump_texture: Texture2D
@export var kirdy_hover_texture: Texture2D
@export var kirdy_inhale_texture: Texture2D
@export var kirdy_swallow_texture: Texture2D
@export var kirdy_spit_texture: Texture2D
@export var kirdy_fire_texture: Texture2D
@export var kirdy_ice_texture: Texture2D
@export var kirdy_sword_texture: Texture2D

var ability_type: String = ""
var coyote_time: float = 0.0
var jump_buffer: float = 0.0
var was_on_floor: bool = false
var is_hovering: bool = false
var has_jump_cut: bool = false
var input_source: Node = null
var last_facing: float = 1.0

@onready var body_sprite: Sprite2D = $Body


func _ready() -> void:
    update_visual_state(0.0, false)
    emit_trace("player.spawned")


func _physics_process(delta: float) -> void:
    var input_x := get_input_axis(move_left_action, move_right_action)
    var jump_pressed := is_input_action_just_pressed(jump_action)
    var jump_held := is_input_action_pressed(jump_action)
    var jump_released := is_input_action_just_released(jump_action)
    var on_floor_before_move := is_on_floor()

    update_coyote_time(on_floor_before_move, delta)
    update_jump_buffer(jump_pressed, delta)
    apply_horizontal_movement(input_x, delta)
    apply_jump()
    apply_jump_cut(jump_released)
    apply_gravity(jump_held, delta)

    move_and_slide()
    update_landing_trace()
    update_visual_state(input_x, jump_held)


func apply_horizontal_movement(input_x: float, delta: float) -> void:
    var target_speed: float = input_x * tuning.max_speed
    var accel: float = tuning.air_accel

    if is_on_floor():
        accel = tuning.ground_decel if input_x == 0.0 else tuning.ground_accel
    elif input_x == 0.0:
        accel = tuning.air_decel

    velocity.x = move_toward(velocity.x, target_speed, accel * delta)


func get_input_axis(left_action: StringName, right_action: StringName) -> float:
    if input_source != null and input_source.has_method("get_axis"):
        return input_source.get_axis(left_action, right_action)

    return Input.get_axis(left_action, right_action)


func is_input_action_pressed(action: StringName) -> bool:
    if input_source != null and input_source.has_method("is_action_pressed"):
        return input_source.is_action_pressed(action)

    return Input.is_action_pressed(action)


func is_input_action_just_pressed(action: StringName) -> bool:
    if input_source != null and input_source.has_method("is_action_just_pressed"):
        return input_source.is_action_just_pressed(action)

    return Input.is_action_just_pressed(action)


func is_input_action_just_released(action: StringName) -> bool:
    if input_source != null and input_source.has_method("is_action_just_released"):
        return input_source.is_action_just_released(action)

    return Input.is_action_just_released(action)


func is_inhale_pressed() -> bool:
    return is_input_action_pressed(inhale_action)


func is_swallow_pressed() -> bool:
    return is_input_action_just_pressed(swallow_action)


func is_use_ability_pressed() -> bool:
    return is_input_action_just_pressed(use_ability_action)


func set_ability_type(next_ability_type: String) -> void:
    ability_type = next_ability_type
    update_visual_state(0.0, false)


func clear_ability_type() -> void:
    ability_type = ""
    update_visual_state(0.0, false)


func update_visual_state(input_x: float, jump_held: bool) -> void:
    if body_sprite == null:
        return

    if input_x != 0.0:
        last_facing = sign(input_x)
        body_sprite.flip_h = last_facing < 0.0

    var next_texture := kirdy_idle_texture

    if is_input_action_pressed(inhale_action) and kirdy_inhale_texture != null:
        next_texture = kirdy_inhale_texture
    elif is_input_action_pressed(swallow_action) and kirdy_swallow_texture != null:
        next_texture = kirdy_swallow_texture
    elif not is_on_floor() and should_hover(jump_held) and kirdy_hover_texture != null:
        next_texture = kirdy_hover_texture
    elif not is_on_floor() and kirdy_jump_texture != null:
        next_texture = kirdy_jump_texture
    elif input_x != 0.0 and kirdy_run_texture != null:
        next_texture = kirdy_run_texture
    elif ability_type == "fire" and kirdy_fire_texture != null:
        next_texture = kirdy_fire_texture
    elif ability_type == "ice" or ability_type == "frost":
        if kirdy_ice_texture != null:
            next_texture = kirdy_ice_texture
    elif ability_type == "sword" and kirdy_sword_texture != null:
        next_texture = kirdy_sword_texture
    elif ability_type != "" and kirdy_fire_texture != null:
        next_texture = kirdy_fire_texture

    if next_texture == null:
        return

    if body_sprite.texture != next_texture:
        body_sprite.texture = next_texture
        fit_body_sprite()


func fit_body_sprite() -> void:
    if body_sprite == null or body_sprite.texture == null:
        return

    var texture_size := body_sprite.texture.get_size()
    if texture_size.x <= 0.0 or texture_size.y <= 0.0:
        return

    var target_size := Vector2(32.0, 36.0)
    var scale_factor: float = minf(target_size.x / texture_size.x, target_size.y / texture_size.y)
    body_sprite.scale = Vector2(scale_factor, scale_factor)


func update_coyote_time(on_floor_before_move: bool, delta: float) -> void:
    if on_floor_before_move:
        coyote_time = tuning.coyote_time_ms / 1000.0
        has_jump_cut = false
    else:
        coyote_time = maxf(coyote_time - delta, 0.0)


func update_jump_buffer(jump_pressed: bool, delta: float) -> void:
    if jump_pressed:
        jump_buffer = tuning.jump_buffer_ms / 1000.0
    else:
        jump_buffer = maxf(jump_buffer - delta, 0.0)


func apply_jump() -> void:
    if jump_buffer <= 0.0 or coyote_time <= 0.0:
        return

    velocity.y = -tuning.jump_velocity
    jump_buffer = 0.0
    coyote_time = 0.0
    has_jump_cut = false
    stop_hover()
    emit_trace("player.jump.started")


func apply_jump_cut(jump_released: bool) -> void:
    if not jump_released or has_jump_cut or velocity.y >= 0.0:
        return

    velocity.y *= tuning.jump_cut_multiplier
    has_jump_cut = true
    emit_trace("player.jump.cut")


func apply_gravity(jump_held: bool, delta: float) -> void:
    if is_on_floor():
        stop_hover()
        return

    var gravity: float = tuning.gravity_up if velocity.y < 0.0 else tuning.gravity_down

    if should_hover(jump_held):
        if not is_hovering:
            is_hovering = true
            emit_trace("player.hover.started")
        gravity *= tuning.hover_gravity_scale
    else:
        stop_hover()

    velocity.y += gravity * delta

    if is_hovering and velocity.y > tuning.hover_max_fall_speed:
        velocity.y = tuning.hover_max_fall_speed


func should_hover(jump_held: bool) -> bool:
    return jump_held and not is_on_floor() and velocity.y >= 0.0


func stop_hover() -> void:
    if not is_hovering:
        return

    is_hovering = false
    emit_trace("player.hover.ended")


func update_landing_trace() -> void:
    var on_floor_after_move := is_on_floor()

    if on_floor_after_move and not was_on_floor:
        stop_hover()
        emit_trace("player.landed")

    was_on_floor = on_floor_after_move


func emit_trace(event_type: String, payload: Dictionary = {}) -> void:
    var trace_payload := {
        "level_id": level_id,
        "player": {
            "position": {
                "x": global_position.x,
                "y": global_position.y,
            },
            "velocity": {
                "x": velocity.x,
                "y": velocity.y,
            },
        },
        "payload": payload,
    }

    trace_event.emit(event_type, trace_payload)
