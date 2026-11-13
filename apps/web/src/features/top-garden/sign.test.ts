import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { signSvg } from "./sign";

const file = readFileSync(new URL("./sign.svg", import.meta.url), "utf8");

describe("signSvg", () => {
  it("置いてある署名の SVG を、class と読み上げを隠す属性を付けた 1 本の path にする", () => {
    const out = signSvg(file);
    expect(out).toMatch(
      /^<svg class="sign" viewBox="0 0 3566 1252" aria-hidden="true" focusable="false"><path d="M388 952Q/,
    );
    expect(out.match(/<path /g)).toHaveLength(1);
  });

  it("ファイルを替えると、出力の path も替わる", () => {
    const other =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 5"><path d="M0 0H10V5Z"/></svg>';
    expect(signSvg(other)).toBe(
      '<svg class="sign" viewBox="0 0 10 5" aria-hidden="true" focusable="false"><path d="M0 0H10V5Z"/></svg>',
    );
  });

  it("書体の情報（data-source）を出力に残さない", () => {
    expect(signSvg(file)).not.toContain("data-source");
  });

  it.each([
    ["viewBox がない", '<svg><path d="M0 0Z"/></svg>'],
    ["path が 2 本ある", '<svg viewBox="0 0 1 1"><path d="M0 0Z"/><path d="M1 1Z"/></svg>'],
    ["path がない", '<svg viewBox="0 0 1 1"></svg>'],
    ["線で描いている", '<svg viewBox="0 0 1 1"><path d="M0 0L1 1" stroke="#000"/></svg>'],
    ["塗りを消している", '<svg viewBox="0 0 1 1"><path d="M0 0L1 1" fill="none"/></svg>'],
    ["d がない", '<svg viewBox="0 0 1 1"><path/></svg>'],
    ["svg がない", '<path d="M0 0Z"/>'],
  ])("%s ときは、例外を投げる", (_, src) => {
    expect(() => signSvg(src)).toThrow();
  });
});
