import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { seasonOf, timeOfDayOf } from "./season";
import { applyStage, readOverride, stageScript, type StageEnv } from "./stage";
import { takeFirstVisit } from "./visit";
import { SETTINGS_CHANGE, type SettingsChange } from "../../../components/site-settings/settings";

const fns = { seasonOf, timeOfDayOf, takeFirstVisit };
const NOV_13_20H = new Date(2026, 10, 13, 20);

function memory(seen = false) {
  const items = new Map<string, string>(seen ? [["fd-top-seen", "1"]] : []);
  return {
    items,
    getItem: (k: string) => items.get(k) ?? null,
    setItem: (k: string, v: string) => void items.set(k, v),
  };
}

function fakeRoot() {
  const classes = new Set<string>();
  const listeners = new Map<string, (e: { detail: unknown }) => void>();
  return {
    dataset: {} as DOMStringMap,
    classes,
    listeners,
    addEventListener: (type: string, fn: (e: { detail: unknown }) => void) =>
      void listeners.set(type, fn),
    classList: {
      add: (...c: string[]) => c.forEach((v) => classes.add(v)),
      remove: (...c: string[]) => c.forEach((v) => classes.delete(v)),
      contains: (c: string) => classes.has(c),
    },
  };
}

function run(
  o: Partial<Omit<StageEnv, "root" | "storage">> & {
    seen?: boolean;
    motion?: "on" | "off";
    garden?: "on" | "off";
  } = {},
) {
  const root = fakeRoot();
  root.dataset.motion = o.motion ?? "on";
  root.dataset.garden = o.garden ?? "on";
  const store = memory(o.seen);
  const loads: (() => void)[] = [];
  const timers: { fn: () => void; ms: number }[] = [];
  applyStage(
    {
      root,
      now: NOV_13_20H,
      override: {},
      introAgain: false,
      storage: () => store,
      load: (onError) => void loads.push(onError),
      later: (fn, ms) => void timers.push({ fn, ms }),
      ...o,
    },
    fns,
  );
  return { root, store, loads, timers };
}

const summary = ({ root, store, loads }: ReturnType<typeof run>) => ({
  season: root.dataset.season,
  time: root.dataset.time,
  classes: [...root.classes].sort(),
  seen: store.items.get("fd-top-seen") ?? null,
  loaded: loads.length,
});

describe("applyStage", () => {
  it("11 月の 20 時に初めて開くと、秋と夜を書き、記録して、イントロを出して場面のバンドルを読み込む", () => {
    expect(summary(run())).toStrictEqual({
      season: "autumn",
      time: "night",
      classes: ["intro", "stage-on"],
      seen: "1",
      loaded: 1,
    });
  });

  it("同じ端末で 2 回目に開くと、イントロを出さずに庭を出す", () => {
    expect(summary(run({ seen: true }))).toStrictEqual({
      season: "autumn",
      time: "night",
      classes: ["stage-on"],
      seen: "1",
      loaded: 1,
    });
  });

  it("庭の表示がオフのときは、季節と時間帯を書いて記録し、場面のバンドルを読み込まない", () => {
    expect(summary(run({ garden: "off" }))).toStrictEqual({
      season: "autumn",
      time: "night",
      classes: [],
      seen: "1",
      loaded: 0,
    });
  });

  it("アニメーションがオフのときは、初めて開いてもイントロを出さずに庭を出し、記録する", () => {
    expect(summary(run({ motion: "off" }))).toStrictEqual({
      season: "autumn",
      time: "night",
      classes: ["stage-on"],
      seen: "1",
      loaded: 1,
    });
  });

  it("「イントロをもう一度見る」から開くと、2 回目でもイントロを出す", () => {
    expect(summary(run({ seen: true, introAgain: true })).classes).toStrictEqual([
      "intro",
      "stage-on",
    ]);
  });

  it("「イントロをもう一度見る」から開いても、アニメーションがオフならイントロを出さない", () => {
    expect(summary(run({ seen: true, introAgain: true, motion: "off" })).classes).toStrictEqual([
      "stage-on",
    ]);
  });

  it("場面のバンドルが無いときは、季節と時間帯を書いて記録し、庭を出さない", () => {
    expect(summary(run({ load: null }))).toStrictEqual({
      season: "autumn",
      time: "night",
      classes: [],
      seen: "1",
      loaded: 0,
    });
  });

  it("場面のバンドルの読み込みに失敗すると、2 つの class を外し、記録は残す", () => {
    const r = run();
    r.loads[0]!();
    expect({ classes: [...r.root.classes], seen: r.store.items.get("fd-top-seen") }).toStrictEqual({
      classes: [],
      seen: "1",
    });
  });

  it("6 秒の後に場面の準備ができていないと、2 つの class を外し、記録は残す", () => {
    const r = run();
    r.timers[0]!.fn();
    expect({
      ms: r.timers.map((t) => t.ms),
      classes: [...r.root.classes],
      seen: r.store.items.get("fd-top-seen"),
    }).toStrictEqual({ ms: [6000], classes: [], seen: "1" });
  });

  it("6 秒の後に場面の準備ができていれば、庭を出したままにする", () => {
    const r = run({ seen: true });
    r.root.classList.add("scene-ready");
    r.timers[0]!.fn();
    expect([...r.root.classes].sort()).toStrictEqual(["scene-ready", "stage-on"]);
  });

  it("庭の表示がオフのときは、6 秒の打ち切りを仕掛けない", () => {
    expect(run({ garden: "off" }).timers).toStrictEqual([]);
  });

  it("localStorage に触れると例外を投げる端末では、季節と時間帯を書き、イントロを出さずに庭を出す", () => {
    const root = fakeRoot();
    applyStage(
      {
        root,
        now: NOV_13_20H,
        override: {},
        introAgain: false,
        storage: () => {
          throw new DOMException("blocked", "SecurityError");
        },
        load: () => {},
        later: () => {},
      },
      fns,
    );
    expect([root.dataset.season, root.dataset.time, [...root.classes]]).toStrictEqual([
      "autumn",
      "night",
      ["stage-on"],
    ]);
  });

  it("引数で選んだ季節と時間帯を、端末の日付と時刻より先に使う", () => {
    const { root } = run({ override: { season: "spring", time: "morning" } });
    expect([root.dataset.season, root.dataset.time]).toStrictEqual(["spring", "morning"]);
  });
});

