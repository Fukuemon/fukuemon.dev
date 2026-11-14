import { expect, test, type Page } from "@playwright/test";
import { settledCenterX } from "../support/camera";
import { seenBefore } from "../support/visit";

// イントロの時刻は、開いてからの時間（performance.now）で決まるので、時計を固定しない。季節と時間帯は端末の日付と時刻のまま。
// SwiftShader は 1 フレームを描くのが遅く、場面の準備に数秒かかるので、テストの時間の上限を 3 倍にする
test.beforeEach(() => test.slow());
// SwiftShader で描く量を減らすため、16:9 の小さい画面で開く。イントロの段の順と時刻は、画面の大きさに依らない
test.use({ viewport: { width: 480, height: 270 }, colorScheme: "light" });

const html = (page: Page) => page.locator("html");
const profile = (page: Page) => page.locator('[data-garden-card][aria-labelledby="profile"]');
const heading = (page: Page) => page.getByRole("heading", { level: 1, name: "プロフィール" });

interface ClassLog {
  __classes: string[];
}

/** html の class が変わるたびに、変わった後の class を記録する。イントロの段の順を、後から確かめるためである */
const recordClasses = (page: Page) =>
  page.addInitScript(() => {
    const log: string[] = [];
    (window as unknown as ClassLog).__classes = log;
    // init script の時点では html の要素がまだ無いので、document の下の全体を見て、html の変化だけを拾う
    new MutationObserver((records) => {
      const root = document.documentElement;
      if (!records.some((r) => r.target === root)) return;
      if (log.at(-1) !== root.className) log.push(root.className);
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ["class"] });
  });

/** 色を差し始めた時刻と、イントロを終えた時刻（ms） */
const marks = (page: Page) =>
  page.evaluate(() =>
    Object.fromEntries(
      performance.getEntriesByType("mark").map((m) => [m.name, Math.round(m.startTime)]),
    ),
  );

/** 庭の中の最後の状態で、カメラが止まり、プロフィールの文だけが正面に見えている */
const expectGardenEnd = async (page: Page) => {
  await expect(html(page)).toHaveClass(/garden-ready/);
  await expect(html(page)).not.toHaveClass(/\bintro\b/);
  await expect(page.locator("[data-garden-card].is-current")).toHaveAttribute(
    "aria-labelledby",
    "profile",
  );
  await expect(page.getByRole("button", { name: "飛ばす" })).toBeHidden();
  await expect(page.getByRole("button", { name: "プロフィール" })).toBeVisible();
  await expect
    .poll(
      async () => {
        const x = await settledCenterX(profile(page));
        return x !== null && Math.abs(x - 0.5) < 0.1;
      },
      { timeout: 45_000 },
    )
    .toBe(true);
};

/** プロフィールの文の、今の中心の位置（px）と不透明度。待たずに 1 回だけ読む。文の高さは字の読み込みで変わるが、中心は変わらない */
const profileAt = (page: Page) =>
  profile(page).evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      x: Math.round(r.x + r.width / 2),
      y: Math.round(r.y + r.height / 2),
      opacity: getComputedStyle(el).opacity,
    };
  });

/** カメラが動かずに最後の位置にある。操作の直後の文の位置が、カメラが止まった後の位置と同じ */
const expectCameraAtEnd = async (page: Page) => {
  const right = await profileAt(page);
  await expectGardenEnd(page);
  const settled = await profileAt(page);
  expect(Math.abs(right.x - settled.x) + Math.abs(right.y - settled.y)).toBeLessThanOrEqual(6);
  return right;
};

