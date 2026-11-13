import { describe, expect, it } from "vitest";

import { progressLabel } from "./progress";

describe("progressLabel", () => {
  it("実行していないときは、何も出さない", () => {
    expect(progressLabel({ kind: "loading" }, false)).toBeUndefined();
  });

  it.each([
    [{ kind: "loading" } as const, "PGlite を読み込んでいます"],
    [{ kind: "seeding" } as const, "初期データを入れています"],
    [{ kind: "ready" } as const, "SQL を実行しています"],
  ])("%o の間は、%s と出す", (phase, label) => {
    expect(progressLabel(phase, true)).toBe(label);
  });
});
