import { describe, expect, it } from "vitest";
import type { Relation } from "./catalog";
import { layoutEr, orderEntities, type Entity } from "./er-layout";

const col = (name: string, pk = false) => ({ name, type: "integer", nullable: false, pk });
const ent = (name: string, ...cols: string[]): Entity => ({
  name,
  columns: [col("id", true), ...cols.map((c) => col(c))],
});
const fk = (src: string, column: string, tgt: string): Relation => ({
  name: `${src}_${column}_fkey`,
  src,
  tgt,
  cols: [column],
  refs: ["id"],
});

const SHOP = [
  ent("customers"),
  ent("order_items", "order_id"),
  ent("orders", "customer_id"),
  ent("tags"),
];
const LINKS = [fk("orders", "customer_id", "customers"), fk("order_items", "order_id", "orders")];

describe("orderEntities", () => {
  it("関係の多いテーブルから始め、つながる先を続けて並べる", () => {
    expect(orderEntities(SHOP, LINKS).map((e) => e.name)).toStrictEqual([
      "orders",
      "customers",
      "order_items",
      "tags",
    ]);
  });

  it("関係が無ければ渡された順を保つ", () => {
    expect(orderEntities(SHOP, []).map((e) => e.name)).toStrictEqual(SHOP.map((e) => e.name));
  });
});

describe("layoutEr", () => {
  it("1 列では全テーブルを同じ x に積み、線を箱の右へ逃がす", () => {
    const { placed, edges, width } = layoutEr(SHOP, LINKS, 1);
    expect(new Set(placed.map((e) => e.x)).size).toBe(1);
    expect(edges.every((e) => e.d.includes(" H "))).toBe(true);
    expect(width).toBeGreaterThan(210 + 2 * 12);
  });

  it("線の両端は外部キーの列と参照先の列の行に付く", () => {
    const { placed, edges } = layoutEr(SHOP, LINKS, 1);
    const orders = placed.find((e) => e.name === "orders");
    const customers = placed.find((e) => e.name === "customers");
    const edge = edges.find((e) => e.key === "orders_customer_id_fkey");
    // orders の 2 行目 (customer_id) から出て、customers の 1 行目 (id) に点を打つ
    expect(edge?.d.startsWith(`M ${orders!.x + 210} ${orders!.y + 26 + 19 + 9.5} `)).toBe(true);
    expect(edge?.dot).toStrictEqual({ x: customers!.x + 210, y: customers!.y + 26 + 9.5 });
  });

  it("外部キーの列を FK として返す", () => {
    expect([...layoutEr(SHOP, LINKS, 2).fk].sort()).toStrictEqual([
      "order_items.order_id",
      "orders.customer_id",
    ]);
  });

  it("テーブルが 1 つなら 2 列を求めても 1 列で描く", () => {
    const { placed } = layoutEr([ent("events")], [], 2);
    expect(placed[0]?.x).toBe(12);
  });
});
