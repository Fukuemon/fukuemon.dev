-- reltuples は ANALYZE が入るまで -1。負値のまま返し、呼ぶ側が断る
select c.relname as name, coalesce(c.reltuples::bigint, -1) as rows
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r' and n.nspname = 'public'
order by c.relname
