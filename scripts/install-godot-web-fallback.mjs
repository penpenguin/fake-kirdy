import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const repoRoot = process.cwd();
const args = process.argv.slice(2);
const exportDir = resolve(readOption('--export-dir') ?? join(repoRoot, 'dist'));
const indexPath = join(exportDir, 'index.html');
const fallbackPath = join(exportDir, 'webgl-fallback.js');
const scriptTag = '<script src="./webgl-fallback.js" defer></script>';

if (!existsSync(indexPath)) {
  console.log('[godot:web-fallback] Godot Web export artifacts are missing; run npm run build:public first');
  process.exit(0);
}

const html = readFileSync(indexPath, 'utf8');
const nextHtml = injectScriptTag(html);
writeFileSync(indexPath, nextHtml);
writeFileSync(fallbackPath, createFallbackScript());

console.log(`[godot:web-fallback] installed Canvas 2D fallback in ${exportDir}`);

function readOption(name) {
  const prefix = `${name}=`;
  const value = args.find((arg) => arg.startsWith(prefix));
  return value === undefined ? null : value.slice(prefix.length);
}

function injectScriptTag(htmlText) {
  if (htmlText.includes('webgl-fallback.js')) {
    return htmlText;
  }

  if (/<\/body>/i.test(htmlText)) {
    return htmlText.replace(/<\/body>/i, `  ${scriptTag}\n</body>`);
  }

  return `${htmlText}\n${scriptTag}\n`;
}

function createFallbackScript() {
  return String.raw`(() => {
  const fallbackAttribute = "data-kirdy-canvas2d-fallback";

  function hasWebGL2() {
    try {
      const probe = document.createElement("canvas");
      return Boolean(probe.getContext("webgl2"));
    } catch (_error) {
      return false;
    }
  }

  function hideGodotCanvas() {
    for (const canvas of document.querySelectorAll("canvas")) {
      if (!canvas.hasAttribute(fallbackAttribute)) {
        canvas.style.display = "none";
      }
    }
  }

  function createFallbackCanvas() {
    const canvas = document.createElement("canvas");
    canvas.setAttribute(fallbackAttribute, "true");
    canvas.setAttribute("role", "img");
    canvas.setAttribute(
      "aria-label",
      "WebGL 2 unavailable. Fake Kirdy is showing a Canvas 2D compatibility fallback.",
    );
    canvas.style.display = "block";
    canvas.style.width = "100vw";
    canvas.style.height = "100vh";
    canvas.style.background = "#10141f";
    canvas.style.imageRendering = "pixelated";
    document.body.appendChild(canvas);
    return canvas;
  }

  function resizeCanvas(canvas) {
    const pixelRatio = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
    const width = Math.max(320, Math.floor(window.innerWidth * pixelRatio));
    const height = Math.max(240, Math.floor(window.innerHeight * pixelRatio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    return pixelRatio;
  }

  function drawFallbackScene(canvas, timeMs) {
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const scale = resizeCanvas(canvas);
    const width = canvas.width;
    const height = canvas.height;
    const groundY = Math.round(height * 0.72);
    const pulse = Math.sin(timeMs / 420) * 4 * scale;

    context.clearRect(0, 0, width, height);
    context.fillStyle = "#10141f";
    context.fillRect(0, 0, width, height);

    context.fillStyle = "#24324a";
    context.fillRect(0, groundY, width, height - groundY);
    context.fillStyle = "#7ec9d8";
    context.fillRect(width * 0.18, groundY - 18 * scale, width * 0.64, 18 * scale);

    const kirdyX = width * 0.48;
    const kirdyY = groundY - 42 * scale + pulse;
    context.fillStyle = "#f7a7c6";
    context.beginPath();
    context.arc(kirdyX, kirdyY, 30 * scale, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#2c2430";
    context.fillRect(kirdyX - 10 * scale, kirdyY - 8 * scale, 5 * scale, 5 * scale);
    context.fillRect(kirdyX + 9 * scale, kirdyY - 8 * scale, 5 * scale, 5 * scale);

    context.fillStyle = "#f7f3e8";
    context.font = Math.round(18 * scale) + "px sans-serif";
    context.textAlign = "center";
    context.fillText("Fake Kirdy", width / 2, height * 0.22);
    context.font = Math.round(12 * scale) + "px sans-serif";
    context.fillStyle = "#b8c7d9";
    context.fillText("WebGL 2 unavailable - Canvas 2D fallback", width / 2, height * 0.22 + 28 * scale);
    context.fillText("Use a WebGL 2-capable browser to play the Godot build.", width / 2, height * 0.22 + 48 * scale);
  }

  function startFallback() {
    document.documentElement.classList.add("kirdy-webgl-unavailable");
    hideGodotCanvas();
    const canvas = createFallbackCanvas();

    function frame(timeMs) {
      drawFallbackScene(canvas, timeMs);
      requestAnimationFrame(frame);
    }

    window.addEventListener("resize", () => drawFallbackScene(canvas, performance.now()));
    requestAnimationFrame(frame);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      if (!hasWebGL2()) {
        startFallback();
      }
    });
  } else if (!hasWebGL2()) {
    startFallback();
  }
})();`;
}
