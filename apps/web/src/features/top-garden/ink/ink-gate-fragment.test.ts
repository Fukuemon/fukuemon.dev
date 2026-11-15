import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { inkGateFragment, inkGateVirtualModule } from "./ink-gate-fragment";

const SIGN = '<svg viewBox="0 0 1 1"><path d="M0 0"/></svg>';

describe("inkGateFragment", () => {
  it("墨の絵の SVG の後に、署名の SVG を続ける", () => {
    const html = inkGateFragment(SIGN);
    expect({
      ink: html.startsWith('<svg class="ink-svg"'),
      sign: html.endsWith(
        '<svg class="sign" aria-hidden="true" focusable="false" viewBox="0 0 1 1"><path d="M0 0"/></svg>',
      ),
    }).toStrictEqual({ ink: true, sign: true });
  });

  it("署名の SVG に差し替えても、墨の絵の部分は変わらない", () => {
    expect(inkGateFragment(SIGN)).toBe(inkGateFragment(SIGN));
    expect(inkGateFragment(SIGN)).not.toBe(inkGateFragment('<svg viewBox="0 0 2 2"/>'));
  });

  it("実際の署名の SVG を入れた全体が、gzip で 36 KiB 以内に収まる", () => {
    expect(gzipSync(inkGateFragment()).length).toBeLessThanOrEqual(36 * 1024);
  });
});

describe("inkGateVirtualModule", () => {
  const plugin = inkGateVirtualModule();

  it("virtual:ink-gate だけを解決する", () => {
    expect([plugin.resolveId("virtual:ink-gate"), plugin.resolveId("./other")]).toStrictEqual([
      "\0virtual:ink-gate",
      undefined,
    ]);
  });

  it("解決した id の中身を、フラグメントの文字列の default export にする", () => {
    const code = plugin.load("\0virtual:ink-gate");
    expect(code).toBe(`export default ${JSON.stringify(inkGateFragment())};`);
    expect(plugin.load("./other")).toBeUndefined();
  });
});
