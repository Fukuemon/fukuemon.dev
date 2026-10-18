---
contentId: shop
title: 通販の注文
description: 顧客、商品、注文、注文明細の 4 テーブルで、結合、外部キーの索引、ページ送り、集計の実行計画を比べる。
status: published
runtime: pglite
order: 1
setup: |
  create table customers (
    id int primary key,
    name text not null,
    region text not null
  );
  create table products (
    id int primary key,
    name text not null,
    category text not null,
    price int not null
  );
  create table orders (
    id int primary key,
    customer_id int not null references customers (id),
    status text not null,
    ordered_at timestamptz not null
  );
  create table order_items (
    id bigint primary key generated always as identity,
    order_id int not null references orders (id),
    product_id int not null references products (id),
    qty int not null,
    price int not null
  );
  insert into customers
  select g, 'customer ' || g,
         (array['北海道', '東北', '関東', '中部', '近畿', '九州'])[1 + g % 6]
  from generate_series(1, 5000) g;
  insert into products
  select g, 'product ' || g,
         (array['本', '食品', '家電', '衣類'])[1 + g % 4],
         100 * (1 + g % 50)
  from generate_series(1, 1000) g;
  insert into orders
  select g, 1 + (g * 7919) % 5000,
         case when g % 100 = 0 then 'pending'
              when g % 20 = 0 then 'cancelled'
              else 'shipped' end,
         timestamptz '2026-01-01 00:00:00+00' + g * interval '10 minutes'
  from generate_series(1, 30000) g;
  insert into order_items (order_id, product_id, qty, price)
  select o, 1 + (o * 31 + k * 17) % 1000, 1 + (o + k) % 3,
         100 * (1 + (o * 31 + k * 17) % 50)
  from generate_series(1, 30000) o, generate_series(1, 3) k;
  analyze;
presets:
  - label: 顧客 1 人の注文と明細
    sql: |
      explain (analyze, buffers)
      select o.id, o.ordered_at, i.product_id, i.qty
      from orders o
      join order_items i on i.order_id = o.id
      where o.customer_id = 42;
  - label: 顧客ごとの注文数（相関サブクエリ）
    sql: |
      explain (analyze, buffers)
      select c.id,
             (select count(*) from orders o where o.customer_id = c.id) as orders
      from customers c
      where c.id <= 200;
  - label: 外部キーの列に索引を張る
    sql: |
      create index if not exists orders_customer_id_idx on orders (customer_id);
      create index if not exists order_items_order_id_idx on order_items (order_id);
      analyze;

      select tablename, indexname
      from pg_indexes
      where schemaname = 'public'
      order by tablename, indexname;
  - label: OFFSET で 1,001 ページ目を読む
    sql: |
      create index if not exists orders_ordered_at_idx on orders (ordered_at desc, id desc);

      explain (analyze, buffers)
      select id, customer_id, ordered_at
      from orders
      order by ordered_at desc, id desc
      offset 20000 limit 20;
  - label: キーセットで同じページを読む
    sql: |
      create index if not exists orders_ordered_at_idx on orders (ordered_at desc, id desc);

      explain (analyze, buffers)
      select id, customer_id, ordered_at
      from orders
      where (ordered_at, id) < (timestamptz '2026-03-11 10:40:00+00', 10000)
      order by ordered_at desc, id desc
      limit 20;
  - label: 地域ごとの売上
    sql: |
      explain (analyze, buffers)
      select c.region, sum(i.qty * i.price) as sales
      from customers c
      join orders o on o.customer_id = c.id
      join order_items i on i.order_id = o.id
      where o.status = 'shipped'
      group by c.region
      order by sales desc;
---

通販の注文を模した 4 テーブルで始まる。
行数は `customers` が 5,000、`products` が 1,000、`orders` が 30,000、`order_items` が 90,000 である。
`orders.customer_id` と `order_items.order_id`、`order_items.product_id` は外部キーで、参照先の主キーを指す。

Postgres は、主キーと一意制約には索引を作るが、外部キーを持つ側の列には作らない。
そのため、この 3 列には最初は索引がない。
テーブルどうしの関係は、「試す」の「テーブル構成」で図にして見られる。

次の順に実行すると、外部キーの索引の有無で実行計画がどう変わるかを比べられる。

1. 「顧客 1 人の注文と明細」と「顧客ごとの注文数」を実行し、`Seq Scan` の行と `Buffers` の値を見る
2. 「外部キーの列に索引を張る」を実行する
3. 1 の 2 つを実行し直し、`Index Scan` か `Bitmap Index Scan` に変わったことと、`Buffers` の値が減ったことを確かめる

「OFFSET で 1,001 ページ目を読む」と「キーセットで同じページを読む」は、同じ 20 行を返す。
`Index Scan` の行の `rows` を見ると、OFFSET は読み飛ばす 20,000 行も索引から読んでいる。
キーセットは、前のページの最後の行の `ordered_at` と `id` を条件に渡し、20 行だけを読む。
