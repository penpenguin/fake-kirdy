extends Node
class_name SaveStore

const SaveStateScript = preload("res://scripts/save/SaveState.gd")
const LOCAL_STORAGE_SAVE_KEY := "kirdy-save"
const SESSION_STORAGE_FALLBACK_KEY := "kirdy-save-temp"

var error_message: String = ""
var last_storage_backend: String = "file"
var browser_local_storage_enabled: bool = true
var session_storage_fallback_enabled: bool = true


func load_state(path: String):
    error_message = ""
    last_storage_backend = "file"

    var browser_state = load_state_from_local_storage()
    if last_storage_backend == "localStorage":
        return browser_state

    if path == "" or not FileAccess.file_exists(path):
        return load_state_from_session_storage()

    var file := FileAccess.open(path, FileAccess.READ)
    if file == null:
        error_message = "Unable to open save for read: %s" % path
        return load_state_from_session_storage()

    var parsed = JSON.parse_string(file.get_as_text())
    if typeof(parsed) != TYPE_DICTIONARY:
        error_message = "Save file is not a JSON object: %s" % path
        return load_state_from_session_storage()

    last_storage_backend = "file"
    return SaveStateScript.from_dictionary(parsed)


func save_state(path: String, save_data) -> bool:
    error_message = ""
    last_storage_backend = "file"

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

    var save_json := JSON.stringify(state.to_dictionary())
    if save_state_to_local_storage(save_json):
        return true

    if path == "":
        error_message = "Save path is empty"
        return save_state_to_session_storage(save_json)

    var file := FileAccess.open(path, FileAccess.WRITE)
    if file == null:
        error_message = "Unable to open save for write: %s" % path
        return save_state_to_session_storage(save_json)

    file.store_string(save_json)
    last_storage_backend = "file"
    return true


func save_state_to_local_storage(save_json: String) -> bool:
    if save_json == "" or not can_use_local_storage():
        return false

    var key_literal := JSON.stringify(LOCAL_STORAGE_SAVE_KEY)
    var value_literal := JSON.stringify(save_json)
    var result = JavaScriptBridge.eval(
        "try { window.localStorage.setItem(%s, %s); true; } catch (error) { false; }" % [
            key_literal,
            value_literal,
        ],
        true
    )
    if result != true:
        return false

    last_storage_backend = "localStorage"
    return true


func save_state_to_session_storage(save_json: String) -> bool:
    if save_json == "" or not can_use_session_storage():
        return false

    var key_literal := JSON.stringify(SESSION_STORAGE_FALLBACK_KEY)
    var value_literal := JSON.stringify(save_json)
    var result = JavaScriptBridge.eval(
        "try { window.sessionStorage.setItem(%s, %s); true; } catch (error) { false; }" % [
            key_literal,
            value_literal,
        ],
        true
    )
    if result != true:
        return false

    last_storage_backend = "sessionStorage"
    return true


func load_state_from_local_storage():
    if not can_use_local_storage():
        return SaveStateScript.new()

    var key_literal := JSON.stringify(LOCAL_STORAGE_SAVE_KEY)
    var save_json = JavaScriptBridge.eval(
        "try { window.localStorage.getItem(%s); } catch (error) { null; }" % key_literal,
        true
    )
    if typeof(save_json) != TYPE_STRING or String(save_json) == "":
        return SaveStateScript.new()

    var parsed = JSON.parse_string(String(save_json))
    if typeof(parsed) != TYPE_DICTIONARY:
        error_message = "Local storage save is not a JSON object"
        return SaveStateScript.new()

    last_storage_backend = "localStorage"
    return SaveStateScript.from_dictionary(parsed)


func load_state_from_session_storage():
    if not can_use_session_storage():
        return SaveStateScript.new()

    var key_literal := JSON.stringify(SESSION_STORAGE_FALLBACK_KEY)
    var save_json = JavaScriptBridge.eval(
        "try { window.sessionStorage.getItem(%s); } catch (error) { null; }" % key_literal,
        true
    )
    if typeof(save_json) != TYPE_STRING or String(save_json) == "":
        return SaveStateScript.new()

    var parsed = JSON.parse_string(String(save_json))
    if typeof(parsed) != TYPE_DICTIONARY:
        error_message = "Session storage save is not a JSON object"
        return SaveStateScript.new()

    last_storage_backend = "sessionStorage"
    return SaveStateScript.from_dictionary(parsed)


func can_use_session_storage() -> bool:
    return session_storage_fallback_enabled and OS.has_feature("web")


func can_use_local_storage() -> bool:
    return browser_local_storage_enabled and OS.has_feature("web")
