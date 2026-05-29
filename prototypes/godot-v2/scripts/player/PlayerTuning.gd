extends Resource
class_name PlayerTuning

@export var max_speed: float = 220.0
@export var ground_accel: float = 1800.0
@export var ground_decel: float = 2400.0
@export var air_accel: float = 900.0
@export var air_decel: float = 700.0
@export var jump_velocity: float = 430.0
@export var gravity_up: float = 1250.0
@export var gravity_down: float = 1700.0
@export var jump_cut_multiplier: float = 0.45
@export var coyote_time_ms: float = 90.0
@export var jump_buffer_ms: float = 120.0
@export var hover_gravity_scale: float = 0.35
@export var hover_max_fall_speed: float = 90.0
