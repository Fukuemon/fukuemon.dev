/**
 * SQL を 5 トークンへ分ける。
 *
 * 依存を足さない。Shiki は gzip 70KB、TanStack Highlight は 2.9KB だが 0.0.x で、
 * どちらもこのサイトの `--c-*` とは別の色体系を持ち込む。
 * SQL の字句は単純なので、既存の `.t-*` へ直接落とす。
 */

export type Tok = { t: "com" | "lit" | "key" | "id" | ""; v: string };

// 予約語。大小を無視して照合する
const KEYWORDS = new Set(
  `select from where group by order having limit offset insert into values update set delete
   create table index view drop alter add column constraint primary key foreign references
   unique not null default check cascade join inner left right full outer on using union all
   distinct as and or in exists between like ilike is case when then else end asc desc
   explain analyze verbose buffers vacuum begin commit rollback with recursive returning
   generate_series interval now count sum avg min max coalesce cast text int bigint serial
   bigserial timestamptz boolean numeric jsonb array true false`
    .split(/\s+/)
    .filter(Boolean),
);

const WORD = /[A-Za-z_][A-Za-z0-9_]*/y;
const NUM = /\d+(?:\.\d+)?/y;
const SPACE = /\s+/y;

/** 字句へ分ける。分からないものは "" (無印) にして地の色で出す */
export function tokenizeSql(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;

  const push = (t: Tok["t"], v: string) => {
    const last = out[out.length - 1];
    if (last && last.t === t) last.v += v;
    else out.push({ t, v });
  };

  const at = (re: RegExp): string | undefined => {
    re.lastIndex = i;
    const m = re.exec(src);
    return m ? m[0] : undefined;
  };

  while (i < src.length) {
    const c = src[i] as string;

    // 行コメント
    if (c === "-" && src[i + 1] === "-") {
      const end = src.indexOf("\n", i);
      const stop = end === -1 ? src.length : end;
      push("com", src.slice(i, stop));
      i = stop;
      continue;
    }
    // ブロックコメント
    if (c === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      const stop = end === -1 ? src.length : end + 2;
      push("com", src.slice(i, stop));
      i = stop;
      continue;
    }
    // 文字列。'' は中のエスケープ
    if (c === "'") {
      let j = i + 1;
      while (j < src.length) {
        if (src[j] === "'" && src[j + 1] === "'") j += 2;
        else if (src[j] === "'") {
          j++;
          break;
        } else j++;
      }
      push("lit", src.slice(i, j));
      i = j;
      continue;
    }
    // 引用識別子
    if (c === '"') {
      const end = src.indexOf('"', i + 1);
      const stop = end === -1 ? src.length : end + 1;
      push("id", src.slice(i, stop));
      i = stop;
      continue;
    }

    const space = at(SPACE);
    if (space !== undefined) {
      push("", space);
      i += space.length;
      continue;
    }

    const num = at(NUM);
    if (num !== undefined) {
      push("lit", num);
      i += num.length;
      continue;
    }

    const word = at(WORD);
    if (word !== undefined) {
      push(KEYWORDS.has(word.toLowerCase()) ? "key" : "id", word);
      i += word.length;
      continue;
    }

    push("", c);
    i++;
  }
  return out;
}

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };
const escape = (s: string) => s.replace(/[&<>]/g, (c) => ESC[c] as string);

/** `.t-*` を付けた HTML にする。クラスは utilities.css が --c-* へ落とす */
export function highlightSql(src: string): string {
  // 末尾の改行が pre で潰れないよう 1 つ足す
  return tokenizeSql(`${src}\n`)
    .map((tok) => (tok.t === "" ? escape(tok.v) : `<span class="t-${tok.t}">${escape(tok.v)}</span>`))
    .join("");
}
