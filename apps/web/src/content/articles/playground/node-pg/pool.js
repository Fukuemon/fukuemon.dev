import pg from "pg";

// 引数なしの Pool は、実行環境が渡す PGHOST、PGUSER、PGDATABASE で接続する
const pool = new pg.Pool();

// 何度実行しても主キーが重ならないよう、ID を毎回作る
const id = `s-${crypto.randomUUID().slice(0, 8)}`;
await pool.query("insert into sessions (id, user_name) values ($1, $2)", [id, "carol"]);
const count = await pool.query("select count(*) from sessions");
console.log("セッションの数:", count.rows[0].count);
const latest = await pool.query(
  "select id, user_name from sessions order by created_at desc limit 1",
);
console.log("最後のセッション:", latest.rows[0]);

await pool.end();
