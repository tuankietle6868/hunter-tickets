import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

const LOCALHOST_MATCH = "http://localhost:*/*";

export default defineConfig(({ mode }) => ({
  plugins:
    mode === "development"
      ? [
          {
            name: "development-localhost-content-script-match",
            closeBundle() {
              const manifestPath = resolve(__dirname, "dist/manifest.json");
              const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
                content_scripts: Array<{ matches: string[] }>;
              };

              for (const contentScript of manifest.content_scripts) {
                if (!contentScript.matches.includes(LOCALHOST_MATCH)) {
                  contentScript.matches.push(LOCALHOST_MATCH);
                }
              }

              writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
            },
          },
        ]
      : [],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "popup.html"),
        "background/serviceWorker": resolve(__dirname, "src/background/serviceWorker.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  test: {
    environment: "jsdom",
  },
}));
