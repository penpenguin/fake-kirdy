# Godot v2 Legacy Reference Boundary

Godot is the canonical runtime. The Phaser + Matter.js implementation remains in the repository only as legacy/reference source for gameplay intent, content audits, and historical regression context.

## Current Legacy Surface

Runtime source and web assets:

- `legacy/phaser-reference/src/`
- `legacy/phaser-reference/public/`
- `legacy/phaser-reference/index.html`
- `legacy/phaser-reference/vite.config.ts`

Legacy commands:

None. Root run/build/test commands are Godot canonical.

Legacy runtime dependencies:

None. Root Phaser/Vite dependencies have been removed.

Use `npm run legacy:inventory` for the current machine-readable inventory.

Use `docs/godot-v2/phaser-parity-ledger.json` and `npm run godot:parity-ledger -- --check` to see which Phaser reference systems are ported, partial, deferred, deprecated, or still blocking retirement.

## Allowed Uses

Use the legacy/reference source to confirm gameplay intent, map topology, input semantics, save fields, enemy behavior, collectibles, and results flow while auditing Godot parity.

Do not add new mainline gameplay to `legacy/phaser-reference/src/`. New canonical runtime work belongs under `godot/`, with supporting validation or import tooling under `scripts/` and tests under `test/`.

## Retirement Gates

The retirement gates now tracked for the remaining reference source:

- `npm run test:canonical` passes, including the Godot replay suite when Godot is available.
- `npm run godot:parity-ledger -- --fail-on-blockers` passes after blockers are intentionally resolved.
- Godot export validation either succeeds or the missing export templates are explicitly reported as a graceful skip.
- Useful Phaser reference behavior is ported to Godot, represented in Godot docs/import data, or explicitly deprecated in the ExecPlan.
- The legacy migration decision is recorded in `docs/godot-v2/full-migration-execplan.md`.
- Root runtime dependencies removed: `phaser`, `matter-js`, and direct `vite` are no longer in `package.json`.
