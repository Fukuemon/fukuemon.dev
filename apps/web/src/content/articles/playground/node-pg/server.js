import { createServer } from "node:http";
import pg from "pg";

// 接続先は、実行環境が渡す PGHOST、PGUSER、PGDATABASE から読む
const pool = new pg.Pool();

const server = createServer(async (request, response) => {
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  try {
    const { rows } = await pool.query(
      "select id, user_name, created_at from sessions order by created_at",
    );
    const items = rows.map((row) => `<li>${row.id}: ${row.user_name}</li>`).join("");
    response.end(`<h1>セッションの一覧</h1><ul>${items}</ul>`);
  } catch (error) {
    response.statusCode = 500;
    response.end(`<p>${error.message}</p>`);
  }
});

server.listen(3000, () => console.log("3000 番で待ち受けています"));
