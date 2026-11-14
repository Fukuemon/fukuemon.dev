import { describe, expect, it } from "vitest";

import { isTabFocusToggle } from "./terminal-keys";

const key = (
  modifiers: Partial<Record<"ctrlKey" | "shiftKey" | "altKey" | "metaKey", boolean>>,
) => ({
  code: "KeyM",
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  metaKey: false,
  ...modifiers,
});

describe("isTabFocusToggle", () => {
  it.each([
    ["Mac 以外の Ctrl+M は切り替える", key({ ctrlKey: true }), false, true],
    [
      "Mac 以外の Ctrl+Shift+M は切り替えない",
      key({ ctrlKey: true, shiftKey: true }),
      false,
      false,
    ],
    ["Mac の Shift+Alt+M は切り替える", key({ shiftKey: true, altKey: true }), true, true],
    ["Mac の Ctrl+M は切り替えない", key({ ctrlKey: true }), true, false],
    ["⌘ を押しているときは切り替えない", key({ ctrlKey: true, metaKey: true }), false, false],
    ["M 以外のキーは切り替えない", { ...key({ ctrlKey: true }), code: "KeyN" }, false, false],
  ])("%s", (_, event, mac, expected) => {
    expect(isTabFocusToggle(event, mac)).toBe(expected);
  });
});
