extends Node2D
class_name AbilityProjectile

@onready var trail: Line2D = $Trail

var ability_type: String = ""
var attack_type: String = "projectile"
var speed: float = 480.0
var max_range: float = 240.0
var direction: Vector2 = Vector2.RIGHT
var start_position: Vector2 = Vector2.ZERO
var hit_position: Vector2 = Vector2.ZERO
var has_hit: bool = false


func _ready() -> void:
    refresh_trail()


func configure_projectile(next_ability_type: String, profile: Dictionary, facing: float) -> void:
    ability_type = next_ability_type
    attack_type = String(profile.get("attack_type", "projectile"))
    speed = float(profile.get("projectile_speed", 480.0))
    max_range = float(profile.get("range", 240.0))
    direction = Vector2(-1.0 if facing < 0.0 else 1.0, 0.0)
    start_position = global_position
    hit_position = start_position + direction * max_range
    has_hit = false
    refresh_trail()


func mark_hit(next_hit_position: Vector2) -> void:
    hit_position = next_hit_position
    has_hit = true
    refresh_trail()


func get_projectile_payload() -> Dictionary:
    return {
        "ability_type": ability_type,
        "attack_type": attack_type,
        "projectile_speed": speed,
        "max_range": max_range,
        "direction": {
            "x": direction.x,
            "y": direction.y,
        },
        "start_position": {
            "x": start_position.x,
            "y": start_position.y,
        },
        "hit_position": {
            "x": hit_position.x,
            "y": hit_position.y,
        },
        "has_hit": has_hit,
    }


func refresh_trail() -> void:
    if not is_inside_tree():
        return

    var local_hit_position := hit_position - global_position
    if local_hit_position == Vector2.ZERO:
        local_hit_position = direction * max_range
    trail.clear_points()
    trail.add_point(Vector2.ZERO)
    trail.add_point(local_hit_position)
