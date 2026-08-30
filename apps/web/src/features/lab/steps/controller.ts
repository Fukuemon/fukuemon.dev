import { PROGRESS_EVENT, type ProgressEvent, loadProgress, saveProgress } from "./progress";
import { mountSide, shutIfNarrow } from "../../doc/side";

type Refs = {
  root: HTMLElement;
  contentId: string;
  sections: HTMLElement[];
  links: HTMLAnchorElement[];
  /** 面の番号を昇順に。1 つの番号に複数の要素が付く */
  order: number[];
  /** `h2` の手順の数。「はじめに」を含まない */
  count: number;
};

/**
 * 1 画面 1 手順の切り替えを `root` に取り付ける。
 * React を使わないのは、`local` のハンズオンに React を配らないため。
 */
export function mountSteps(root: HTMLElement): void {
  const contentId = root.dataset.contentId ?? "";
  const sections = [...root.querySelectorAll<HTMLElement>(".step")];
  const links = [...root.querySelectorAll<HTMLAnchorElement>(".steps__link")];
  if (sections.length === 0) return;

  // 「はじめに」は本文と LocalSetup の 2 要素に分かれる
  const order = [...new Set(sections.map((s) => Number(s.dataset.step)))].sort((a, b) => a - b);

  const refs: Refs = {
    root,
    contentId,
    sections,
    links,
    order,
    count: order.filter((i) => i >= 0).length,
  };

  // 保存しない。localStorage の書き換えで完了を捏造させない
  const seen = new Set<number>();
  // localStorage が書けない環境では、island が届けた値だけが手がかりになる。
  // 読み直しに頼ると、実行が成功しても完了の印が出ない
  let relayed: number[] | undefined;
  // 直前に開いていた手順。初回は無い
  let was: number | undefined;

  const show = (index: number, push: boolean) => {
    const i = order.includes(index) ? index : (order[0] ?? 0);

    for (const s of sections) {
      const on = Number(s.dataset.step) === i;
      s.hidden = !on;
      s.toggleAttribute("data-current", on);
    }
    for (const a of links) {
      const on = Number(a.dataset.step) === i;
      if (on) a.setAttribute("aria-current", "step");
      else a.removeAttribute("aria-current");
    }
    // 離れた手順だけを印にする。飛ばして開いた手順は通っていない
    if (was !== undefined && was >= 0 && was !== i) seen.add(was);
    was = i;

    // 初回も hash を書く。空のままだと戻り先が保存済みの続きになる
    const hash = `#step-${i}`;
    if (location.hash !== hash) {
      if (push) history.pushState(null, "", hash);
      else history.replaceState(null, "", hash);
    }

    // 初回はブラウザの hash 送りが後から走る。1 フレーム待って上書きする
    const top = () => globalThis.scrollTo({ top: 0, behavior: "instant" });
    top();
    requestAnimationFrame(top);

    // 「はじめに」は手順ではないので続きに覚えない
    if (i >= 0) {
      saveProgress(contentId, {
        completedSteps: loadProgress(contentId, refs.count)?.completedSteps ?? [],
        lastStep: i,
      });
    }
    paint(refs, seen, relayed);
  };

  for (const a of links) {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      show(Number(a.dataset.step), true);
      shutIfNarrow(root);
    });
  }
  for (const b of root.querySelectorAll<HTMLButtonElement>("[data-go]")) {
    b.addEventListener("click", () => {
      // aria-disabled は押下を止めない
      if (b.getAttribute("aria-disabled") === "true") return;
      const at = order.indexOf(current(sections));
      show(order[at + (b.dataset.go === "next" ? 1 : -1)] ?? current(sections), true);
    });
  }

  mountSide(root);
  // ここで初めて 1 枚だけ出す。JS が動かない環境では全手順が縦に並ぶ
  root.dataset.ready = "true";

  globalThis.addEventListener("popstate", () => show(fromHash(refs), false));
  globalThis.addEventListener(PROGRESS_EVENT, (e) => {
    const { detail } = e as ProgressEvent;
    if (detail.contentId !== contentId) return;
    relayed = detail.value.completedSteps;
    paint(refs, seen, relayed);
  });
  // 別タブでの完了。こちらは保存が効いているので読み直す
  globalThis.addEventListener("storage", () => paint(refs, seen, relayed));

  show(fromHash(refs), false);
}

/** hash → 前回の続き → 先頭 の順に決める */
function fromHash(refs: Refs): number {
  const m = /^#step-(-?\d+)$/.exec(location.hash);
  if (m) return Number(m[1]);
  const saved = loadProgress(refs.contentId, refs.count);
  if (saved) return saved.lastStep;
  return refs.order[0] ?? 0;
}

function current(sections: HTMLElement[]): number {
  const on = sections.find((s) => s.hasAttribute("data-current"));
  return Number(on?.dataset.step ?? 0);
}

/**
 * 完了の印・進捗バー・前後ボタンを描き直す。
 * `relayed` は island が直接届けた完了。localStorage が書けない環境でも届く
 */
function paint(refs: Refs, seen: ReadonlySet<number>, relayed?: readonly number[]): void {
  const stored = loadProgress(refs.contentId, refs.count)?.completedSteps;
  const done = new Set([...(stored ?? []), ...(relayed ?? [])]);
  const passed = (i: number) => done.has(i) || seen.has(i);
  const now = current(refs.sections);

  for (const a of refs.links) {
    const i = Number(a.dataset.step);
    const state = i < 0 ? "todo" : passed(i) ? "done" : i === now ? "now" : "todo";
    const mark = a.querySelector<HTMLElement>(".steps__mark");
    if (mark) mark.dataset.state = state;
    const sr = a.querySelector(".steps__state");
    if (sr) sr.textContent = state === "done" ? "（完了）" : state === "now" ? "（表示中）" : "";
  }

  const reached = [...Array(refs.count).keys()].filter(passed).length;
  const bar = refs.root.querySelector<HTMLElement>(".steps__fill");
  if (bar) {
    bar.style.inlineSize = refs.count === 0 ? "0%" : `${(reached / refs.count) * 100}%`;
    bar.setAttribute("aria-valuenow", String(reached));
  }
  const label = refs.root.querySelector(".steps__count");
  if (label) label.textContent = `${reached} / ${refs.count} 歩`;

  const first = refs.order[0] ?? 0;
  const last = refs.order.at(-1) ?? 0;
  toggle(refs.root.querySelector("[data-go='prev']"), now > first);
  toggle(refs.root.querySelector("[data-go='next']"), now < last);
  const crumb = refs.root.querySelector(".labnav__now");
  if (crumb) crumb.textContent = now < 0 ? "はじめに" : `${now + 1} / ${refs.count}`;
}

/** `disabled` はフォーカスを body へ飛ばすので使わない */
function toggle(el: Element | null, on: boolean): void {
  if (!el) return;
  el.setAttribute("aria-disabled", String(!on));
}

