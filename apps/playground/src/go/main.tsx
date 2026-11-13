import "../playground.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { GoPage } from "./GoPage";

const root = document.getElementById("root");
if (!root) throw new Error("#root が無い");

createRoot(root).render(
  <StrictMode>
    <GoPage embedded={window.self !== window.top} search={window.location.search} />
  </StrictMode>,
);
