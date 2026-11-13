import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type Rule = { pattern: RegExp; headers: Map<string, string> };

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

const rules = parseHeaders(readFileSync(new URL("../public/_headers", import.meta.url), "utf8"));

function headersFor(path: string): Map<string, string> {
  const merged = new Map<string, string>();
  for (const rule of rules) {
    if (!rule.pattern.test(path)) continue;
    for (const [name, value] of rule.headers) merged.set(name, value);
  }
  return merged;
}

const ISOLATION = {
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-embedder-policy": "require-corp",
  "cross-origin-resource-policy": "cross-origin",
};

describe("_headers", () => {
  it.each(["/node/", "/node/index.html"])(
    "Node の実行環境のパス %s に cross-origin isolation の 3 つのヘッダを返す",
    (path) => {
      const headers = headersFor(path);
      for (const [name, value] of Object.entries(ISOLATION)) {
        expect(headers.get(name)).toBe(value);
      }
    },
  );

  it.each(["/", "/sql/", "/go/", "/assets/node-abc.js", "/nodejs/"])(
    "%s に cross-origin isolation のヘッダを返さない",
    (path) => {
      const headers = headersFor(path);
      for (const name of Object.keys(ISOLATION)) {
        expect(headers.has(name)).toBe(false);
      }
    },
  );

  it.each(["/", "/node/", "/sql/", "/go/", "/assets/node-abc.js"])(
    "%s に noindex を返す",
    (path) => {
      expect(headersFor(path).get("x-robots-tag")).toBe("noindex");
    },
  );
});
