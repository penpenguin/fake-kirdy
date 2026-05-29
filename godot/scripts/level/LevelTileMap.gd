extends TileMap
class_name LevelTileMap

@export var metadata_tile_size: Vector2i = Vector2i(32, 32)
@export var columns: int = 0
@export var rows: int = 0
@export var collision_source: String = "static_body"


func to_level_tilemap() -> Dictionary:
    return {
        "tilemap_type": "tilemap",
        "id": name,
        "position": {
            "x": global_position.x,
            "y": global_position.y,
        },
        "payload": {
            "tile_size": {
                "x": metadata_tile_size.x,
                "y": metadata_tile_size.y,
            },
            "columns": columns,
            "rows": rows,
            "collision_source": collision_source,
        },
    }
