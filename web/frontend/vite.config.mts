import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: here,
  plugins: [tailwindcss()],
  resolve: { alias: { "@": resolve(here, "..") } },
  build: {
    outDir: resolve(here, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        control: resolve(here, "index.html"),
        api: resolve(here, "api/index.html"),
      },
      onwarn(warning, defaultHandler) {
        // Next.js client directives are harmless in this browser-only bundle.
        if (warning.code === "MODULE_LEVEL_DIRECTIVE") return;
        defaultHandler(warning);
      },
    },
  },
});
