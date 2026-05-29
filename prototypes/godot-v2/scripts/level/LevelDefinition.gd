extends Resource
class_name LevelDefinition

@export var level_id: String = ""

var player_spawns: Array[Dictionary] = []
var doors: Array[Dictionary] = []
var enemy_spawns: Array[Dictionary] = []
var heals: Array[Dictionary] = []
var goals: Array[Dictionary] = []
var camera_bounds: Array[Dictionary] = []
var unknown_markers: Array[Dictionary] = []


func add_marker(marker: Dictionary) -> void:
    match String(marker.get("marker_type", "")):
        "player_spawn":
            player_spawns.append(marker)
        "door":
            doors.append(marker)
        "enemy_spawn":
            enemy_spawns.append(marker)
        "heal":
            heals.append(marker)
        "goal":
            goals.append(marker)
        "camera_bounds":
            camera_bounds.append(marker)
        _:
            unknown_markers.append(marker)


func marker_count() -> int:
    return (
        player_spawns.size()
        + doors.size()
        + enemy_spawns.size()
        + heals.size()
        + goals.size()
        + camera_bounds.size()
        + unknown_markers.size()
    )
