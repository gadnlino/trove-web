import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Trove is a static, client-side website. We intentionally do NOT enable
// cross-origin isolation (COOP/COEP) so that cross-origin media (e.g. from an
// S3-compatible bucket) keeps loading; the optional ffmpeg.wasm fallback uses
// the single-threaded core, which does not require SharedArrayBuffer.
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    target: "es2022",
  },
  worker: {
    format: "es",
  },
  optimizeDeps: {
    // ffmpeg.wasm is loaded lazily/dynamically and must not be pre-bundled.
    exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"],
  },
});
