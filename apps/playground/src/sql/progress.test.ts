import { describe, expect, it } from "vitest";

import { bootLabel, progressLabel } from "./progress";

describe("bootLabel", () => {
  it.each([
    [{ kind: "loading" } as const, "PGlite を読み込んでいます"],
    [{ kind: "seeding" } as const, "初期データを入れています"],
  ])("%o の間は、%s と出す", (phase, label) => {
    expect(bootLabel(phase)).toBe(label);
  });

  it.each([{ kind: "idle" } as const, { kind: "ready" } as const])(
    "%o の間は、何も出さない",
    (phase) => {
      expect(bootLabel(phase)).toBeUndefined();
    },
  );
});

describe("progressLabel", () => {
  it("実行していないときは、何も出さない", () => {
    expect(progressLabel({ kind: "ready" }, false)).toBeUndefined();
  });

  it("PGlite を読み込む間は、画面全体の待ちに任せて何も出さない", () => {
    expect(progressLabel({ kind: "loading" }, true)).toBeUndefined();
    expect(progressLabel({ kind: "seeding" }, true)).toBeUndefined();
  });

  it("読み込んだ後に実行している間は、SQL を実行しています と出す", () => {
    expect(progressLabel({ kind: "ready" }, true)).toBe("SQL を実行しています");
  });
});
