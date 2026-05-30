# Godot Web Fallback

The canonical browser build is still the Godot Web export. After a successful Web export, `scripts/export-godot.mjs` runs:

```bash
npm run godot:web-fallback
```

That installer injects `webgl-fallback.js` into `dist/index.html`. At runtime the script probes WebGL with a temporary canvas. If WebGL is available, it does nothing and the Godot canvas owns the page. The injected script is the Canvas 2D fallback boundary for unsupported browsers.

When WebGL unavailable is detected, the script hides the Godot canvas and creates a `data-kirdy-canvas2d-fallback` canvas. The fallback draws a lightweight Canvas 2D compatibility scene with a clear message that a WebGL-capable browser is required for the playable Godot build. This keeps unsupported browsers from showing a blank page without reintroducing Phaser runtime dependencies.

The installer is idempotent so repeated export or deploy steps keep a single script tag.
