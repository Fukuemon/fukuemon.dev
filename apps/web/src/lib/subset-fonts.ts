import { createHash } from "node:crypto";
import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import { parse, type DefaultTreeAdapterMap } from "parse5";
import subsetFont from "subset-font";

/**
 * 和文の書体のスライスを、その書体を当てる要素の字だけに作り直す。
 * 書体を当てる要素は、ビルドした CSS で、その書体を font-family に持つクラスのセレクタから決める。
 * 要素を特定できないときは、字を取りこぼさないように、全ての HTML の字を使う。
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
        const rules = await collectFontRules(files, family);
        if (rules.classes.size === 0 && rules.unresolved.length === 0)
          throw new Error(`${family}: 書体を当てる規則が CSS に見つからない`);
        for (const selector of new Set(rules.unresolved))
          logger.warn(`${family}: ${selector} の要素を特定できないので、全ての HTML の字を使う`);
        const used = await usedChars(files, css, rules, family);
        const chars = [...used];
        const faces = await collectFaces(css, family);
        if (faces.length === 0)
          throw new Error(`${family}: 作り直す @font-face が CSS に見つからない`);
        const paths = new Map(faces.map((face) => [face.url, inside(root, face.url)]));
        for (const face of faces)
          if (!HASHED.test(face.url))
            throw new Error(`${face.url}: 名前の hash を差し替えられない`);
        const renames = new Map<string, string>();
        let before = 0;
        let after = 0;
        for (const face of faces) {
          const text = chars.filter((c) => inRange(c.codePointAt(0)!, face.ranges)).join("");
          if (text === "") continue;
          const path = paths.get(face.url)!;
          const src = await readFile(path);
          const subset = await subsetFont(src, text, { targetFormat: "woff2" });
          const url = hashedUrl(face.url, subset);
          await writeFile(inside(root, url), subset);
          await rm(path);
          renames.set(face.url, url);
          before += src.length;
          after += subset.length;
        }
        for (const f of css) {
          const body = await readFile(f, "utf8");
          let next = body;
          for (const [from, to] of renames) next = next.replace(urlOf(from), `$1${to}$2`);
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

/** Vite の付けた hash を含む woff2 の名前の末尾 */
const HASHED = /\.[\w-]{8}\.woff2$/;

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** CSS の @font-face から、指定の書体の woff2 と unicode-range を取り出す */
export function parseFaces(css: string, family: string): Face[] {
  const out: Face[] = [];
  const named = new RegExp(`font-family:\\s*["']?${escapeRegExp(family)}["']?\\s*;`, "i");
  for (const [, body] of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    if (!named.test(body)) continue;
    const url = /url\(([^)]+\.woff2)\)/.exec(body)?.[1]?.replace(/^["']|["']$/g, "");
    const range = /unicode-range:([^;}]*)/.exec(body)?.[1];
    if (url === undefined || range === undefined) continue;
    out.push({ url, ranges: parseRanges(range) });
  }
  return out;
}

