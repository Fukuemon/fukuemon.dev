import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { signSvg } from "./sign";

const file = readFileSync(new URL("./sign.svg", import.meta.url), "utf8");

describe("signSvg", () => {
  it("置いてある署名の SVG に、class と読み上げを隠す属性を足す", () => {
    expect(signSvg(file)).toMatch(
      /^<svg class="sign" aria-hidden="true" focusable="false" xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="0 0 3566 1252"/,
    );
  });

  it("ファイルを替えると、出力の path も替わる", () => {
    const other =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 5"><path d="M0 0H10V5Z"/></svg>';
    expect(signSvg(other)).toContain('<path d="M0 0H10V5Z"/>');
    expect(signSvg(other)).not.toBe(signSvg(file));
  });

  it("svg の中身は変えずに通す", () => {
    const own =
      '<svg viewBox="0 0 10 5"><g transform="scale(2)"><path fill-rule="evenodd" d="M0 0H5V2Z"/></g></svg>\n';
    expect(signSvg(own)).toBe(
      '<svg class="sign" aria-hidden="true" focusable="false" viewBox="0 0 10 5"><g transform="scale(2)"><path fill-rule="evenodd" d="M0 0H5V2Z"/></g></svg>',
    );
  });
});
