import "../playground.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { SqlPage } from "./SqlPage";

const root = document.getElementById("root");
if (!root) throw new Error("#root が無い");

createRoot(root).render(
  <StrictMode>
    <SqlPage embedded={window.self !== window.top} search={window.location.search} />
  </StrictMode>,
);
