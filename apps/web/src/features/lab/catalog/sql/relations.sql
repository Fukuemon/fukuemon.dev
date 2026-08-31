select c.conname as name,
       src.relname as src, tgt.relname as tgt,
       pg_get_constraintdef(c.oid) as def
from pg_constraint c
join pg_class src on src.oid = c.conrelid
join pg_class tgt on tgt.oid = c.confrelid
join pg_namespace n on n.oid = src.relnamespace
where c.contype = 'f' and n.nspname = 'public'
order by src.relname, c.conname
