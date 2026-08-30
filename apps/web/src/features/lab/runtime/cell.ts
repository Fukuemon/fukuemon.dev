/** DB の 1 セルを表示用の文字にする。値の型は engine 任せなので `unknown` で受ける */
export function cellText(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (v instanceof Date) return v.toISOString().replace("T", " ").slice(0, 19);
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "bigint" || typeof v === "boolean") return String(v);
  // JSON にできなければ型名だけ出す
  try {
    return JSON.stringify(v) ?? Object.prototype.toString.call(v);
  } catch {
    return Object.prototype.toString.call(v);
  }
}
