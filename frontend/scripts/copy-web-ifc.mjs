/**
 * Copy pre-built IIFE/WASM assets into public/ before vite build.
 * These libraries are excluded from rollup to prevent OOM during transform.
 * They are loaded via <script>/<link> in index.html at runtime instead.
 *
 * - web-ifc (5.7 MB IIFE + WASM): IFC geometry engine
 * - maplibre-gl (~1 MB CSP build): WebGL map renderer
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

function copy(srcDir, files, destDir) {
  mkdirSync(destDir, { recursive: true });
  for (const [src, dest] of files) {
    copyFileSync(resolve(srcDir, src), resolve(destDir, dest));
  }
  console.log(`[copy-assets] copied ${files.length} files to ${destDir.replace(rootDir, "")}/`);
}

// web-ifc
copy(
  resolve(rootDir, "node_modules/web-ifc"),
  [
    ["web-ifc-api-iife.js", "web-ifc-api.js"],
    ["web-ifc.wasm", "web-ifc.wasm"],
    ["web-ifc-mt.wasm", "web-ifc-mt.wasm"],
  ],
  resolve(rootDir, "public/web-ifc"),
);

// maplibre-gl (CSP build: worker is a separate file, referenced via maplibregl.workerUrl)
copy(
  resolve(rootDir, "node_modules/maplibre-gl/dist"),
  [
    ["maplibre-gl-csp.js", "maplibre-gl.js"],
    ["maplibre-gl-csp-worker.js", "maplibre-gl-worker.js"],
    ["maplibre-gl.css", "maplibre-gl.css"],
  ],
  resolve(rootDir, "public/maplibre-gl"),
);
