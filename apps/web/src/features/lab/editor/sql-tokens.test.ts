import { describe, expect, it } from "vitest";
import { highlightSql, tokenizeSql } from "./sql-tokens";

const kinds = (src: string) => tokenizeSql(src).map((t) => `${t.t || "-"}:${t.v}`);

describe("tokenizeSql", () => {
  it("予約語を大小を無視して拾う", () => {
    expect(kinds("SELECT x")).toEqual(["key:SELECT", "-: ", "id:x"]);
  });

  it("予約語でない語は識別子にする", () => {
    expect(kinds("events")).toEqual(["id:events"]);
  });

  it("数値をリテラルにする", () => {
    expect(kinds("limit 10")).toEqual(["key:limit", "-: ", "lit:10"]);
  });

  it("小数を 1 つのリテラルにする", () => {
    expect(kinds("1.5")).toEqual(["lit:1.5"]);
  });

  it("文字列リテラルを引用符ごと拾う", () => {
    expect(kinds("'a b'")).toEqual(["lit:'a b'"]);
  });

  it("エスケープした引用符で文字列を閉じない", () => {
    expect(kinds("'it''s'")).toEqual(["lit:'it''s'"]);
  });

  it("閉じていない文字列は末尾まで飲む", () => {
    expect(kinds("'abc")).toEqual(["lit:'abc"]);
  });

  it("行コメントを拾う", () => {
    expect(kinds("-- x\ny")).toEqual(["com:-- x", "-:\n", "id:y"]);
  });

  it("ブロックコメントを拾う", () => {
    expect(kinds("/* a */ b")).toEqual(["com:/* a */", "-: ", "id:b"]);
  });

  it("閉じていないブロックコメントは末尾まで飲む", () => {
    expect(kinds("/* a")).toEqual(["com:/* a"]);
  });

  it("記号は無印にして地の色で出す", () => {
    expect(kinds("a,b")).toEqual(["id:a", "-:,", "id:b"]);
  });

  it("同じ種類が続いたら 1 つにまとめる", () => {
    expect(kinds("a  b")).toEqual(["id:a", "-:  ", "id:b"]);
  });

  it("空文字では何も返さない", () => {
    expect(tokenizeSql("")).toEqual([]);
  });

  it("引用識別子を 1 つの識別子にする", () => {
    expect(kinds('"My Table"')).toEqual(['id:"My Table"']);
  });

  it("閉じていない引用識別子は末尾まで飲む", () => {
    expect(kinds('"abc')).toEqual(['id:"abc']);
  });
});

describe("highlightSql", () => {
  it("HTML を素通しさせない", () => {
    const html = highlightSql("select '<script>alert(1)</script>'");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("& を先に変換して二重エスケープしない", () => {
    expect(highlightSql("a & b")).toContain("&amp;");
    expect(highlightSql("a & b")).not.toContain("&amp;amp;");
  });

  it("種類ごとの class を付ける", () => {
    const html = highlightSql("select 1");
    expect(html).toContain('class="t-key"');
    expect(html).toContain('class="t-lit"');
  });
});
