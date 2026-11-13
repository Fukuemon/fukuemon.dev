import { toVsCodeTheme } from "@fukuemon/ui";
import { afterEach, describe, expect, it, vi } from "vitest";

import { colorScheme, toXtermTheme } from "./terminal-theme";

describe("toXtermTheme", () => {
  it("端末の背景、文字、カーソル、ANSI の 16 色を、VS Code の形式のテーマから写す", () => {
    const { colors } = toVsCodeTheme("light");
    const ansi = ["Black", "Red", "Green", "Yellow", "Blue", "Magenta", "Cyan", "White"];
    expect(toXtermTheme(toVsCodeTheme("light"))).toStrictEqual({
      background: colors["terminal.background"],
      foreground: colors["terminal.foreground"],
      cursor: colors["terminal.foreground"],
      ...Object.fromEntries(
        ansi.flatMap((name) => [
          [name.toLowerCase(), colors[`terminal.ansi${name}`]],
          [`bright${name}`, colors[`terminal.ansiBright${name}`]],
        ]),
      ),
    });
  });
});

describe("colorScheme", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const stub = (matches: boolean) => {
    const query = { matches, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    vi.stubGlobal("matchMedia", () => query);
    return query;
  };

  it.each([
    [true, "dark"],
    [false, "light"],
  ])("OS の設定がダークか: %s のときは %s を返す", (matches, expected) => {
    stub(matches);
    expect(colorScheme.getSnapshot()).toBe(expected);
  });

  it("matchMedia が無いときは、light を返す", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(colorScheme.getSnapshot()).toBe("light");
  });

  it("OS の設定の変化を購読し、外すと購読を外す", () => {
    const query = stub(true);
    const onChange = () => undefined;
    colorScheme.subscribe(onChange)();
    expect([query.addEventListener.mock.calls, query.removeEventListener.mock.calls]).toStrictEqual(
      [[["change", onChange]], [["change", onChange]]],
    );
  });

  it("matchMedia が無いときも、購読と解除で投げない", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(() => colorScheme.subscribe(() => undefined)()).not.toThrow();
  });
});
