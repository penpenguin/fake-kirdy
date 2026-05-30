extends "res://scripts/enemies/SimpleEnemy.gd"
class_name FlyingEnemy

@export var hover_amplitude: float = 18.0
@export var hover_speed: float = 2.4

var hover_origin: Vector2 = Vector2.ZERO
var hover_elapsed: float = 0.0


func _ready() -> void:
    super._ready()
    hover_origin = global_position


func _physics_process(delta: float) -> void:
    if state != "enemy.idle":
        super._physics_process(delta)
        return

    tick_hurt_invulnerability(delta)
    hover_elapsed += delta
    global_position = hover_origin + Vector2(0.0, sin(hover_elapsed * hover_speed) * hover_amplitude)


func release() -> void:
    super.release()
    hover_origin = global_position