test("初めての端末で開くと、墨の絵の後に色を差して門をくぐり、決めた長さより前には終えずにプロフィールの文の前で止まり、その間も h1 がアクセシビリティツリーにある", async ({
  page,
}) => {
  await recordClasses(page);
  // 場面のバンドルは load の後に動くので、DOMContentLoaded で、イントロの墨の絵の間を確かめる
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(html(page)).toHaveClass(/\bintro\b/);
  await expect(page.locator(".ink-svg")).toBeVisible();
  await expect(heading(page)).toHaveCount(1);
  await expect(html(page)).not.toHaveClass(/\bintro\b/, { timeout: 60_000 });
  const states = await page.evaluate(() => (window as unknown as ClassLog).__classes);
  const at = (cls: string) => states.findIndex((s) => s.split(" ").includes(cls));
  // 色を差して門をくぐる間も、イントロのまま。文とヘッダーを出してから、イントロを終える
  expect(states[0]!.split(" ")).toContain("intro");
  expect(at("enter")).toBeGreaterThan(0);
  expect(states[at("enter")]!.split(" ")).toContain("intro");
  expect(states[at("garden-ready")]!.split(" ")).toContain("intro");
  expect(states.at(-1)!.split(" ")).not.toContain("intro");
  const m = await marks(page);
  // 墨の絵を描き終える 3.8 秒より前には色を差さず、色を差し始めてから 4.5 秒より前には終えない。
  // CI の SwiftShader はメインスレッドを止めて時刻が後ろへずれるので、時刻の上限は見ない。上限は GPU のある手元で確かめる
  expect(m["garden-enter"]).toBeGreaterThanOrEqual(3790);
  expect(m["garden-intro-done"]! - m["garden-enter"]!).toBeGreaterThanOrEqual(4500);
  await expectGardenEnd(page);
});

test("同じ端末で 2 回目に開くと、イントロを出さず、カメラを動かさずにプロフィールの文を出す", async ({
  page,
}) => {
  // 1 回目は、head の inline script が記録を書いた時点で離れる
  await page.goto("/", { waitUntil: "commit" });
  await expect(html(page)).toHaveClass(/stage-on/);
  await page.goto("/");
  await expect(html(page)).toHaveClass(/garden-ready/, { timeout: 30_000 });
  await expectCameraAtEnd(page);
  await expect(page.locator(".ink-svg")).toBeHidden();
  expect(await marks(page)).not.toHaveProperty("garden-enter");
});

test("動きを減らす設定で開くと、イントロも庭も出さず、ふつうのページを出す", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(html(page)).not.toHaveClass(/stage-on|intro/);
  await expect(page.locator("[data-garden-stage]")).toBeHidden();
  await expect(page.locator(".ink-svg")).toBeHidden();
  await expect(heading(page)).toBeVisible();
});

test.describe("イントロの途中", () => {
  interface Jumped {
    __jumped?: { x: number; y: number; opacity: string };
  }

  /**
   * html に class `at` が付いた時点で、ページの中から飛ばす操作をし、直後の文の位置と不透明度を記録する。
   * SwiftShader のフレームはメインスレッドを長く止めるので、テストの側から押すと、押す前にイントロが進むか終わる。
   */
  const jumpAt = (page: Page, at: "scene-ready" | "enter", how: "skip" | "Escape" | "Tab") =>
    page.addInitScript(
      ({ at, how }) => {
        new MutationObserver((_, observer) => {
          const root = document.documentElement;
          if (!root.classList.contains(at) || !root.classList.contains("intro")) return;
          observer.disconnect();
          if (how === "skip")
            document.querySelector<HTMLButtonElement>("[data-garden-skip]")?.click();
          else
            document.body.dispatchEvent(new KeyboardEvent("keydown", { key: how, bubbles: true }));
          const el = document.querySelector('[data-garden-card][aria-labelledby="profile"]')!;
          const r = el.getBoundingClientRect();
          (window as Jumped).__jumped = {
            x: Math.round(r.x + r.width / 2),
            y: Math.round(r.y + r.height / 2),
            opacity: getComputedStyle(el).opacity,
          };
        }).observe(document, { subtree: true, attributes: true, attributeFilter: ["class"] });
      },
      { at, how },
    );

  /** 飛ばした直後に、文が遷移を経ずに見え、カメラが止まった後の位置と同じ所にあった。カメラが寄るなら数十 px ずれるので、描き直しの丸めの分の 6px までは許す */
  const expectJumped = async (page: Page) => {
    await expect
      .poll(() => page.evaluate(() => (window as Jumped).__jumped), { timeout: 60_000 })
      .toBeTruthy();
    const right = (await page.evaluate(() => (window as Jumped).__jumped))!;
    expect(right.opacity).toBe("1");
    await expectGardenEnd(page);
    const settled = await profileAt(page);
    expect(Math.abs(right.x - settled.x) + Math.abs(right.y - settled.y)).toBeLessThanOrEqual(6);
    await expect(html(page)).not.toHaveClass(/no-anim/);
    expect(await marks(page)).toHaveProperty("garden-intro-done");
  };

  test("「飛ばす」を押すと、動かずに庭の中の最後の状態になり、フォーカスが h1 に移る", async ({
    page,
  }) => {
    await jumpAt(page, "scene-ready", "skip");
    await page.goto("/");
    await expectJumped(page);
    await expect(heading(page)).toBeFocused();
  });

  test("Tab を押すと、動かずに庭の中の最後の状態になる", async ({ page }) => {
    await jumpAt(page, "scene-ready", "Tab");
    await page.goto("/");
    await expectJumped(page);
  });

  test("Esc を押すと、動かずに庭の中の最後の状態になり、フォーカスを動かさない", async ({
    page,
  }) => {
    await jumpAt(page, "scene-ready", "Escape");
    await page.goto("/");
    await expectJumped(page);
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
  });

  test("門をくぐる途中で Esc を押すと、動かずに庭の中の最後の状態になる", async ({ page }) => {
    await jumpAt(page, "enter", "Escape");
    await page.goto("/");
    await expectJumped(page);
  });
});

