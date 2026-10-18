select c.conname as name,
       src.relname as src, tgt.relname as tgt,
       (select json_agg(a.attname order by k.i)
        from unnest(c.conkey) with ordinality k(n, i)
        join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.n) as cols,
       (select json_agg(a.attname order by k.i)
        from unnest(c.confkey) with ordinality k(n, i)
        join pg_attribute a on a.attrelid = c.confrelid and a.attnum = k.n) as refs
from pg_constraint c
join pg_class src on src.oid = c.conrelid
join pg_class tgt on tgt.oid = c.confrelid
join pg_namespace n on n.oid = src.relnamespace
where c.contype = 'f' and n.nspname = 'public'
order by src.relname, c.conname
