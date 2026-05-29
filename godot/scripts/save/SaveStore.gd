extends Node
class_name SaveStore

const SaveStateScript = preload("res://scripts/save/SaveState.gd")

var error_message: String = ""


func load_state(path: String):
    error_message = ""

    if path == "" or not FileAccess.file_exists(path):
        return SaveStateScript.new()

    var file := FileAccess.open(path, FileAccess.READ)
    if file == null:
        error_message = "Unable to open save for read: %s" % path
        return SaveStateScript.new()

    var parsed = JSON.parse_string(file.get_as_text())
    if typeof(parsed) != TYPE_DICTIONARY:
        error_message = "Save file is not a JSON object: %s" % path
        return SaveStateScript.new()

    return SaveStateScript.from_dictionary(parsed)


func save_state(path: String, save_data) -> bool:
    error_message = ""

    if path == "":
        error_message = "Save path is empty"
        return false

    var state = SaveStateScript.new()
    if typeof(save_data) == TYPE_DICTIONARY:
        state = SaveStateScript.from_dictionary(save_data)
    elif typeof(save_data) == TYPE_ARRAY:
        for item in save_data:
            var item_id := String(item)
            if item_id == "" or state.acquired_item_ids.has(item_id):
                continue
            state.acquired_item_ids.append(item_id)
        state.acquired_item_ids.sort()

    var file := FileAccess.open(path, FileAccess.WRITE)
    if file == null:
        error_message = "Unable to open save for write: %s" % path
        return false

    file.store_string(JSON.stringify(state.to_dictionary()))
    return true
