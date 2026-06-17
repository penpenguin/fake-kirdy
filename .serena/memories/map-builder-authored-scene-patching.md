# Map builder authored scene patching

PR #25 fixed two authored `.tscn` patching pitfalls in `tools/map-builder/src/domain/godotTscnRoom.ts`:

- When `patchNodeProperty()` inserts a missing property with `lines.splice()`, parsed `ParsedNode.startLine` / `endLine` ranges must be shifted for the current and subsequent nodes. Otherwise later edits in the same save can search stale ranges and leave duplicate/stale properties.
- Content marker addition checks must reuse existing authored nodes by semantic id (`hazard_id`, `gate_id`, `heal_id`, etc.) as well as node name. The earlier patch pass already updates by semantic id, so addition checks that only compare `node.name` can duplicate markers when Room Editor `id` changes but semantic id remains stable.

Regression coverage lives in `test/godot-v2-map-builder.test.ts` around the authored `.tscn` patch tests.