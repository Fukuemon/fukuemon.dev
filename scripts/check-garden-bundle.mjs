#!/usr/bin/env node
// トップの庭の場面の束が、gzip で上限以内かを確認する。上限は docs/design/features/top-garden/DesignDoc.md の「場面の束」にある。
// ビルドした apps/web/dist/ を読むので、pnpm run build の後に流す。
// 終了コード: 0 は上限以内、1 は上限を超えた、2 は束が見つからないか 2 つ以上ある
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const DIR = "apps/web/dist/_astro";
const LIMIT = 160_000;

const files = readdirSync(DIR).filter((f) => /^garden-entry-.*\.js$/.test(f));
if (files.length !== 1) {
  console.error(`${DIR} に場面の束が 1 つだけあるはずが、${files.length} 個あった`);
  process.exit(2);
}
const size = gzipSync(readFileSync(join(DIR, files[0]))).length;
console.log(`場面の束 ${files[0]} は gzip で ${size} バイトで、上限は ${LIMIT} バイトである`);
if (size > LIMIT) process.exit(1);
