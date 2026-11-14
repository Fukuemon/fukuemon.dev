import { createHash } from "node:crypto";
import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import { parse, type DefaultTreeAdapterMap } from "parse5";
import subsetFont from "subset-font";

/**
 * 和文の書体のスライスを、その書体を当てる要素の字だけに作り直す。
 * 書体を当てる要素は、ビルドした CSS で、その書体を font-family に持つクラスのセレクタから決める。
 * スライスの分け方と unicode-range はそのまま残すので、ページは今までと同じスライスだけを取得する。
 * 作り直したファイルは中身の hash で名前を付け直す。同じ名前のまま中身を変えると、
 * 長く保存したキャッシュが古い字の集合を返し、新しく使った字が別の書体で描かれる。
 */
export function subsetFonts(family: string): AstroIntegration {
  return {
    name: "subset-fonts",
    hooks: {
      "astro:build:done": async ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        const files = await list(root);
        const css = files.filter((f) => f.endsWith(".css"));
        const rules = await fontRules(css, family);
        for (const selector of rules.unresolved)
          logger.warn(`${family}: ${selector} の要素を特定できないので、全ての HTML の字を使う`);
        const used = await usedChars(files, rules);
        const chars = [...used];
        const renames = new Map<string, string>();
        let before = 0;
        let after = 0;
        const all = await collectFaces(css, family);
        if (all.length === 0)
          throw new Error(`${family}: 作り直す @font-face が CSS に見つからない`);
        for (const face of all) {
          const text = chars.filter((c) => inRange(c.codePointAt(0)!, face.ranges)).join("");
          if (text === "") continue;
          const path = inside(root, face.url);
          const src = await readFile(path);
          const subset = await subsetFont(src, text, { targetFormat: "woff2" });
          const url = hashedUrl(face.url, subset);
          if (url === face.url) throw new Error(`${face.url}: 名前の hash を差し替えられない`);
          await writeFile(inside(root, url), subset);
          await rm(path);
          renames.set(face.url, url);
          before += src.length;
          after += subset.length;
        }
        for (const f of css) {
          const body = await readFile(f, "utf8");
          let next = body;
          for (const [from, to] of renames) next = next.replaceAll(from, to);
          if (next !== body) await writeFile(f, next);
        }
        logger.info(
          `${family}: ${renames.size} files, ${kib(before)} KiB -> ${kib(after)} KiB (${used.size} chars)`,
        );
      },
    },
  };
}

interface Face {
  url: string;
  ranges: [number, number][];
}

const familyPattern = (family: string): string => family.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** CSS の @font-face から、指定の書体の woff2 と unicode-range を取り出す */
export function parseFaces(css: string, family: string): Face[] {
  const out: Face[] = [];
  const named = new RegExp(`font-family:\\s*["']?${familyPattern(family)}["']?\\s*;`);
  for (const [, body] of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    if (!named.test(body)) continue;
    const url = /url\(([^)]+\.woff2)\)/.exec(body)?.[1]?.replace(/^["']|["']$/g, "");
    const range = /unicode-range:([^;}]*)/.exec(body)?.[1];
    if (url === undefined || range === undefined) continue;
    out.push({ url, ranges: parseRanges(range) });
  }
  return out;
}

export function parseRanges(range: string): [number, number][] {
  return range.split(",").map((r) => {
    const [lo, hi = lo] = r.trim().replace(/^U\+/i, "").split("-");
    return [parseInt(lo, 16), parseInt(hi, 16)];
  });
}

const inRange = (cp: number, ranges: [number, number][]): boolean =>
  ranges.some(([lo, hi]) => cp >= lo && cp <= hi);

interface FontRules {
  /** 書体を当てるクラスの名前 */
  classes: Set<string>;
  /** クラス 1 つでは表せず、要素を特定できないセレクタ */
  unresolved: string[];
}

