# fake-kirdy

[![Test](https://github.com/penpenguin/fake-kirdy/actions/workflows/test.yml/badge.svg)](https://github.com/penpenguin/fake-kirdy/actions/workflows/test.yml)
[![Deploy](https://img.shields.io/website?label=deploy&url=https%3A%2F%2Fpenpenguin.github.io%2Ffake-kirdy%2F)](https://penpenguin.github.io/fake-kirdy/)
![Vitest](https://img.shields.io/badge/tested_with-vitest-6E9F18?logo=vitest&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)

![Kirdy key visual](docs/key_visual.gif)

Fake Kirdy uses Godot 4 as the canonical runtime. Gameplay behavior, topology, assets, replay fixtures, and validation contracts live in Godot-owned project data.

## Godot Mainline

- Run the canonical Godot project: `npm run dev` or `npm run godot:run`
- If Godot is not available as `godot` or `godot4`, run with `GODOT_BIN=/path/to/godot npm run godot:run`
- Run a headless replay when Godot is installed: `npm run godot:replay`
- Export the canonical Godot Web build when export templates are installed: `npm run build` or `npm run godot:export`
- Build the required public GitHub Pages artifact: `npm run build:public`
- Summarize a trace file: `npm run trace:summary -- <trace.json|trace.ndjson>`
- Validate the repository: `npm test`
- Run the Godot static/content/export validation directly: `npm run check:godot`
- Validate canonical Godot behavior, including the replay suite when available: `npm run test:canonical`

The canonical Godot project lives in `godot/`. The default export preset is `Web` and writes the public artifact to `dist/index.html`; the `Linux Headless` preset remains available through `npm run godot:export -- --preset="Linux Headless"`. The regular export wrapper skips gracefully if Godot or export templates are unavailable, while `npm run build:public` requires a complete Godot Web export for deployment.

## Documentation

- Docs index: `docs/README.md`
- Godot mainline docs: `docs/godot-v2/README.md`
- Map topology and generated levels: `docs/map-structure.md`
- Current backlog/status: `Task.md`

Current implementation work should start from the docs index, checked-in Godot data under `godot/levels/`, replay fixtures under `godot/tests/`, and the Vitest contracts under `test/`.
