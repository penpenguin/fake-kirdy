# Godot v2 Legacy Reference Boundary

Godot is the canonical runtime. The Phaser + Matter.js legacy reference copy has been removed from the repository after its gameplay intent, content topology, migrated assets, and regression evidence were captured in Godot-owned docs, data, tests, and resources. It is not required by the canonical runtime or canonical import data.

## Current Legacy Surface

Runtime source and web assets:

Removed from the repository. `npm run legacy:inventory` should report empty `source_dirs` and `config_files`.

Legacy commands:

None. Root run/build/test commands are Godot canonical.

Legacy runtime dependencies:

None. Root Phaser/Vite dependencies have been removed.

Use `npm run legacy:inventory` for the current machine-readable inventory. The inventory marks this surface as `removed from canonical repository` and `required_by_canonical_runtime: false`.

The Phaser parity ledger gate was retired after the Godot mainline switch. Ongoing validation now lives in Godot-owned manifests, generated schema, content checks, replay fixtures, trace metrics, export checks, and the legacy inventory.

## Allowed Uses

Use Godot-owned docs, stage manifests, generated schema, replay fixtures, trace summaries, tests, and resources to confirm gameplay intent, map topology, input semantics, save fields, enemy behavior, collectibles, and results flow while auditing Godot parity.

Do not reintroduce optional legacy/reference copies or add new Phaser runtime behavior. New canonical runtime work belongs under `godot/`, with supporting validation or import tooling under `scripts/` and tests under `test/`.

## Retirement Gates

The retirement gates now tracked for the removed legacy surface:

- `npm run test:canonical` passes, including the Godot replay suite when Godot is available.
- Godot export validation either succeeds or the missing export templates are explicitly reported as a graceful skip.
- Durable behavior from the old runtime is ported to Godot, represented in Godot docs/import data, or explicitly deprecated in the ExecPlan.
- The legacy migration decision is recorded in `docs/godot-v2/full-migration-execplan.md`.
- Root runtime dependencies removed: `phaser`, `matter-js`, and direct `vite` are no longer in `package.json`.
