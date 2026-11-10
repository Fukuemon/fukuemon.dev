#!/usr/bin/env node
// packages/ui のコードの色のセマンティックトークンを、テーマごとに色の値まで解決し、code-theme.gen.json に書き出す（adr/0022-code-colors-from-tokens.md）。
// CSS の変数を読まないエンジン（Expressive Code、エディタ、端末）のテーマは、この JSON から作る。
// 使い方: node scripts/build-code-theme.mjs [--check]
//   --check は書き出さず、書き出すはずの中身と今のファイルを比べる。CI で生成物のずれを見つけるのに使う
// 終了コード: 0 は書き出した（--check では一致した）、1 は --check で食い違うかファイルがない、2 は色に解決できないトークンがある
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const TOKENS = "packages/ui/src/tokens";
const OUT = `${TOKENS}/code-theme.gen.json`;
const PREFIX = "--fd-color-code-";
const SYNTAX = ["surface", "text", "comment", "keyword", "string", "number", "function", "type"];
const ANSI = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"];
// ダークの値は、Storybook のダークのブロックから読む。OS の設定のダークのブロックと同じ値を持つ
const DARK_BLOCK = '[data-theme="dark"]';

const read = (name) => readFileSync(`${TOKENS}/${name}`, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

// セレクタの直後の { から、対応する } までの宣言を読む
function declarations(css, selector) {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`${selector} のブロックがない`);
  let depth = 0;
  let body = "";
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) break;
    else if (depth === 1) body += css[i];
  }
  const map = new Map();
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) map.set(m[1], m[2].trim());
  return map;
}

function resolver(...maps) {
  const all = new Map(maps.flatMap((m) => [...m]));
  const resolve = (value, depth = 0) => {
    const ref = /^var\((--[\w-]+)\)$/.exec(value);
    if (ref && depth < 10) {
      if (!all.has(ref[1])) throw new Error(`${ref[1]} がない`);
      return resolve(all.get(ref[1]), depth + 1);
    }
    if (!/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`色に解決できない: ${value}`);
    return value.toLowerCase();
  };
  return (name) => resolve(`var(${PREFIX}${name})`);
}

const camel = (s) => s.replace(/-(\w)/g, (_, c) => c.toUpperCase());

function theme(color) {
  return {
    ...Object.fromEntries(SYNTAX.map((n) => [n, color(n)])),
    ansi: Object.fromEntries(
      ANSI.flatMap((c) => [
        [c, color(`ansi-${c}`)],
        [camel(`bright-${c}`), color(`ansi-bright-${c}`)],
      ]),
    ),
  };
}

let content;
try {
  const primitive = declarations(read("primitive.css"), ":root");
  const light = declarations(read("semantic.css"), ":root");
  const dark = declarations(read("semantic-dark.css"), DARK_BLOCK);
  content = `${JSON.stringify(
    {
      $comment: "生成物。node scripts/build-code-theme.mjs で作り直す。手で直さない",
      light: theme(resolver(primitive, light)),
      dark: theme(resolver(primitive, light, dark)),
    },
    null,
    2,
  )}\n`;
} catch (e) {
  console.error(e.message);
  process.exit(2);
}

if (process.argv.includes("--check")) {
  if (!existsSync(OUT) || readFileSync(OUT, "utf8") !== content) {
    console.error(
      `${OUT} がトークンと食い違う。node scripts/build-code-theme.mjs で作り直し、同じコミットに入れる`,
    );
    process.exit(1);
  }
  console.log(`${OUT} はトークンと一致した`);
} else {
  writeFileSync(OUT, content);
  console.log(`${OUT} を書いた`);
}
