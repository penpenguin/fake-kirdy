extends Node2D
class_name LevelPacingMarker

@export var pacing_profile: String = "branch"
@export var critical_path_px: float = 0.0
@export var rest_stop_count: int = 0
@export var safe_spawn_radius: float = 96.0
@export var door_preview_spacing_px: float = 144.0
@export var encounter_budget: int = 0
@export var collectible_visibility: String = ""


func _ready() -> void:
    add_to_group("level_marker")
    add_to_group("level_pacing_marker")


func to_level_marker() -> Dictionary:
    return {
        "marker_type": "level_pacing",
        "id": "%s_pacing" % pacing_profile,
        "position": {
            "x": global_position.x,
            "y": global_position.y,
        },
        "payload": {
            "pacing_profile": pacing_profile,
            "critical_path_px": critical_path_px,
            "rest_stop_count": rest_stop_count,
            "safe_spawn_radius": safe_spawn_radius,
            "door_preview_spacing_px": door_preview_spacing_px,
            "encounter_budget": encounter_budget,
            "collectible_visibility": collectible_visibility,
        },
    }
