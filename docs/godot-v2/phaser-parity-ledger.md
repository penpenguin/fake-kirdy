# Phaser Parity Ledger

`phaser-parity-ledger.json` is the retirement checklist for the Phaser + Matter reference runtime. It records each major Phaser system, the Godot evidence that replaces it, validation commands, and whether that system still blocks deleting or moving the legacy runtime.

Run the normal schema/evidence check:

```bash
npm run godot:parity-ledger -- --check
```

Run blocker enforcement before removing Phaser dependencies:

```bash
npm run godot:parity-ledger -- --fail-on-blockers
```

`--check` validates that ledger entries are well-formed and that referenced files still exist. `--fail-on-blockers` is intentionally stricter: it exits non-zero if any entry still has `retirement_blocker: true`. After the Godot mainline switch it should pass with `blocker_count: 0`.

The ledger complements `legacy:inventory`:

- `legacy:inventory` says what Phaser/Vite surface still exists.
- `godot:parity-ledger` says why it still exists and what evidence is needed to retire it.
