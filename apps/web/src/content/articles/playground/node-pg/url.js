import pg from "pg";

// 本番のアプリと同じく、接続先を DATABASE_URL で渡す書き方
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const { rows } = await pool.query("select id, user_name from sessions order by id");
console.log(rows);

await pool.end();
