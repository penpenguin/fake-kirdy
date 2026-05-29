extends CharacterBody2D
class_name SimpleEnemy

@export var enemy_id: String = "simple_enemy"
@export var ability_type: String = "spark"
@export var follow_offset: Vector2 = Vector2(42, -20)

var state: String = "enemy.idle"
var captured_by: Node = null
var initial_collision_layer: int = 1
var initial_collision_mask: int = 1


func _ready() -> void:
    initial_collision_layer = collision_layer
    initial_collision_mask = collision_mask


func _physics_process(_delta: float) -> void:
    if state == "enemy.captured" and captured_by != null:
        global_position = captured_by.global_position + follow_offset


func capture(player: Node) -> void:
    if state == "enemy.swallowed":
        return

    captured_by = player
    state = "enemy.captured"
    collision_layer = 0
    collision_mask = 0


func release() -> void:
    if state != "enemy.captured":
        return

    captured_by = null
    state = "enemy.idle"
    collision_layer = initial_collision_layer
    collision_mask = initial_collision_mask


func swallow() -> void:
    captured_by = null
    state = "enemy.swallowed"
    visible = false
    collision_layer = 0
    collision_mask = 0
    set_physics_process(false)
