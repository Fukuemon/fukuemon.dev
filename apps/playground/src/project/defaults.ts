import type { PlaygroundProject } from "@fukuemon/playground-project";

const QUERY = `-- 注文の多い利用者を 10 人出す
select u.name, count(*) as orders
from orders o
join users u on u.id = o.user_id
group by u.name
order by orders desc
limit 10;

-- 実行計画を見るときは、先頭に付ける
-- explain (analyze, buffers)
`;

const INITIAL_SQL = `create table users (id int primary key, name text not null);
create table orders (id int primary key, user_id int not null references users (id), total int not null);
insert into users select i, 'user-' || i from generate_series(1, 1000) as i;
insert into orders select i, 1 + (i * 7919) % 1000, (i * 31) % 5000 from generate_series(1, 20000) as i;
create index orders_user_id on orders (user_id);
analyze;
`;

/** `project` を付けずに開いたときの、SQL だけを動かすツールのプロジェクト。 */
export const sqlDefaultProject = {
  tool: "sql",
  version: "default-1",
  files: { "query.sql": QUERY },
  open: "query.sql",
  initialSql: INITIAL_SQL,
} satisfies PlaygroundProject;
