import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import {
  applySettings,
  changeSetting,
  PICK_CHOICES,
  pickChangeOf,
  SETTINGS_CHANGE,
  settingsScript,
  type SettingsChange,
} from "./settings";

function memory(entries: [string, string][] = []) {
  const items = new Map(entries);
  return {
    items,
    getItem: (k: string) => items.get(k) ?? null,
    setItem: (k: string, v: string) => void items.set(k, v),
    removeItem: (k: string) => void items.delete(k),
  };
}

const blocked = () => {
  throw new DOMException("blocked", "SecurityError");
};

function settingsOf(entries: [string, string][], reducedMotion: boolean) {
  const root = { dataset: {} as DOMStringMap };
  applySettings(root, () => memory(entries), reducedMotion);
  return { motion: root.dataset.motion, garden: root.dataset.garden };
}

function picksOf(entries: [string, string][]) {
  const root = { dataset: {} as DOMStringMap };
  applySettings(root, () => memory(entries), false);
  return { season: root.dataset.seasonSetting, time: root.dataset.timeSetting };
}

function target() {
  const events: SettingsChange[] = [];
  const root = {
    dataset: {} as DOMStringMap,
    dispatchEvent: (e: Event) => {
      if (e.type === SETTINGS_CHANGE) events.push((e as CustomEvent<SettingsChange>).detail);
      return true;
    },
  };
  return { root, events };
}

const pickRows = (["season", "time"] as const).flatMap((name) =>
  PICK_CHOICES[name]
    .map((c) => c.value)
    .filter((v) => v !== "auto")
    .map((value) => ({ name, value })),
);

describe("applySettings", () => {
  it("保存していないときは、2 つとも on にする", () => {
    expect(settingsOf([], false)).toStrictEqual({ motion: "on", garden: "on" });
  });

  it("保存していないときに OS が動きを減らす設定なら、2 つとも off にする", () => {
    expect(settingsOf([], true)).toStrictEqual({ motion: "off", garden: "off" });
  });

  it("保存した値を、OS の設定より先に使う", () => {
    expect(
      settingsOf(
        [
          ["fd-motion", "on"],
          ["fd-garden", "off"],
        ],
        true,
      ),
    ).toStrictEqual({ motion: "on", garden: "off" });
  });

  it("on と off のほかの値は、保存していない扱いにする", () => {
    expect(settingsOf([["fd-motion", "1"]], false)).toStrictEqual({ motion: "on", garden: "on" });
  });

  it("localStorage に触れると例外を投げる端末では、OS の設定から決める", () => {
    const root = { dataset: {} as DOMStringMap };
    applySettings(root, blocked, true);
    expect({ motion: root.dataset.motion, garden: root.dataset.garden }).toStrictEqual({
      motion: "off",
      garden: "off",
    });
  });

  it("季節と時間帯を保存していないときは、2 つとも auto にする", () => {
    expect(picksOf([])).toStrictEqual({ season: "auto", time: "auto" });
  });

  it.each(pickRows)("保存した $name の $value を、そのまま html に書く", ({ name, value }) => {
    expect(picksOf([[`fd-${name}`, value]])[name]).toBe(value);
  });

  it("季節と時間帯の決めた値のほかは auto にする", () => {
    expect(
      picksOf([
        ["fd-season", "Winter"],
        ["fd-time", "noon"],
      ]),
    ).toStrictEqual({ season: "auto", time: "auto" });
  });
});

describe("settingsScript", () => {
  it("文字列から作り直しても、外の名前を参照せずに、ブラウザの値だけで動く", () => {
    const root = { dataset: {} as DOMStringMap };
    runInNewContext(settingsScript(), {
      document: { documentElement: root },
      localStorage: memory([["fd-garden", "off"]]),
      matchMedia: () => ({ matches: false }),
    });
    expect({ motion: root.dataset.motion, garden: root.dataset.garden }).toStrictEqual({
      motion: "on",
      garden: "off",
    });
  });
});

describe("changeSetting", () => {
  it("html に書き、保存し、変えた設定をイベントで知らせる", () => {
    const { root, events } = target();
    const store = memory();
    changeSetting(root, () => store, { name: "motion", on: false });
    expect({
      attr: root.dataset.motion,
      saved: store.items.get("fd-motion"),
      events,
    }).toStrictEqual({ attr: "off", saved: "off", events: [{ name: "motion", on: false }] });
  });

  it("保存できない端末でも、html に書いてイベントを送る", () => {
    const { root, events } = target();
    changeSetting(root, blocked, { name: "garden", on: true });
    expect({ attr: root.dataset.garden, events }).toStrictEqual({
      attr: "on",
      events: [{ name: "garden", on: true }],
    });
  });

  it("選んだ季節か時間帯を html に書いて保存し、イベントで知らせる", () => {
    const { root, events } = target();
    const store = memory();
    changeSetting(root, () => store, { name: "time", value: "night" });
    expect({
      attr: root.dataset.timeSetting,
      saved: store.items.get("fd-time"),
      events,
    }).toStrictEqual({
      attr: "night",
      saved: "night",
      events: [{ name: "time", value: "night" }],
    });
  });

  it("季節か時間帯を auto に戻すと、保存した値を消す", () => {
    const { root } = target();
    const store = memory([["fd-season", "winter"]]);
    changeSetting(root, () => store, { name: "season", value: "auto" });
    expect({ attr: root.dataset.seasonSetting, saved: store.items.has("fd-season") }).toStrictEqual(
      {
        attr: "auto",
        saved: false,
      },
    );
  });

  it.each([
    { name: "season", value: "winter" },
    { name: "season", value: "auto" },
  ] as const)("保存できない端末でも、季節の $value を html に書いてイベントを送る", (change) => {
    const { root, events } = target();
    changeSetting(root, blocked, change);
    expect({ attr: root.dataset.seasonSetting, events }).toStrictEqual({
      attr: change.value,
      events: [change],
    });
  });
});

describe("pickChangeOf", () => {
  it("選べる値で、今の値と違うときだけ変更を返す", () => {
    const root = { dataset: { seasonSetting: "winter", timeSetting: "auto" } as DOMStringMap };
    expect([
      pickChangeOf(root, "season", "spring"),
      pickChangeOf(root, "time", "night"),
      pickChangeOf(root, "season", "winter"),
      pickChangeOf(root, "time", "auto"),
      pickChangeOf(root, "season", "night"),
      pickChangeOf(root, "time", undefined),
    ]).toStrictEqual([
      { name: "season", value: "spring" },
      { name: "time", value: "night" },
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });
});
