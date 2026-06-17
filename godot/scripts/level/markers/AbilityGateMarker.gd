extends Node2D
class_name AbilityGateMarker

const FireGateTexture = preload("res://resources/assets/images/ui/ability-gate-fire.webp")
const SparkGateTexture = preload("res://resources/assets/images/ui/ability-gate-spark.webp")

@export var gate_id: String = "ability_gate"
@export var required_ability_type: String = "fire"
@export var gate_visual_style: String = ""
@export var gate_texture_path: String = ""
@export var gate_effect: String = "open"
@export var trigger_radius: float = 72.0
@export var grants_item_id: String = ""
@export var hint_text: String = ""
@export var opened: bool = false
@export var blocker_size: Vector2 = Vector2(64, 128)
@export var visual_target_size: Vector2 = Vector2(64, 128)
@export var closed_color: Color = Color(0.46, 0.82, 1.0, 0.86)
@export var opened_color: Color = Color(0.46, 0.82, 1.0, 0.18)


func _ready() -> void:
    add_to_group("level_marker")
    add_to_group("ability_gate_marker")
    ensure_blocker_nodes()
    apply_gate_state()


func open_gate(open_payload: Dictionary = {}) -> void:
    if opened:
        apply_gate_state()
        return

    opened = true
    apply_gate_state()


func get_gate_state() -> Dictionary:
    var visual := get_visual_node()
    var collision_shape := get_collision_shape()
    return {
        "gate_id": gate_id,
        "opened": opened,
        "visual_changed": visual != null and (not visual.visible or visual.modulate == opened_color),
        "collision_disabled": collision_shape != null and collision_shape.disabled,
    }


func to_level_marker() -> Dictionary:
    return {
        "marker_type": "ability_gate",
        "id": gate_id,
        "position": {
            "x": global_position.x,
            "y": global_position.y,
        },
        "payload": {
            "required_ability_type": required_ability_type,
            "gate_visual_style": gate_visual_style,
            "gate_texture_path": gate_texture_path,
            "gate_effect": gate_effect,
            "trigger_radius": trigger_radius,
            "grants_item_id": grants_item_id,
            "hint_text": hint_text,
            "opened": opened,
        },
    }


func ensure_blocker_nodes() -> void:
    var existing_visual := get_node_or_null("Visual")
    if existing_visual != null and not (existing_visual is Sprite2D):
        remove_child(existing_visual)
        existing_visual.queue_free()

    var visual := get_node_or_null("Visual") as Sprite2D
    if visual == null:
        visual = Sprite2D.new()
        visual.name = "Visual"
        add_child(visual)

    visual.texture = get_gate_texture()
    visual.position = Vector2(0.0, -16.0)
    visual.z_index = 2
    fit_visual_to_target_size(visual)

    var collision_body := get_node_or_null("CollisionBody") as StaticBody2D
    if collision_body == null:
        collision_body = StaticBody2D.new()
        collision_body.name = "CollisionBody"
        add_child(collision_body)

    if get_collision_shape() == null:
        var collision_shape := CollisionShape2D.new()
        collision_shape.name = "CollisionShape2D"
        var rectangle := RectangleShape2D.new()
        rectangle.size = blocker_size
        collision_shape.shape = rectangle
        collision_shape.position = Vector2(0.0, -16.0)
        collision_body.add_child(collision_shape)


func apply_gate_state() -> void:
    var visual := get_visual_node()
    if visual != null:
        visual.visible = not opened
        visual.modulate = opened_color if opened else closed_color

    var collision_shape := get_collision_shape()
    if collision_shape != null:
        collision_shape.disabled = opened


func get_visual_node() -> CanvasItem:
    return get_node_or_null("Visual") as CanvasItem


func get_collision_shape() -> CollisionShape2D:
    return get_node_or_null("CollisionBody/CollisionShape2D") as CollisionShape2D


func get_gate_texture() -> Texture2D:
    if gate_texture_path != "":
        var loaded_texture := load(gate_texture_path) as Texture2D
        if loaded_texture != null:
            return loaded_texture

    if gate_visual_style == "fire_gate" or required_ability_type == "fire":
        return FireGateTexture

    return SparkGateTexture


func fit_visual_to_target_size(visual: Sprite2D) -> void:
    if visual == null or visual.texture == null:
        return

    var texture_size := visual.texture.get_size()
    if texture_size.x <= 0.0 or texture_size.y <= 0.0:
        return

    var scale_factor: float = minf(visual_target_size.x / texture_size.x, visual_target_size.y / texture_size.y)
    visual.scale = Vector2(scale_factor, scale_factor)
