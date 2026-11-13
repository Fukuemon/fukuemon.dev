import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type Rule = { pattern: RegExp; headers: Map<string, string> };

function readPublic(name: string): string {
  return readFileSync(new URL(`../public/${name}`, import.meta.url), "utf8");
}

// Workers Static Assets の _headers の書き方のうち、このファイルが使う形（* の splat）だけを読む
function parseHeaders(text: string): Rule[] {
  const rules: Rule[] = [];
  for (const line of text.split("\n")) {
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
    if (!/^\s/.test(line)) {
      const source = line
        .trim()
        .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
        .replaceAll("*", ".*");
      rules.push({ pattern: new RegExp(`^${source}$`), headers: new Map() });
      continue;
    }
    const rule = rules.at(-1);
    if (!rule) throw new Error(`パスの無いヘッダ: ${line}`);
    const [name, ...value] = line.trim().split(":");
    rule.headers.set(name!.toLowerCase(), value.join(":").trim());
  }
  return rules;
}

const rules = parseHeaders(readPublic("_headers"));

function headersFor(path: string): Map<string, string> {
  const merged = new Map<string, string>();
  for (const rule of rules) {
    if (!rule.pattern.test(path)) continue;
    for (const [name, value] of rule.headers) merged.set(name, value);
  }
  return merged;
}

const ISOLATION: Record<string, string> = {
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-embedder-policy": "require-corp",
  "cross-origin-resource-policy": "cross-origin",
};

function isolationHeaders(path: string): Record<string, string> {
  const headers = headersFor(path);
  return Object.fromEntries(
    Object.keys(ISOLATION).flatMap((name) => {
      const value = headers.get(name);
      return value === undefined ? [] : [[name, value]];
    }),
  );
}

describe("_headers", () => {
  it.each(["/node/", "/node/index.html"])(
    "Node の実行環境のパス %s に cross-origin isolation の 3 つのヘッダを返す",
    (path) => {
      expect(isolationHeaders(path)).toStrictEqual(ISOLATION);
    },
  );

  it.each(["/", "/sql/", "/go/", "/assets/node-abc.js", "/nodejs/"])(
    "%s に cross-origin isolation のヘッダを返さない",
    (path) => {
      expect(isolationHeaders(path)).toStrictEqual({});
    },
  );

  it.each(["/", "/node/", "/sql/", "/go/", "/assets/node-abc.js"])(
    "%s に noindex を返す",
    (path) => {
      expect(headersFor(path).get("x-robots-tag")).toBe("noindex");
    },
  );
});

describe("_redirects", () => {
  it("/ だけを fukuemon.dev のプレイグラウンドの一覧へ 302 でリダイレクトする", () => {
    const lines = readPublic("_redirects")
      .split("\n")
      .filter((line) => line.trim() !== "" && !line.startsWith("#"))
      .map((line) => line.trim().split(/\s+/));
    expect(lines).toStrictEqual([["/", "https://fukuemon.dev/playground", "302"]]);
  });
});
