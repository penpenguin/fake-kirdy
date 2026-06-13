extends CharacterBody2D
class_name SimpleEnemy

@export var enemy_id: String = "simple_enemy"
@export var ability_type: String = "spark"
@export var contact_damage: int = 1
@export var follow_offset: Vector2 = Vector2(42, -20)
@export var max_hp: int = 1
@export var hurt_invulnerability_ms: int = 180
@export var patrol_radius: float = 0.0
@export var patrol_speed: float = 42.0
@export var chase_speed: float = 72.0
@export var detection_radius: float = 180.0
@export var return_radius: float = 260.0
@export var attack_damage: int = 1
@export var attack_radius: float = 120.0
@export var attack_cooldown_ms: int = 1200
@export var enemy_group_id: String = ""
@export var boss_id: String = ""
@export var hit_flash_ms: int = 140
@export var defeat_flash_ms: int = 220
@export var hit_flash_color: Color = Color(1.0, 0.32, 0.28, 1.0)
@export var normal_modulate: Color = Color(1.0, 1.0, 1.0, 1.0)

var state: String = "enemy.idle"
var hp: int = 1
var captured_by: Node = null
var initial_collision_layer: int = 1
var initial_collision_mask: int = 1
var hurt_invulnerability_remaining_ms: int = 0
var spawn_position: Vector2 = Vector2.ZERO
var patrol_direction: float = 1.0
var ai_player: Node = null
var attack_cooldown_remaining_ms: int = 0
var feedback_flash_remaining_ms: int = 0
var defeat_pending_hide: bool = false


func _ready() -> void:
    initial_collision_layer = collision_layer
    initial_collision_mask = collision_mask
    hp = max(max_hp, 1)
    spawn_position = global_position
    reset_hit_feedback_visual()
    if patrol_radius > 0.0:
        state = "enemy.patrolling"


func _physics_process(delta: float) -> void:
    tick_hit_feedback(delta)

    if state == "enemy.captured" and captured_by != null:
        global_position = captured_by.global_position + follow_offset
        velocity = Vector2.ZERO
        return

    if state == "enemy.swallowed" or state == "enemy.defeated":
        velocity = Vector2.ZERO
        return

    tick_hurt_invulnerability(delta)
    update_ai_state()
    move_with_ai()


func configure_ai(player: Node, configured_patrol_radius: float = -1.0) -> void:
    ai_player = player
    if configured_patrol_radius >= 0.0:
        patrol_radius = configured_patrol_radius
    spawn_position = global_position
    if patrol_radius > 0.0 and state == "enemy.idle":
        state = "enemy.patrolling"


func tick_hurt_invulnerability(delta: float) -> void:
    if hurt_invulnerability_remaining_ms <= 0:
        return

    var elapsed_ms: int = int(round(max(delta, 0.0) * 1000.0))
    hurt_invulnerability_remaining_ms = max(hurt_invulnerability_remaining_ms - elapsed_ms, 0)


func tick_attack_cooldown(delta: float) -> void:
    if attack_cooldown_remaining_ms <= 0:
        return

    var elapsed_ms: int = int(round(max(delta, 0.0) * 1000.0))
    attack_cooldown_remaining_ms = max(attack_cooldown_remaining_ms - elapsed_ms, 0)


func can_attack_player(target_player: Node) -> bool:
    if target_player == null or not is_instance_valid(target_player):
        return false
    if state == "enemy.captured" or state == "enemy.swallowed" or state == "enemy.defeated":
        return false
    if attack_cooldown_remaining_ms > 0:
        return false

    return global_position.distance_to(target_player.global_position) <= attack_radius


func mark_attack_started() -> Dictionary:
    attack_cooldown_remaining_ms = max(attack_cooldown_ms, 0)
    return {
        "enemy_id": enemy_id,
        "ability_type": ability_type,
        "attack_damage": attack_damage,
        "attack_radius": attack_radius,
        "attack_cooldown_ms": attack_cooldown_ms,
        "state": state,
        "enemy_group_id": enemy_group_id,
        "boss_id": boss_id,
    }


