import { describe, expect, it } from "vitest";

import { bootLabel, progressLabel } from "./progress";

const failed = { kind: "failed", error: { message: "PGlite を読み込めませんでした" } } as const;

describe("bootLabel", () => {
  it.each([{ kind: "loading" } as const, { kind: "seeding" } as const])(
    "%o の間は、同じ文 PGlite を読み込んでいます を出す",
    (phase) => {
      expect(bootLabel(phase)).toBe("PGlite を読み込んでいます");
    },
  );

  it.each([{ kind: "idle" } as const, { kind: "ready" } as const, failed])(
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

  it.each([{ kind: "loading" } as const, { kind: "seeding" } as const])(
    "%o の間は、画面全体の待ちに任せて何も出さない",
    (phase) => {
      expect(progressLabel(phase, true)).toBeUndefined();
    },
  );

  it.each([{ kind: "ready" } as const, failed])(
    "%o で実行している間は、SQL を実行しています と出す",
    (phase) => {
      expect(progressLabel(phase, true)).toBe("SQL を実行しています");
    },
  );
});
