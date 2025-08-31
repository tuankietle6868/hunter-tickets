import { resolve } from "node:path";
import { defineConfig } from "vite";

/**
 * Chrome executes manifest content scripts as classic scripts, not ES modules.
 * Build this entry separately so every dependency is bundled into one IIFE.
 */
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: false,
    rollupOptions: {
      input: resolve(__dirname, "src/content/index.ts"),
      output: {
        format: "iife",
        inlineDynamicImports: true,
        entryFileNames: "content/index.js",
      },
    },
  },
});
