# fake-kirdy

[![Test](https://github.com/penpenguin/fake-kirdy/actions/workflows/test.yml/badge.svg)](https://github.com/penpenguin/fake-kirdy/actions/workflows/test.yml)
[![Deploy](https://img.shields.io/website?label=deploy&url=https%3A%2F%2Fpenpenguin.github.io%2Ffake-kirdy%2F)](https://penpenguin.github.io/fake-kirdy/)
![Vitest](https://img.shields.io/badge/tested_with-vitest-6E9F18?logo=vitest&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)

![Kirdy key visual](docs/key_visual.gif)

Fake Kirdy uses Godot 4 as the canonical runtime. The former Phaser + Matter.js reference copy has been removed from the repository after its gameplay intent, topology, and asset evidence were migrated into Godot-owned data.

## Godot Mainline

- Run the canonical Godot project: `npm run dev` or `npm run godot:run`
- Run a headless replay when Godot is installed: `npm run godot:replay`
- Export the canonical Godot build when export templates are installed: `npm run build` or `npm run godot:export`
- Summarize a trace file: `npm run trace:summary -- <trace.json|trace.ndjson>`
- Validate the repository: `npm test`
- Validate canonical Godot behavior, including the replay suite when available: `npm run test:canonical`
- Check the Phaser-to-Godot parity ledger: `npm run godot:parity-ledger -- --check`

The canonical Godot project lives in `godot/`. The export wrapper skips gracefully if Godot or export templates are unavailable. The older `prototypes/godot-v2/` tree is kept as historical reference during the migration.

## Legacy Removal

The deployed Phaser build is still useful as a gameplay reference during migration: [Fake Kirdy on GitHub Pages](https://penpenguin.github.io/fake-kirdy/).

The root package no longer exposes Phaser/Vite runtime commands or dependencies, and the legacy reference copy has been removed. Use Godot commands for run/build/test.

Run `npm run legacy:inventory` to confirm the removed legacy surface remains empty. Run `npm run godot:parity-ledger -- --fail-on-blockers` before changing that boundary again.