describe("readOverride", () => {
  it("決めた値の season と time を読む", () => {
    expect(readOverride("?season=winter&time=evening")).toStrictEqual({
      season: "winter",
      time: "evening",
    });
  });

  it("決めた値のほかは無視する", () => {
    expect(readOverride("?season=rainy&time=noon")).toStrictEqual({});
  });

  it("引数が無いときは、何も選ばない", () => {
    expect(readOverride("")).toStrictEqual({});
  });
});

// inline script と同じく、外の名前の無い文脈で、ブラウザの値だけを渡して動かす
function browser(search = "") {
  const root = fakeRoot();
  const replaced: string[] = [];
  const store = memory();
  const globals = {
    document: { documentElement: root },
    localStorage: store,
    location: { search, pathname: "/", hash: "" },
    history: {
      state: null,
      replaceState: (_: unknown, __: string, url: string) => void replaced.push(url),
    },
    matchMedia: () => ({ matches: false }),
    setTimeout: () => {},
    URLSearchParams,
    Date: class extends Date {
      constructor() {
        super(NOV_13_20H);
      }
    },
  };
  return { root, store, globals, replaced };
}

describe("stageScript", () => {
  it("本番の文字列は、季節と時間帯の URL の引数を読む処理を持たない", () => {
    expect(/get\("season"\)|get\("time"\)/.test(stageScript({ dev: false }))).toBe(false);
  });

  it("URL の引数 intro があると、2 回目でもイントロを出し、引数を URL から消す", () => {
    const b = browser("?intro");
    b.store.items.set("fd-top-seen", "1");
    runInNewContext(stageScript({ dev: false, bundle: "/_astro/scene.js" }), {
      ...b.globals,
      document: {
        documentElement: b.root,
        createElement: () => ({}),
        head: { appendChild: () => {} },
      },
    });
    expect({ classes: [...b.root.classes].sort(), replaced: b.replaced }).toStrictEqual({
      classes: ["intro", "stage-on"],
      replaced: ["/"],
    });
  });

  it("URL の引数 intro を消すときは、ほかの引数を残す", () => {
    const b = browser("?intro&season=winter");
    runInNewContext(stageScript({ dev: true }), b.globals);
    expect(b.replaced).toStrictEqual(["/?season=winter"]);
  });

  it("庭を出しているときは、歯車の設定で庭の表示をオンにしても読み込み直さない", () => {
    const b = browser();
    let reloads = 0;
    runInNewContext(stageScript({ dev: false }), {
      ...b.globals,
      location: { ...b.globals.location, reload: () => void reloads++ },
    });
    b.root.classList.add("stage-on");
    b.root.listeners.get(SETTINGS_CHANGE)?.({ detail: { name: "garden", on: true } });
    expect(reloads).toBe(0);
  });

  it("本番の文字列を動かすと、引数を無視して端末の日付と時刻を書き、記録し、庭を出さない", () => {
    const b = browser("?season=winter&time=morning");
    runInNewContext(stageScript({ dev: false }), b.globals);
    expect({
      season: b.root.dataset.season,
      time: b.root.dataset.time,
      classes: [...b.root.classes],
      seen: b.store.items.get("fd-top-seen"),
    }).toStrictEqual({ season: "autumn", time: "night", classes: [], seen: "1" });
  });

  it("庭を出していないときに、歯車の設定で庭の表示をオンにすると読み込み直し、ほかの変更では読み込み直さない", () => {
    const b = browser();
    let reloads = 0;
    runInNewContext(stageScript({ dev: false }), {
      ...b.globals,
      location: { ...b.globals.location, reload: () => void reloads++ },
    });
    const fire = (detail: SettingsChange) => b.root.listeners.get(SETTINGS_CHANGE)?.({ detail });
    fire({ name: "motion", on: true });
    fire({ name: "garden", on: false });
    const before = reloads;
    fire({ name: "garden", on: true });
    expect([before, reloads]).toStrictEqual([0, 1]);
  });

  it("開発の文字列を動かすと、URL の引数で選んだ季節と時間帯を書く", () => {
    const b = browser("?season=winter&time=morning");
    runInNewContext(stageScript({ dev: true }), b.globals);
    expect([b.root.dataset.season, b.root.dataset.time]).toStrictEqual(["winter", "morning"]);
  });

  it("場面のバンドルの URL を渡すと、庭を出して、その URL の module の script を head に足す", () => {
    const b = browser();
    const appended: { src?: string; type?: string }[] = [];
    const globals = {
      ...b.globals,
      document: {
        documentElement: b.root,
        createElement: () => ({}),
        head: { appendChild: (s: { src?: string; type?: string }) => void appended.push(s) },
      },
    };
    runInNewContext(stageScript({ dev: false, bundle: "/_astro/scene.js" }), globals);
    expect({
      classes: [...b.root.classes].sort(),
      src: appended[0]?.src,
      type: appended[0]?.type,
    }).toStrictEqual({
      classes: ["intro", "stage-on"],
      src: "/_astro/scene.js",
      type: "module",
    });
  });
});

