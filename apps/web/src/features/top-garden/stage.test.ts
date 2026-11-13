import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { seasonOf, timeOfDayOf } from "./season";
import { applyStage, readOverride, stageScript, type StageEnv } from "./stage";
import { takeFirstVisit } from "./visit";

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
  return {
    dataset: {} as DOMStringMap,
    classes,
    classList: {
      add: (...c: string[]) => c.forEach((v) => classes.add(v)),
      remove: (...c: string[]) => c.forEach((v) => classes.delete(v)),
    },
  };
}

function run(o: Partial<Omit<StageEnv, "root" | "storage">> & { seen?: boolean } = {}) {
  const root = fakeRoot();
  const store = memory(o.seen);
  const loads: (() => void)[] = [];
  applyStage(
    {
      root,
      now: NOV_13_20H,
      override: {},
      reducedMotion: false,
      storage: () => store,
      load: (onError) => void loads.push(onError),
      ...o,
    },
    fns,
  );
  return { root, store, loads };
}

const summary = ({ root, store, loads }: ReturnType<typeof run>) => ({
  season: root.dataset.season,
  time: root.dataset.time,
  classes: [...root.classes].sort(),
  seen: store.items.get("fd-top-seen") ?? null,
  loaded: loads.length,
});

describe("applyStage", () => {
  it("11 月の 20 時に初めて開くと、秋と夜を書き、記録して、イントロを出して場面の束を読み込む", () => {
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

  it("動きを減らす設定では、季節と時間帯を書いて記録し、場面の束を読み込まない", () => {
    expect(summary(run({ reducedMotion: true }))).toStrictEqual({
      season: "autumn",
      time: "night",
      classes: [],
      seen: "1",
      loaded: 0,
    });
  });

  it("場面の束が無いときは、季節と時間帯を書いて記録し、庭を出さない", () => {
    expect(summary(run({ load: null }))).toStrictEqual({
      season: "autumn",
      time: "night",
      classes: [],
      seen: "1",
      loaded: 0,
    });
  });

  it("場面の束の読み込みに失敗すると、2 つの class を外し、記録は残す", () => {
    const r = run();
    r.loads[0]!();
    expect({ classes: [...r.root.classes], seen: r.store.items.get("fd-top-seen") }).toStrictEqual({
      classes: [],
      seen: "1",
    });
  });

  it("localStorage に触れると例外を投げる端末では、季節と時間帯を書き、イントロを出さずに庭を出す", () => {
    const root = fakeRoot();
    applyStage(
      {
        root,
        now: NOV_13_20H,
        override: {},
        reducedMotion: false,
        storage: () => {
          throw new DOMException("blocked", "SecurityError");
        },
        load: () => {},
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
  const store = memory();
  const globals = {
    document: { documentElement: root },
    localStorage: store,
    location: { search },
    matchMedia: () => ({ matches: false }),
    URLSearchParams,
    Date: class extends Date {
      constructor() {
        super(NOV_13_20H);
      }
    },
  };
  return { root, store, globals };
}

describe("stageScript", () => {
  it("本番の文字列は、URL の引数を読む処理を持たない", () => {
    expect(/URLSearchParams|location\.search/.test(stageScript({ dev: false }))).toBe(false);
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

  it("開発の文字列を動かすと、URL の引数で選んだ季節と時間帯を書く", () => {
    const b = browser("?season=winter&time=morning");
    runInNewContext(stageScript({ dev: true }), b.globals);
    expect([b.root.dataset.season, b.root.dataset.time]).toStrictEqual(["winter", "morning"]);
  });

  it("場面の束の URL を渡すと、庭を出して、その URL の module の script を head に足す", () => {
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

describe("stageScript の場面の束の URL", () => {
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
        reducedMotion: false,
        storage: () => memory(),
        load: () => {},
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
