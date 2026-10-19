---
contentId: postgres
title: イベントの記録
description: 1 テーブル 50,000 行で、実行計画、索引、統計情報、設定を見る。
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

`events` テーブルに 50,000 行が入った状態で始まる。
`kind` は、行の 1/3 が `click`、2/3 が `view` である。
