---
contentId: postgres
title: Postgres
description: ハンズオンの手順に沿わずに、好きな SQL を実行できます。
status: published
runtime: pglite
order: 0
setup: |
  create table events (
    id bigserial primary key,
    kind text not null,
    at timestamptz not null default now()
  );
  insert into events (kind, at)
  select case when g % 3 = 0 then 'click' else 'view' end,
         now() - (g || ' seconds')::interval
  from generate_series(1, 50000) g;
  analyze events;
presets:
  - label: バージョンと実行環境
    sql: select version();
  - label: 実行計画を見る
    sql: |
      explain analyze
      select kind, count(*) from events group by kind;
  - label: インデックスを使う計画
    sql: |
      create index if not exists events_kind_idx on events (kind);
      analyze events;

      explain analyze
      select * from events where kind = 'click';
  - label: 統計情報を見る
    sql: |
      select attname, n_distinct, most_common_vals
      from pg_stats where tablename = 'events';
  - label: 設定を見る
    sql: |
      select name, setting, unit
      from pg_settings
      where name in ('shared_buffers', 'work_mem', 'random_page_cost');
---

`events` テーブルが 50,000 行入った状態で始まります。
`kind` は `click` が 1/3、`view` が 2/3 です。