test.describe("「飛ばす」の色と位置", () => {
  // ライトのテーマの紙と墨の色は昼の霞の色と同じトークンなので、時間帯に依らず色が替わるダークのテーマで見る
  test.use({ colorScheme: "dark" });

  interface SkipLog {
    __skip?: { ink: string[]; gaps: number[]; enter: string[] };
  }

  test("墨の絵の間はテーマの色で狭い画面の端から 0.5rem に出し、色を差し始めると庭の中のボタンと同じ時間帯の色にする", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const log = { ink: [] as string[], gaps: [] as number[], enter: [] as string[] };
      (window as unknown as SkipLog).__skip = log;
      const colors = (s: CSSStyleDeclaration) => [s.backgroundColor, s.borderTopColor, s.color];
      new MutationObserver((_, observer) => {
        const root = document.documentElement;
        const el = document.querySelector<HTMLElement>("[data-garden-skip]");
        if (!el) return;
        if (root.classList.contains("scene-ready") && !log.gaps.length) {
          const r = el.getBoundingClientRect();
          log.gaps = [Math.round(innerWidth - r.right), Math.round(innerHeight - r.bottom)];
          log.ink = colors(getComputedStyle(el));
        }
        if (!root.classList.contains("enter")) return;
        observer.disconnect();
        log.enter = colors(getComputedStyle(el));
      }).observe(document, { subtree: true, attributes: true, attributeFilter: ["class"] });
    });
    await page.goto("/");
    await expect(html(page)).not.toHaveClass(/\bintro\b/, { timeout: 60_000 });
    await expectGardenEnd(page);
    const skip = (await page.evaluate(() => (window as unknown as SkipLog).__skip))!;
    // 今いる場所のボタンは色を反転するので、今いない「経歴」と比べる
    const station = await page.getByRole("button", { name: "経歴" }).evaluate((el) => {
      const s = getComputedStyle(el);
      return [s.backgroundColor, s.borderTopColor, s.color];
    });
    expect(skip.gaps).toStrictEqual([8, 8]);
    expect(skip.enter).toStrictEqual(station);
    expect(skip.ink[0]).not.toBe(skip.enter[0]);
  });
});

