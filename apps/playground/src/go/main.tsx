import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const root = document.getElementById("root");
if (!root) throw new Error("#root が無い");

createRoot(root).render(
  <StrictMode>
    <main>
      <h1>Go の実行環境</h1>
    </main>
  </StrictMode>,
);
