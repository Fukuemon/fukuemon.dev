import { createServer } from "node:http";
import pg from "pg";

// 接続先は、実行環境が渡す PGHOST、PGUSER、PGDATABASE から読む
const pool = new pg.Pool();

// DB の値とエラーの文は、訪問者が書き換えられるので、HTML に入れる前にエスケープする
const escapeHtml = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
  );

const server = createServer(async (request, response) => {
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  try {
    const { rows } = await pool.query(
      "select id, user_name, created_at from sessions order by created_at",
    );
    const items = rows
      .map((row) => `<li>${escapeHtml(row.id)}: ${escapeHtml(row.user_name)}</li>`)
      .join("");
    response.end(`<h1>セッションの一覧</h1><ul>${items}</ul>`);
  } catch (error) {
    response.statusCode = 500;
    response.end(`<p>${escapeHtml(error.message)}</p>`);
  }
});

server.listen(3000, () => console.log("3000 番で待ち受けています"));
