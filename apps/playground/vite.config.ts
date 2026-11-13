import { resolve } from "node:path";
import babel from "@rolldown/plugin-babel";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const TOOLS = ["node", "sql", "go"];

export default defineConfig({
  // React Compiler は apps/playground にだけ入れる。外すときは babel の plugin を消す (ADR-0047)
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  build: {
    rollupOptions: {
      input: Object.fromEntries(
        TOOLS.map((tool) => [tool, resolve(import.meta.dirname, tool, "index.html")]),
      ),
    },
  },
});