func update_ai_state() -> void:
    if ai_player != null and is_instance_valid(ai_player):
        var player_distance := global_position.distance_to(ai_player.global_position)
        if player_distance <= detection_radius:
            state = "enemy.chasing"
            return
        if state == "enemy.chasing" and player_distance > return_radius:
            state = "enemy.returning"

    if state == "enemy.returning" and global_position.distance_to(spawn_position) <= 8.0:
        state = "enemy.patrolling" if patrol_radius > 0.0 else "enemy.idle"


func move_with_ai() -> void:
    match state:
        "enemy.chasing":
            if ai_player != null and is_instance_valid(ai_player):
                var direction: float = sign(ai_player.global_position.x - global_position.x)
                velocity.x = direction * chase_speed
            else:
                velocity.x = 0.0
        "enemy.returning":
            velocity.x = sign(spawn_position.x - global_position.x) * patrol_speed
        "enemy.patrolling":
            if patrol_radius <= 0.0:
                velocity.x = 0.0
            else:
                if global_position.x > spawn_position.x + patrol_radius:
                    patrol_direction = -1.0
                elif global_position.x < spawn_position.x - patrol_radius:
                    patrol_direction = 1.0
                velocity.x = patrol_direction * patrol_speed
        _:
            velocity.x = 0.0

    velocity.y = 0.0
    move_and_slide()


func capture(player: Node) -> void:
    if state == "enemy.swallowed" or state == "enemy.defeated":
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


func take_damage(amount: int, source: Dictionary = {}) -> Dictionary:
    if state == "enemy.swallowed" or state == "enemy.defeated":
        return build_damage_result(0, source)

    if hurt_invulnerability_remaining_ms > 0:
        return build_damage_result(0, source)

    var normalized_amount: int = max(amount, 0)
    if normalized_amount <= 0:
        return build_damage_result(0, source)

    hp = max(hp - normalized_amount, 0)
    hurt_invulnerability_remaining_ms = max(hurt_invulnerability_ms, 0)
    show_hit_feedback(normalized_amount, hp <= 0)
    if hp <= 0:
        die(source)

    return build_damage_result(normalized_amount, source)


func die(_source: Dictionary = {}) -> void:
    captured_by = null
    state = "enemy.defeated"
    collision_layer = 0
    collision_mask = 0
    velocity = Vector2.ZERO
    if feedback_flash_remaining_ms <= 0:
        visible = false
        set_physics_process(false)
    else:
        visible = true


func apply_knockback(knockback: Vector2) -> void:
    if state == "enemy.swallowed" or state == "enemy.defeated":
        return

    global_position += knockback


func show_hit_feedback(damage: int, defeated: bool = false) -> void:
    if damage <= 0:
        return

    feedback_flash_remaining_ms = max(defeat_flash_ms if defeated else hit_flash_ms, 0)
    defeat_pending_hide = defeated
    var body := get_node_or_null("Body")
    if body != null:
        body.modulate = hit_flash_color


func tick_hit_feedback(delta: float) -> void:
    if feedback_flash_remaining_ms <= 0:
        return

    var elapsed_ms: int = int(round(max(delta, 0.0) * 1000.0))
    feedback_flash_remaining_ms = max(feedback_flash_remaining_ms - elapsed_ms, 0)
    if feedback_flash_remaining_ms > 0:
        return

    reset_hit_feedback_visual()
    if defeat_pending_hide:
        visible = false
        set_physics_process(false)


func reset_hit_feedback_visual() -> void:
    var body := get_node_or_null("Body")
    if body != null:
        body.modulate = normal_modulate


func build_damage_result(damage: int, source: Dictionary = {}) -> Dictionary:
    return {
        "enemy_id": enemy_id,
        "ability_type": ability_type,
        "damage": damage,
        "hp": hp,
        "max_hp": max_hp,
        "state": state,
        "defeated": state == "enemy.defeated",
        "enemy_group_id": enemy_group_id,
        "boss_id": boss_id,
        "feedback_type": "hit_flash",
        "feedback_flash_ms": defeat_flash_ms if state == "enemy.defeated" else hit_flash_ms,
        "source": source,
    }
