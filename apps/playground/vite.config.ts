import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// ツールは、index.html を持つディレクトリから読む。oxlint.config.ts も同じ方法で読む
const tools = readdirSync(import.meta.dirname, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(import.meta.dirname, d.name, "index.html")))
  .map((d) => d.name);

export default defineConfig({
  // React Compiler は apps/playground にだけ入れる。外すときは babel の plugin を消す (ADR-0047)
  plugins: [react(), babel({ presets: [reactCompilerPreset()] }), tailwindcss()],
  // PGlite は .wasm と .data を import.meta.url から相対で読むので、事前のバンドルから外す
  optimizeDeps: { exclude: ["@electric-sql/pglite"] },
  worker: { format: "es" },
  build: {
    rollupOptions: {
      input: Object.fromEntries(
        tools.map((tool) => [tool, join(import.meta.dirname, tool, "index.html")]),
      ),
    },
  },
});
