---
contentId: wal-and-checkpoint
title: WAL とチェックポイントの関係を 3 分で掴む
description: WAL とチェックポイントの仕組みと、書き込みが周期的に遅くなるときに見る統計と設定を説明します。
tags: [postgres]
status: published
publishedAt: 2026-08-30
related: [vacuum-and-bloat]
---

書き込みが定期的に遅くなり、グラフに山が等間隔で並ぶことがあります。
このとき、まずチェックポイントを確かめます。

## 更新は 2 回書かれる

`UPDATE` が返ってきた時点で、変更はデータファイルに届いていません。
届いているのは WAL (Write-Ahead Log) だけです。

順番は次のとおりです。

1. 共有バッファ上のページを書き換える。この時点ではメモリだけ
2. 変更内容を WAL に追記する
3. コミット時に WAL を `fsync` する。**ここまで来たら変更は失われない**
4. データファイルへの反映は後回し

WAL は追記だけなので、ディスクの連続した場所に順に書けます。
データファイルはページが散らばっているので、書けばランダム書き込みになります。

WAL は、遅いランダム書き込みを後回しにして、速い追記だけをコミットの待ちに入れるためにあります。
後回しにしたページを、まとめてデータファイルへ書くのがチェックポイントです。

## チェックポイントが山を作る

チェックポイントは、共有バッファ上の未反映のページをデータファイルへ書き出します。
このとき I/O が急に増えます。等間隔の山は、この I/O です。

チェックポイントが始まる条件は 2 つです。

| 条件           | 設定                 | 既定 |
| -------------- | -------------------- | ---- |
| 時間が来た     | `checkpoint_timeout` | 5 分 |
| WAL が溜まった | `max_wal_size`       | 1 GB |

どちらの条件で始まっているかを、先に確かめてください。対処が変わります。

```sql
select num_timed, num_requested,
       buffers_written, write_time, sync_time
from pg_stat_checkpointer;
```

`num_timed` は `checkpoint_timeout` で始まった回数、`num_requested` は `max_wal_size` に達したときなど、要求で始まった回数です。
`num_requested` が `num_timed` に対して多いなら、`max_wal_size` が書き込み量に対して小さすぎます。

Postgres 16 までは、同じ値を `pg_stat_bgwriter` から別の列の名前で読みます。

```sql
select checkpoints_timed, checkpoints_req,
       buffers_checkpoint, checkpoint_write_time, checkpoint_sync_time
from pg_stat_bgwriter;
```

## 間隔を延ばすと山が高くなる

`checkpoint_timeout` を延ばせば回数は減ります。
そのぶん 1 回で書き出す量が増えます。
書き出す総量は変わらず、山が低く広くなるか、高く狭くなるかが変わるだけです。

延ばす代償は復旧時間です。
クラッシュしたとき、最後のチェックポイント以降の WAL を全部読み直します。間隔が長いほど、読み直す量が増えます。

書き出しを時間の上で均す設定が `checkpoint_completion_target` です。
既定の `0.9` は「次のチェックポイントまでの 90% の時間をかけて、少しずつ書き出す」という意味です。

変える設定と、その代償は次のとおりです。

| したいこと                         | 変える設定                                       | 代償                       |
| ---------------------------------- | ------------------------------------------------ | -------------------------- |
| 山の回数を減らす                   | `checkpoint_timeout` を延ばす                    | 復旧時間が延びる           |
| 要求によるチェックポイントを減らす | `max_wal_size` を増やす                          | ディスクの使用量が増える   |
| 山を低くする                       | `checkpoint_completion_target` を 1.0 へ近づける | ほとんどない。既定値は 0.9 |

## full page writes

チェックポイントの直後だけ、WAL の量が急に増えることがあります。

Postgres は、チェックポイントの後に最初に変更されたページを、差分ではなくページ丸ごと WAL に書きます。
書き込みの途中で電源が落ち、ページが半分だけ書かれた状態 (torn page) から復旧するためです。

このため、山を低くしようとチェックポイントの間隔を縮めると、**WAL の総量が増えます。**

## 見る順序

1. `pg_stat_checkpointer` で `num_requested` と `num_timed` の比を見る
2. `num_requested` が多いなら `max_wal_size` を増やす
3. `num_timed` ばかりで山が高いなら `checkpoint_completion_target` を確かめる
4. それでも高いなら、山の原因はチェックポイントではない。VACUUM を確かめる

4 つ目は [VACUUM と肥大化を自分で作る](/labs/vacuum-and-bloat) で確かめられます。
