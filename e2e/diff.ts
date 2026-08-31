/**
 * 2 つの撮影結果を突き合わせる。
 *
 *   pnpm run shot:diff <前> <後>
 *
 * 3px の差は目で追えない。一致しない枚数と、最初の食い違いを報告する。
 */
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";

const digest = async (p: string) =>
  createHash("sha256")
    .update(await readFile(p))
    .digest("hex");

async function main(): Promise<void> {
  const [before, after] = process.argv.slice(2);
  if (!before || !after) throw new Error("2 つのディレクトリを渡してください");

  const [a, b] = await Promise.all([readdir(before), readdir(after)]);
  const names = [...new Set([...a, ...b])].sort((x, y) => x.localeCompare(y));
  const missing: string[] = [];
  const changed: string[] = [];

  for (const name of names) {
    if (!a.includes(name) || !b.includes(name)) {
      missing.push(name);
      continue;
    }
    const [x, y] = await Promise.all([digest(join(before, name)), digest(join(after, name))]);
    if (x !== y) changed.push(name);
  }

  console.log(`${names.length} 枚を突き合わせました`);
  for (const m of missing) console.error(`  片方にしかない: ${m}`);
  for (const c of changed) console.error(`  一致しない: ${c}`);
  if (missing.length > 0 || changed.length > 0) process.exit(1);
  console.log("全て一致しました");
}

await main();
