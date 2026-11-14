import { describe, expect, it } from "vitest";

import { languageOf } from "./language";

describe("languageOf", () => {
  it.each([
    ["index.js", { kind: "javascript", jsx: false, typescript: false }],
    ["a.MJS", { kind: "javascript", jsx: false, typescript: false }],
    ["a.cjs", { kind: "javascript", jsx: false, typescript: false }],
    ["App.jsx", { kind: "javascript", jsx: true, typescript: false }],
    ["a.ts", { kind: "javascript", jsx: false, typescript: true }],
    ["a.mts", { kind: "javascript", jsx: false, typescript: true }],
    ["a.cts", { kind: "javascript", jsx: false, typescript: true }],
    ["App.tsx", { kind: "javascript", jsx: true, typescript: true }],
    ["package.json", { kind: "json" }],
    ["README.md", undefined],
    ["Makefile", undefined],
  ])("%s の言語は %o", (path, expected) => {
    expect(languageOf(path)).toStrictEqual(expected);
  });
});
