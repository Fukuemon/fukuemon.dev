---
contentId: postgres
title: Postgres
description: 手順に縛られず、好きな SQL を投げられます。
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
  - label: 版と実行環境
    sql: select version();
  - label: 実行計画を見る
    sql: |
      explain analyze
      select kind, count(*) from events group by kind;
  - label: インデックスの効き方
    sql: |
      create index if not exists events_kind_idx on events (kind);
      analyze events;

      explain analyze
      select * from events where kind = 'click';
  - label: 統計情報を見る
    sql: |
      select attname, n_distinct, most_common_vals
      from pg_stats where tablename = 'events';
  - label: 設定を覗く
    sql: |
      select name, setting, unit
      from pg_settings
      where name in ('shared_buffers', 'work_mem', 'random_page_cost');
---

ブラウザの中だけで動く Postgres です。サーバーへは何も送りません。

`events` テーブルが 50,000 行入った状態で始まります。
`kind` は `click` が 1/3、`view` が 2/3 です。
