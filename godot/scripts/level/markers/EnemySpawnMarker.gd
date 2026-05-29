extends Node2D
class_name EnemySpawnMarker

@export var spawn_id: String = "enemy"
@export var enemy_type: String = "test_dummy"
@export var ability_type: String = "spark"
@export var patrol_radius: float = 0.0
@export var contact_damage: int = 1


func _ready() -> void:
    add_to_group("level_marker")
    add_to_group("enemy_spawn_marker")


func to_level_marker() -> Dictionary:
    return {
        "marker_type": "enemy_spawn",
        "id": spawn_id,
        "position": {
            "x": global_position.x,
            "y": global_position.y,
        },
        "payload": {
            "enemy_type": enemy_type,
            "ability_type": ability_type,
            "patrol_radius": patrol_radius,
            "contact_damage": contact_damage,
        },
    }