describe("stageScript の場面のバンドルの読み込みの失敗", () => {
  it("バンドルの script が読み込みに失敗すると、庭を出す class を外す", () => {
    const b = browser();
    const appended: { onerror?: () => void }[] = [];
    const globals = {
      ...b.globals,
      document: {
        documentElement: b.root,
        createElement: () => ({}),
        head: { appendChild: (s: { onerror?: () => void }) => void appended.push(s) },
      },
    };
    runInNewContext(stageScript({ dev: false, bundle: "/_astro/scene.js" }), globals);
    appended[0]?.onerror?.();
    expect([...b.root.classes]).toStrictEqual([]);
  });

  it("バンドルが 6 秒の間に場面の準備を終えないと、庭を出す class を外す", () => {
    const b = browser();
    const timers: { fn: () => void; ms: number }[] = [];
    const globals = {
      ...b.globals,
      document: {
        documentElement: b.root,
        createElement: () => ({}),
        head: { appendChild: () => {} },
      },
      setTimeout: (fn: () => void, ms: number) => void timers.push({ fn, ms }),
    };
    runInNewContext(stageScript({ dev: false, bundle: "/_astro/scene.js" }), globals);
    timers[0]!.fn();
    expect({ ms: timers.map((t) => t.ms), classes: [...b.root.classes] }).toStrictEqual({
      ms: [6000],
      classes: [],
    });
  });
});

describe("stageScript の場面のバンドルの URL", () => {
  it("URL に </script> が入っても、script の要素を閉じる文字列を出さない", () => {
    expect(stageScript({ dev: false, bundle: "/a</script><b>" }).includes("</script")).toBe(false);
  });
});

describe("inline script に埋め込む形", () => {
  it("applyStage は、文字列から作り直しても、外の名前を参照せずに動く", () => {
    const apply = runInNewContext(`(${applyStage.toString()})`) as typeof applyStage;
    const root = fakeRoot();
    apply(
      {
        root,
        now: NOV_13_20H,
        override: {},
        introAgain: false,
        storage: () => memory(),
        load: () => {},
        later: () => {},
      },
      fns,
    );
    expect([...root.classes].sort()).toStrictEqual(["intro", "stage-on"]);
  });

  it("readOverride は、文字列から作り直しても、外の名前を参照せずに動く", () => {
    const read = runInNewContext(`(${readOverride.toString()})`, {
      URLSearchParams,
    }) as typeof readOverride;
    expect({ ...read("?season=summer") }).toStrictEqual({ season: "summer" });
  });
});
