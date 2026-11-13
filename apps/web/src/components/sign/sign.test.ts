import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { signSvg } from "./sign";

const file = readFileSync(new URL("./sign.svg", import.meta.url), "utf8");

describe("sign.svg", () => {
  it("README の形（viewBox を持つ svg と、塗った path が 1 本）である", () => {
    expect({
      svg: /^<svg\b[^>]*\bviewBox="[^"]+"/.test(file.trim()),
      paths: file.match(/<path\b/g)?.length,
      stroke: /\bstroke=/.test(file),
    }).toStrictEqual({ svg: true, paths: 1, stroke: false });
  });
});

describe("signSvg", () => {
  it("置いてある署名の SVG の先頭に、class と読み上げを隠す属性を足す", () => {
    expect(
      signSvg(file).startsWith('<svg class="sign" aria-hidden="true" focusable="false" '),
    ).toBe(true);
  });

  it("ファイルを替えると、出力の path も替わる", () => {
    const other =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 5"><path d="M0 0H10V5Z"/></svg>';
    expect(signSvg(other)).toContain('<path d="M0 0H10V5Z"/>');
  });

  it("svg の中身は変えずに通す", () => {
    const own =
      '<svg viewBox="0 0 10 5"><g transform="scale(2)"><path fill-rule="evenodd" d="M0 0H5V2Z"/></g></svg>\n';
    expect(signSvg(own)).toBe(
      '<svg class="sign" aria-hidden="true" focusable="false" viewBox="0 0 10 5"><g transform="scale(2)"><path fill-rule="evenodd" d="M0 0H5V2Z"/></g></svg>',
    );
  });

  it("class を渡すと、その class を付ける", () => {
    expect(signSvg('<svg viewBox="0 0 1 1"></svg>', "h-10")).toBe(
      '<svg class="h-10" aria-hidden="true" focusable="false" viewBox="0 0 1 1"></svg>',
    );
  });
});
