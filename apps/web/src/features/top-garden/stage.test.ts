import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { seasonOf, timeOfDayOf } from "./season";
import { applyStage, readOverride, type StageEnv } from "./stage";
import { takeFirstVisit } from "./visit";

const fns = { seasonOf, timeOfDayOf, takeFirstVisit };

function memory(seen = false) {
  const items = new Map<string, string>(seen ? [["fd-top-seen", "1"]] : []);
  return {
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

function run(o: Partial<Omit<StageEnv, "root">> = {}) {
  const root = fakeRoot();
  const loads: (() => void)[] = [];
  applyStage(
    {
      root,
      now: new Date(2026, 10, 13, 20),
      override: {},
      reducedMotion: false,
      storage: () => memory(),
      load: (onError) => void loads.push(onError),
      ...o,
    },
    fns,
  );
  return { root, loads };
}

const summary = ({ root, loads }: ReturnType<typeof run>) => ({
  season: root.dataset.season,
  time: root.dataset.time,
  classes: [...root.classes].sort(),
  loaded: loads.length,
});

describe("applyStage", () => {
  it("11 月の 20 時に初めて開くと、秋と夜を書き、イントロを出して場面の束を読み込む", () => {
    expect(summary(run())).toStrictEqual({
      season: "autumn",
      time: "night",
      classes: ["intro", "stage-on"],
      loaded: 1,
    });
  });

  it("同じ端末で 2 回目に開くと、イントロを出さずに庭を出す", () => {
    expect(summary(run({ storage: () => memory(true) }))).toStrictEqual({
      season: "autumn",
      time: "night",
      classes: ["stage-on"],
      loaded: 1,
    });
  });

  it("動きを減らす設定では、季節と時間帯だけを書き、場面の束を読み込まない", () => {
    expect(summary(run({ reducedMotion: true }))).toStrictEqual({
      season: "autumn",
      time: "night",
      classes: [],
      loaded: 0,
    });
  });

  it("場面の束が無いときは、季節と時間帯だけを書き、庭を出さない", () => {
    expect(summary(run({ load: null }))).toStrictEqual({
      season: "autumn",
      time: "night",
      classes: [],
      loaded: 0,
    });
  });

  it("場面の束の読み込みに失敗すると、ふつうのページに戻す", () => {
    const r = run();
    r.loads[0]!();
    expect([...r.root.classes]).toStrictEqual([]);
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
});

describe("inline script に埋め込む形", () => {
  it("2 つの関数は、文字列から作り直しても、外の名前を参照せずに動く", () => {
    const apply = runInNewContext(`(${applyStage.toString()})`) as typeof applyStage;
    const read = runInNewContext(`(${readOverride.toString()})`, {
      URLSearchParams,
    }) as typeof readOverride;
    const root = fakeRoot();
    apply(
      {
        root,
        now: new Date(2026, 10, 13, 20),
        override: read("?season=summer"),
        reducedMotion: false,
        storage: () => memory(),
        load: () => {},
      },
      fns,
    );
    expect([root.dataset.season, root.dataset.time, [...root.classes].sort()]).toStrictEqual([
      "summer",
      "night",
      ["intro", "stage-on"],
    ]);
  });
});
