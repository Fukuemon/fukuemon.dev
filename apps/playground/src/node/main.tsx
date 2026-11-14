import "../playground.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { NodePage } from "./NodePage";

const root = document.getElementById("root");
if (!root) throw new Error("#root が無い");

createRoot(root).render(
  <StrictMode>
    <NodePage embedded={window.self !== window.top} search={window.location.search} />
  </StrictMode>,
);
