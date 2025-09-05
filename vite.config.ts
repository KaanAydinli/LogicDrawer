import { defineConfig } from "vite";
import { defineConfig as defineVitestConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  server: {
    hmr: {
      overlay: true,
    },
    watch: {
      usePolling: true,
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        app: resolve(__dirname, "logic.html"),
      },
    },
    outDir: "dist",
  },
  test: {
    root: ".",
    include: ["tests/**/*.{test,spec}.?(c|m)[jt]s?(x)"],
    globals: true,
    environment: "node",
  },
});
