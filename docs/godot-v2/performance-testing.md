# Godot v2 Performance Testing

The explicit performance gate is:

```bash
npm run godot:performance
```

The command reads `godot/tests/performance_budget.json`, imports the Godot project, and runs the selected representative replays headlessly. It checks:

- effective trace FPS against the 60 FPS target
- replay wall-clock runtime
- peak replay process RSS when the host exposes `/proc/<pid>/status`
- Godot import/load time
- trace output size

The check skips gracefully when Godot is not installed, matching the rest of the optional Godot executable gates. It is intentionally separate from `npm test` because performance measurements are environment-sensitive and slower than static migration contracts.

The explicit browser 60 FPS gate is:

```bash
npm run godot:web-performance
```

This command reads `godot/tests/web_performance_budget.json`, serves the Godot Web export from `dist/`, launches a local Chromium-compatible browser through the Chrome DevTools Protocol, and samples `requestAnimationFrame` timing. It checks:

- browser 60 FPS target through `min_browser_raf_fps`
- worst sampled frame duration through `max_browser_frame_ms`
- that the exported page creates a canvas
- that the expected Godot Web export artifacts (`index.html`, JavaScript, `.wasm`, and `.pck`) are present

The browser gate skips gracefully when the Web export artifacts are missing or when a browser executable is unavailable. CI runs it after `npm run build:public`, so the gate is enforced where Godot export templates and browser tooling are available.