test.describe("場面の準備が遅いとき", () => {
  // バンドルの応答を遅らせ、場面の準備を遅くする
  const delayBundle = (page: Page, ms: number) =>
    page.route("**/_astro/garden-entry-*.js", async (route) => {
      await new Promise((r) => setTimeout(r, ms));
      await route.continue();
    });

  test("準備ができるまでは、「飛ばす」を出さず、Tab を受けない", async ({ page }) => {
    await delayBundle(page, 2000);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(html(page)).toHaveClass(/\bintro\b/);
    await expect(page.getByRole("button", { name: "飛ばす" })).toBeHidden();
    await page.keyboard.press("Tab");
    await expect(html(page)).toHaveClass(/\bintro\b/);
    await expect(html(page)).not.toHaveClass(/scene-ready|garden-ready/);
    await expect(page.getByRole("button", { name: "飛ばす" })).toBeVisible({ timeout: 60_000 });
  });

  test("HTML が遅く届いても、墨の線を描き終えてから色を差し始める", async ({ page }) => {
    // 色を差し始めた時点で、まだ動いている墨の線の遷移の数を記録する。enter で始まる、線を消す遷移は数えない
    await page.addInitScript(() => {
      new MutationObserver((_, observer) => {
        const root = document.documentElement;
        if (!root.classList.contains("enter")) return;
        observer.disconnect();
        const left = document
          .querySelector(".ink-gate")!
          .getAnimations({ subtree: true })
          .filter(
            (a) =>
              a.playState === "running" &&
              (a as CSSTransition).transitionProperty === "stroke-dashoffset",
          ).length;
        (window as unknown as { __inkLeft: number }).__inkLeft = left;
      }).observe(document, { subtree: true, attributes: true, attributeFilter: ["class"] });
    });
    await page.route("/", async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(html(page)).toHaveClass(/\benter\b/, { timeout: 60_000 });
    expect(await page.evaluate(() => (window as unknown as { __inkLeft: number }).__inkLeft)).toBe(
      0,
    );
  });

  test("準備が遅くても、準備が終わり、墨の絵を描き終えてから色を差し始める", async ({ page }) => {
    // 長く遅らせると、CI の負荷でバンドルが 6 秒までに動き始めず、打ち切りでふつうのページになる
    await delayBundle(page, 2000);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(html(page)).toHaveClass(/\benter\b/, { timeout: 60_000 });
    const m = await marks(page);
    // 準備の直後に差すかは時刻の上限なので、GPU のあるローカル環境で測る。ここでは順序と下限だけを見る
    expect(m["garden-enter"]).toBeGreaterThanOrEqual(m["garden-scene-ready"]!);
    expect(m["garden-enter"]).toBeGreaterThanOrEqual(3790);
  });
});

test.describe("イントロの途中でふつうのページに戻る", () => {
  const INTRO_CLASSES = /\b(stage-on|intro|enter|scene-ready|garden-ready|no-anim)\b/;

  test("文が出てからカメラが止まるまでに「文だけで読む」を押すと、ふつうのページに戻り、イントロの class が後から付かない", async ({
    page,
  }) => {
    await recordClasses(page);
    // 文が出てからカメラが止まるまでは 0.8 秒しかないので、garden-ready が付いた時点で、ページの中から押す
    await page.addInitScript(() => {
      new MutationObserver((_, observer) => {
        const root = document.documentElement;
        if (!root.classList.contains("garden-ready") || !root.classList.contains("intro")) return;
        observer.disconnect();
        document.querySelector<HTMLButtonElement>("[data-garden-plain]")?.click();
      }).observe(document, { subtree: true, attributes: true, attributeFilter: ["class"] });
    });
    await page.goto("/");
    await expect(heading(page)).toBeFocused({ timeout: 60_000 });
    // 押した時点で、まだイントロの途中だった
    const states = await page.evaluate(() => (window as unknown as ClassLog).__classes);
    const left = states.findIndex((s) => !s.split(" ").includes("stage-on"));
    expect(states[left - 1]!.split(" ")).toContain("intro");
    await expect(page.locator("[data-garden-stage]")).toBeHidden();
    // イントロを終える時刻（色を差してから 4.5 秒）を過ぎても、class を書き戻さない
    await page.waitForFunction(() => performance.now() > 12_000);
    await expect(html(page)).not.toHaveClass(INTRO_CLASSES);
  });

  test("飛ばして最後の状態を描く途中で例外が出ると、ふつうのページに戻り、イントロの class と今いる文の印が残らない", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const proto = WebGL2RenderingContext.prototype;
      const draw = Object.getOwnPropertyDescriptor(proto, "drawElements")!
        .value as typeof proto.drawElements;
      WebGL2RenderingContext.prototype.drawElements = function (...args) {
        if (document.documentElement.classList.contains("no-anim")) throw new Error("描画の失敗");
        return draw.apply(this, args);
      };
    });
    // 場面の準備ができた時点で、ページの中から Esc を押す
    await page.addInitScript(() => {
      new MutationObserver((_, observer) => {
        if (!document.documentElement.classList.contains("scene-ready")) return;
        observer.disconnect();
        document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      }).observe(document, { subtree: true, attributes: true, attributeFilter: ["class"] });
    });
    await page.goto("/");
    await expect(page.locator("[data-garden-stage]")).toBeHidden();
    await expect(html(page)).not.toHaveClass(INTRO_CLASSES);
    await expect(page.locator("[data-garden-card].is-current")).toHaveCount(0);
    expect(await marks(page)).not.toHaveProperty("garden-intro-done");
  });

  test("門をくぐる途中で描く途中の例外が出ると、ふつうのページに戻り、イントロの class が残らない", async ({
    page,
  }) => {
    await recordClasses(page);
    await page.addInitScript(() => {
      const proto = WebGL2RenderingContext.prototype;
      const draw = Object.getOwnPropertyDescriptor(proto, "drawElements")!
        .value as typeof proto.drawElements;
      WebGL2RenderingContext.prototype.drawElements = function (...args) {
        if (document.documentElement.classList.contains("enter")) throw new Error("描画の失敗");
        return draw.apply(this, args);
      };
    });
    await page.goto("/");
    await expect(page.locator("[data-garden-stage]")).toBeHidden({ timeout: 60_000 });
    await expect(html(page)).not.toHaveClass(INTRO_CLASSES);
    await expect(heading(page)).toBeVisible();
    await expect(page.locator("[data-garden-card][style]")).toHaveCount(0);
    // 色を差し始めた後に描けなくなった
    const states = await page.evaluate(() => (window as unknown as ClassLog).__classes);
    expect(states.some((s) => s.split(" ").includes("enter"))).toBe(true);
  });
});

