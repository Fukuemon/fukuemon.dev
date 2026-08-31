-- public の全テーブルの列を 1 回で取る。呼ぶ側が attrelid ごとに束ねる
select c.relname as table_name,
       a.attname as name,
       format_type(a.atttypid, a.atttypmod) as type,
       not a.attnotnull as nullable,
       coalesce(i.indisprimary, false) as pk
from pg_attribute a
join pg_class c on c.oid = a.attrelid
join pg_namespace n on n.oid = c.relnamespace
left join pg_index i
  on i.indrelid = a.attrelid and a.attnum = any(i.indkey) and i.indisprimary
where c.relkind = 'r' and n.nspname = 'public' and a.attnum > 0 and not a.attisdropped
order by c.relname, a.attnum
