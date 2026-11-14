import { expect, test, type Page } from "@playwright/test";
import { seenBefore, settledCenterX } from "../support/visit";

// イントロの時刻は、開いてからの時間（performance.now）で決まるので、時計を固定しない。季節と時間帯は端末の日付と時刻のまま。
// SwiftShader は 1 フレームを描くのが遅く、場面の準備に数秒かかるので、テストの時間の上限を 3 倍にする
test.beforeEach(() => test.slow());
// SwiftShader で描く量を減らすため、16:9 の小さい画面で開く。イントロの段の順と時刻は、画面の大きさに依らない
test.use({ viewport: { width: 960, height: 540 }, colorScheme: "light" });

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
    const root = document.documentElement;
    new MutationObserver(() => {
      if (log.at(-1) !== root.className) log.push(root.className);
    }).observe(root, { attributes: true, attributeFilter: ["class"] });
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

/** プロフィールの文の、今の位置（px） */
const profileAt = (page: Page) =>
  profile(page).evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y) };
  });

/**
 * 動かずに最後の状態になった。操作の直後の文の位置が、カメラが止まった後の位置と同じで、文が遷移を経ずに見えている。
 * カメラが動いて寄るなら、直後の位置は止まった後の位置と違う。
 */
const expectJumpedToEnd = async (page: Page) => {
  const right = await profileAt(page);
  await expect(profile(page)).toHaveCSS("opacity", "1");
  await expectGardenEnd(page);
  const settled = await profileAt(page);
  expect(Math.abs(right.x - settled.x) + Math.abs(right.y - settled.y)).toBeLessThanOrEqual(2);
};

test("初めての端末で開くと、墨の絵の後に色を差して門をくぐり、決めた長さでプロフィールの文の前で止まり、その間も h1 がアクセシビリティツリーにある", async ({
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
  // 墨の絵を描き終える 3.8 秒より前には、色を差さない。色を差し始めてから 4.5 秒で終える。SwiftShader のフレームの間隔の分だけ遅れを許す
  expect(m["garden-enter"]).toBeGreaterThanOrEqual(3800);
  expect(m["garden-intro-done"]! - m["garden-enter"]!).toBeGreaterThanOrEqual(4500);
  expect(m["garden-intro-done"]! - m["garden-enter"]!).toBeLessThan(6000);
  await expectGardenEnd(page);
});

test("同じ端末で 2 回目に開くと、イントロを出さず、カメラを動かさずにプロフィールの文を出す", async ({
  page,
}) => {
  await page.goto("/");
  await expect(html(page)).toHaveClass(/\bintro\b/);
  await page.goto("/");
  await expect(html(page)).toHaveClass(/garden-ready/, { timeout: 30_000 });
  await expectJumpedToEnd(page);
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
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(html(page)).toHaveClass(/scene-ready/, { timeout: 30_000 });
    await expect(html(page)).toHaveClass(/\bintro\b/);
  });

  test("「飛ばす」を押すと、動かずに庭の中の最後の状態になり、フォーカスが h1 に移る", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "飛ばす" }).click();
    await expectJumpedToEnd(page);
    await expect(heading(page)).toBeFocused();
  });

  test("Tab を押すと、動かずに庭の中の最後の状態になる", async ({ page }) => {
    await page.keyboard.press("Tab");
    await expectJumpedToEnd(page);
  });

  test("Esc を押すと、動かずに庭の中の最後の状態になる", async ({ page }) => {
    await page.keyboard.press("Escape");
    await expectJumpedToEnd(page);
  });
});

test.describe("イントロの途中でふつうのページに戻る", () => {
  const INTRO_CLASSES = /\b(stage-on|intro|enter|scene-ready|garden-ready|no-anim)\b/;

  test("文が出てからカメラが止まるまでに「文だけで読む」を押すと、ふつうのページに戻り、イントロの class が後から付かない", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(html(page)).toHaveClass(/garden-ready/, { timeout: 60_000 });
    await page.getByRole("button", { name: "文だけで読む" }).click();
    await expect(heading(page)).toBeFocused();
    await expect(page.locator("[data-garden-stage]")).toBeHidden();
    // イントロを終える時刻（色を差してから 4.5 秒）を過ぎても、class を書き戻さない
    await page.waitForFunction(() => performance.now() > 12_000);
    await expect(html(page)).not.toHaveClass(INTRO_CLASSES);
  });

  test("門をくぐる途中で描く途中の例外が出ると、ふつうのページに戻り、イントロの class が残らない", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const draw = WebGL2RenderingContext.prototype.drawElements;
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
  });
});

test.describe("場面のバンドル", () => {
  test("場面のバンドルが届かないまま止まると、6 秒でふつうのページを出す", async ({ page }) => {
    // 応答を返さない。読み込みの失敗が届かないので、head の inline script の打ち切りだけが働く。バンドルを待つ間は load が来ないので、DOMContentLoaded まで待つ
    await page.route("**/_astro/garden-entry-*.js", () => {});
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(html(page)).toHaveClass(/stage-on/);
    await expect(html(page)).not.toHaveClass(/stage-on/, { timeout: 8000 });
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
    await expect(html(page)).not.toHaveClass(/stage-on/, { timeout: 8000 });
    await expect(heading(page)).toBeVisible();
  });
});
