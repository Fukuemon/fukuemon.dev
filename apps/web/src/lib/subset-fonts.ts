import { createHash } from "node:crypto";
import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import subsetFont from "subset-font";

/**
 * 和文の書体のスライスを、サイトが使う字だけに作り直す。
 * Fontsource のスライスは常用の字をまとめて持つので、1 ページで約 1 MiB を取得していた。
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
        const used = await usedChars(files);
        const css = files.filter((f) => f.endsWith(".css"));
        const renames = new Map<string, string>();
        let before = 0;
        let after = 0;
        for (const face of await faces(css, family)) {
          const text = [...used].filter((c) => inRange(c.codePointAt(0)!, face.ranges)).join("");
          if (text === "") continue;
          const path = join(root, face.url);
          const src = await readFile(path);
          const out = await subsetFont(src, text, { targetFormat: "woff2" });
          const url = rename(face.url, out);
          await writeFile(join(root, url), out);
          await rm(path);
          renames.set(face.url, url);
          before += src.length;
          after += out.length;
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

/** CSS の @font-face から、指定の書体の woff2 と unicode-range を取り出す */
export function parseFaces(css: string, family: string): Face[] {
  const out: Face[] = [];
  for (const [, body] of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    if (!new RegExp(`font-family:\\s*["']?${family}["']?\\s*;`).test(body)) continue;
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

/**
 * HTML の字はすべて、JS の字は U+2000 から上だけを集める。
 * JS は island が描く文言を持つが、ライブラリの欧文の表まで拾うと Latin のスライスが減らない
 */
async function usedChars(files: string[]): Promise<Set<string>> {
  const used = new Set<string>();
  for (const f of files) {
    const html = f.endsWith(".html");
    if (!html && !f.endsWith(".js")) continue;
    for (const c of await readFile(f, "utf8")) {
      if (html || c.codePointAt(0)! >= 0x2000) used.add(c);
    }
  }
  return used;
}

async function faces(css: string[], family: string): Promise<Face[]> {
  const seen = new Map<string, Face>();
  for (const f of css)
    for (const face of parseFaces(await readFile(f, "utf8"), family)) seen.set(face.url, face);
  return [...seen.values()];
}

/** Vite の付けた hash を、作り直した中身の hash に差し替える */
export function rename(url: string, body: Uint8Array): string {
  const hash = createHash("sha256").update(body).digest("base64url").slice(0, 8);
  return url.replace(/\.[\w-]{8}\.woff2$/, `.${hash}.woff2`);
}

async function list(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries.filter((e) => e.isFile()).map((e) => join(e.parentPath, e.name));
}

const kib = (n: number): string => (n / 1024).toFixed(0);