test.describe("場面のバンドル", () => {
  test("場面のバンドルが届かないまま止まると、6 秒でふつうのページを出す", async ({ page }) => {
    // 応答を返さない。読み込みの失敗が届かないので、head の inline script の打ち切りだけが働く。バンドルを待つ間は load が来ないので、DOMContentLoaded まで待つ
    await page.route("**/_astro/garden-entry-*.js", () => {});
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(html(page)).toHaveClass(/stage-on/);
    await expect(html(page)).not.toHaveClass(/stage-on/, { timeout: 30_000 });
    const at = await page.evaluate(() => performance.now());
    expect(at).toBeGreaterThanOrEqual(6000);
    await expect(page.locator("[data-garden-stage]")).toBeHidden();
    await expect(heading(page)).toBeVisible();
  });

  test("2 回目の訪問でも、場面のバンドルが届かないまま止まると、6 秒でふつうのページを出す", async ({
    page,
  }) => {
    await seenBefore(page);
    await page.route("**/_astro/garden-entry-*.js", () => {});
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(html(page)).toHaveClass(/stage-on/);
    await expect(html(page)).not.toHaveClass(/stage-on/, { timeout: 30_000 });
    expect(await page.evaluate(() => performance.now())).toBeGreaterThanOrEqual(6000);
    await expect(heading(page)).toBeVisible();
  });

  test("初めての訪問で場面のバンドルの読み込みに失敗すると、墨の絵を消してふつうのページを出す", async ({
    page,
  }) => {
    await page.route("**/_astro/garden-entry-*.js", (route) => route.abort());
    await page.goto("/");
    await expect(html(page)).not.toHaveClass(/stage-on|intro/);
    await expect(page.locator(".ink-svg")).toBeHidden();
    await expect(heading(page)).toBeVisible();
  });
});
