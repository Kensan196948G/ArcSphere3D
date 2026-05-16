/**
 * Copy web-ifc IIFE and WASM files into public/web-ifc/ before vite build.
 * web-ifc is excluded from rollup (5.7 MB JS causes OOM during transform).
 * The IIFE is loaded via <script> in index.html at runtime instead.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgDir = resolve(__dirname, "../node_modules/web-ifc");
const destDir = resolve(__dirname, "../public/web-ifc");

mkdirSync(destDir, { recursive: true });

const files = [
  ["web-ifc-api-iife.js", "web-ifc-api.js"],
  ["web-ifc.wasm", "web-ifc.wasm"],
  ["web-ifc-mt.wasm", "web-ifc-mt.wasm"],
];

for (const [src, dest] of files) {
  copyFileSync(resolve(pkgDir, src), resolve(destDir, dest));
}

console.log(`[copy-web-ifc] copied ${files.length} files to public/web-ifc/`);
