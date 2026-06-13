extends Node2D
class_name EnemySpawnMarker

@export var spawn_id: String = "enemy"
@export var enemy_type: String = "test_dummy"
@export var ability_type: String = "spark"
@export var enemy_rank: String = "basic"
@export var max_hp: int = 0
@export var patrol_radius: float = 0.0
@export var contact_damage: int = 1
@export var attack_damage: int = 1
@export var attack_radius: float = 120.0
@export var attack_cooldown_ms: int = 1200
@export var enemy_group_id: String = ""
@export var boss_id: String = ""
@export var orb_reward_item_id: String = ""


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
            "enemy_rank": enemy_rank,
            "max_hp": max_hp,
            "patrol_radius": patrol_radius,
            "contact_damage": contact_damage,
            "attack_damage": attack_damage,
            "attack_radius": attack_radius,
            "attack_cooldown_ms": attack_cooldown_ms,
            "enemy_group_id": enemy_group_id,
            "boss_id": boss_id,
            "orb_reward_item_id": orb_reward_item_id,
        },
    }