/** CSS の規則から、書体を font-family に持つ規則のセレクタを集める */
export function parseFontRules(css: string, family: string): FontRules {
  const classes = new Set<string>();
  const unresolved: string[] = [];
  const uses = new RegExp(`font-family:\\s*["']?${familyPattern(family)}`);
  for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (selectors.trim().startsWith("@") || !uses.test(body)) continue;
    for (const selector of selectors.split(",").map((s) => s.trim())) {
      const name = /^\.((?:\\.|[\w-])+)(?:::?[\w-]+)?$/.exec(selector)?.[1];
      if (name === undefined) unresolved.push(selector);
      else classes.add(name.replace(/\\(.)/g, "$1"));
    }
  }
  return { classes, unresolved };
}

async function fontRules(css: string[], family: string): Promise<FontRules> {
  const all: FontRules = { classes: new Set(), unresolved: [] };
  for (const f of css) {
    const rules = parseFontRules(await readFile(f, "utf8"), family);
    for (const c of rules.classes) all.classes.add(c);
    all.unresolved.push(...rules.unresolved);
  }
  return all;
}

type Node = DefaultTreeAdapterMap["node"];

/** クラスを持つ要素の字を集める。子孫は font-family を継ぐので、子孫の字も集める */
export function htmlChars(html: string, classes: Set<string>): Set<string> {
  const out = new Set<string>();
  const add = (text: string | undefined) => {
    for (const c of text ?? "") out.add(c);
  };
  const walk = (node: Node, applied: boolean): void => {
    if ("tagName" in node) {
      if (node.tagName === "script" || node.tagName === "style") return;
      const attr = (name: string) => node.attrs.find((a) => a.name === name)?.value;
      const here =
        applied ||
        (attr("class")
          ?.split(/\s+/)
          .some((c) => classes.has(c)) ??
          false);
      if (here) add(attr("placeholder"));
      for (const child of node.childNodes) walk(child, here);
    } else if ("value" in node) {
      if (applied) add(node.value);
    } else if ("childNodes" in node) {
      for (const child of node.childNodes) walk(child, applied);
    }
  };
  walk(parse(html), false);
  return out;
}

/**
 * HTML は、書体を当てる要素の字を集める。要素を特定できないセレクタがあるときは、全ての字を集める。
 * JS の字は U+2000 から上だけを集める。
 * JS は island が描く文言を持つが、ライブラリの欧文の表まで拾うと Latin のスライスが減らない
 */
async function usedChars(files: string[], rules: FontRules): Promise<Set<string>> {
  const used = new Set<string>();
  const every = rules.unresolved.length > 0;
  for (const f of files) {
    const html = f.endsWith(".html");
    if (!html && !f.endsWith(".js")) continue;
    const text = await readFile(f, "utf8");
    if (html && !every) {
      for (const c of htmlChars(text, rules.classes)) used.add(c);
      continue;
    }
    for (const c of text) {
      if (html || c.codePointAt(0)! >= 0x2000) used.add(c);
    }
  }
  return used;
}

/** CSS から取り出した URL を、root の中のパスにする。外を指すときはビルドを止める */
function inside(root: string, url: string): string {
  const path = resolve(root, `.${url}`);
  const rel = relative(root, path);
  if (!url.startsWith("/") || rel.startsWith("..") || isAbsolute(rel))
    throw new Error(`${url}: ${root} の外を指している`);
  return path;
}

async function collectFaces(css: string[], family: string): Promise<Face[]> {
  const seen = new Map<string, Face>();
  for (const f of css)
    for (const face of parseFaces(await readFile(f, "utf8"), family)) seen.set(face.url, face);
  return [...seen.values()];
}

/** Vite の付けた hash を、作り直した中身の hash に差し替える */
export function hashedUrl(url: string, body: Uint8Array): string {
  const hash = createHash("sha256").update(body).digest("base64url").slice(0, 8);
  return url.replace(/\.[\w-]{8}\.woff2$/, `.${hash}.woff2`);
}

async function list(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries.filter((e) => e.isFile()).map((e) => join(e.parentPath, e.name));
}

const kib = (n: number): string => (n / 1024).toFixed(0);
