import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5175,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://localhost:8001",
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    target: "es2022",
    // sourcemap disabled: rollup native generates maps in-memory and hits std::bad_alloc
    // on large chunks (vendor-three 661 kB). Re-enable per-environment if needed.
    sourcemap: false,
    minify: "esbuild",
    // Avoid rollup OOM on Three.js by splitting into stable vendor chunks.
    rollupOptions: {
      // web-ifc (5.7 MB IIFE) and maplibre-gl (~1 MB) are served from public/ to prevent OOM.
      external: (id) =>
        id === "web-ifc" ||
        id.startsWith("web-ifc/") ||
        id === "maplibre-gl" ||
        id.startsWith("maplibre-gl/"),
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("/three/") || id.includes("/three\\")) return "vendor-three";
          if (
            id.includes("/@loaders.gl/") ||
            id.includes("\\@loaders.gl\\")
          )
            return "vendor-loaders";
          if (id.includes("/d3-contour/") || id.includes("/d3-array/"))
            return "vendor-d3";
          // Bundle react + react-dom + scheduler together to avoid circular chunks.
          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("/scheduler/") ||
            id.includes("/react-router") ||
            id.includes("/react-router-dom/")
          ) {
            return "vendor-react";
          }
          return "vendor";
        },
      },
    },
  },
});