/** unicode-range を、字の範囲に直す。`U+1F??` のワイルドカードは、`?` を下端で 0、上端で F にして読む */
export function parseRanges(range: string): [number, number][] {
  return range.split(",").map((r) => {
    const [lo, hi] = r.trim().replace(/^U\+/i, "").split("-");
    const parsed: [number, number] = [
      parseInt(lo.replaceAll("?", "0"), 16),
      parseInt(hi ?? lo.replaceAll("?", "F"), 16),
    ];
    if (parsed.some(Number.isNaN)) throw new Error(`unicode-range を読めない: ${r.trim()}`);
    return parsed;
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

/**
 * CSS の規則から、書体を持つ規則のセレクタを集める。
 * font-family の先頭に書体を書いたクラスのセレクタだけを、クラスとして読む。
 * 変数やショートハンドで書体を参照する規則は、要素を特定できないものとして返す
 */
export function parseFontRules(css: string, family: string): FontRules {
  const classes = new Set<string>();
  const unresolved: string[] = [];
  const props = new Set<string>();
  const mentions = new RegExp(escapeRegExp(family), "i");
  const direct = new RegExp(`font-family:\\s*["']?${escapeRegExp(family)}`, "i");
  for (const [, head, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = head.slice(head.lastIndexOf(";") + 1).trim();
    if (selectors.startsWith("@") || !mentions.test(body)) continue;
    for (const [, prop, value] of body.matchAll(/(--[\w-]+)\s*:([^;]*)/g))
      if (mentions.test(value)) props.add(prop);
    if (!direct.test(body) && !mentions.test(body.replace(/--[\w-]+\s*:[^;]*;?/g, ""))) continue;
    for (const selector of selectors.split(",").map((s) => s.trim())) {
      const name = direct.test(body)
        ? /^\.((?:\\.|[\w-])+)(?:::?[\w-]+)?$/.exec(selector)?.[1]
        : undefined;
      if (name === undefined) unresolved.push(selector);
      else classes.add(name.replace(/\\(.)/g, "$1"));
    }
  }
  for (const prop of props) if (css.includes(`var(${prop}`)) unresolved.push(`var(${prop})`);
  return { classes, unresolved };
}

/** .css と、HTML に埋め込まれた style の規則から、書体を持つ規則を集める */
async function collectFontRules(files: string[], family: string): Promise<FontRules> {
  const texts: string[] = [];
  for (const f of files) {
    if (f.endsWith(".css")) texts.push(await readFile(f, "utf8"));
    if (f.endsWith(".html")) texts.push(...styleTexts(await readFile(f, "utf8")));
  }
  return parseFontRules(texts.join("\n"), family);
}

type HtmlNode = DefaultTreeAdapterMap["node"];

/** 子の要素と、template の中身を返す */
const childrenOf = (node: HtmlNode): HtmlNode[] => [
  ...("childNodes" in node ? node.childNodes : []),
  ...("content" in node ? node.content.childNodes : []),
];

/** HTML の style 要素の中身を返す */
export function styleTexts(html: string): string[] {
  const out: string[] = [];
  const walk = (node: HtmlNode): void => {
    if ("tagName" in node && node.tagName === "style") {
      for (const child of node.childNodes) if ("value" in child) out.push(child.value);
    }
    for (const child of childrenOf(node)) walk(child);
  };
  walk(parse(html));
  return out;
}

/**
 * HTML の字を集める。クラスを持つ要素の子孫は font-family を継ぐので、子孫の字も集める。
 * every が true のときは、全ての要素の字を集める。
 * script の字は、JS と同じく U+2000 から上だけを集める。
 * 描く文言を持つ island の script は、見出しの字を描くことがある
 */
export function htmlChars(
  html: string,
  { classes, family, every = false }: { classes: Set<string>; family: string; every?: boolean },
): Set<string> {
  const out = new Set<string>();
  const add = (text: string | undefined, min = 0) => {
    for (const c of text ?? "") if (c.codePointAt(0)! >= min) out.add(c);
  };
  const walk = (node: HtmlNode, applied: boolean): void => {
    if ("tagName" in node) {
      const attr = (name: string) => node.attrs.find((a) => a.name === name)?.value;
      if (node.tagName === "script") {
        for (const child of node.childNodes) if ("value" in child) add(child.value, 0x2000);
        return;
      }
      if (node.tagName === "style") return;
      const here =
        applied ||
        attr("style")?.includes(family) === true ||
        (attr("class")
          ?.split(/\s+/)
          .some((c) => classes.has(c)) ??
          false);
      if (here) for (const name of ["placeholder", "value", "alt"]) add(attr(name));
      for (const child of childrenOf(node)) walk(child, here);
    } else if ("value" in node) {
      if (applied) add(node.value);
    } else {
      for (const child of childrenOf(node)) walk(child, applied);
    }
  };
  walk(parse(html), every);
  return out;
}

/** CSS の content に書いた文字列の字を集める。擬似要素が描く字は、書体を当てる要素のものと区別できない */
const cssContentChars = (css: string): string =>
  [...css.matchAll(/content:\s*"([^"]*)"/g)].map((m) => m[1]).join("");

/**
 * 字を集める。HTML は、書体を当てる要素の字だけを集める。
 * 要素を特定できないセレクタがあるときは、全ての要素の字を集める。
 * JS の字は U+2000 から上だけを集める。
 * JS は island が描く文言を持つが、ライブラリの欧文の表まで拾うと Latin のスライスが減らない
 */
async function usedChars(
  files: string[],
  css: string[],
  rules: FontRules,
  family: string,
): Promise<Set<string>> {
  const used = new Set<string>();
  const every = rules.unresolved.length > 0;
  for (const f of css) for (const c of cssContentChars(await readFile(f, "utf8"))) used.add(c);
  for (const f of files) {
    if (f.endsWith(".html")) {
      const html = await readFile(f, "utf8");
      for (const c of htmlChars(html, { classes: rules.classes, family, every })) used.add(c);
      for (const style of styleTexts(html)) for (const c of cssContentChars(style)) used.add(c);
    } else if (f.endsWith(".js")) {
      for (const c of await readFile(f, "utf8")) if (c.codePointAt(0)! >= 0x2000) used.add(c);
    }
  }
  return used;
}

/** CSS から取り出した URL を、root の中のパスにする。外を指すときはビルドを止める */
function inside(root: string, url: string): string {
  const path = resolve(root, `.${url}`);
  const rel = relative(root, path);
  if (
    !url.startsWith("/") ||
    url.startsWith("//") ||
    rel === ".." ||
    rel.startsWith(`..${sep}`) ||
    isAbsolute(rel)
  )
    throw new Error(`${url}: 出力の外を指している`);
  return path;
}

async function collectFaces(css: string[], family: string): Promise<Face[]> {
  const seen = new Map<string, Face>();
  for (const f of css)
    for (const face of parseFaces(await readFile(f, "utf8"), family)) seen.set(face.url, face);
  return [...seen.values()];
}

/** CSS の url() の中で、URL 全体が一致する箇所を探す正規表現 */
const urlOf = (url: string): RegExp => new RegExp(`([("'])${escapeRegExp(url)}([)"'])`, "g");

/** Vite の付けた hash を、作り直した中身の hash に差し替える */
export function hashedUrl(url: string, body: Uint8Array): string {
  const hash = createHash("sha256").update(body).digest("base64url").slice(0, 8);
  return url.replace(HASHED, `.${hash}.woff2`);
}

async function list(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries.filter((e) => e.isFile()).map((e) => join(e.parentPath, e.name));
}

const kib = (n: number): string => (n / 1024).toFixed(0);
