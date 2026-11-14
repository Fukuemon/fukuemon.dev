import { describe, expect, it } from "vitest";

import { portOfOrigin } from "./preview-origin";

const open = new Map([
  [3000, "https://abc--3000--x.local-corp.webcontainer-api.io"],
  [4000, "not a url"],
]);

describe("portOfOrigin", () => {
  it.each([
    ["待ち受けているポートの origin", "https://abc--3000--x.local-corp.webcontainer-api.io", 3000],
    ["ほかの origin", "https://evil.example", undefined],
    ["URL として読めないポートしか無い origin", "not a url", undefined],
  ])("%s（%s）には、%s を返す", (_, origin, port) => {
    expect(portOfOrigin(open, origin)).toBe(port);
  });
});
