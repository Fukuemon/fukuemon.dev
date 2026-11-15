import pg from "pg";

const client = new pg.Client();
await client.connect();

const now = await client.query("select now()");
console.log("DB の時刻:", now.rows[0].now);
const count = await client.query("select count(*) from sessions");
console.log("セッションの数:", count.rows[0].count);
const names = await client.query("select user_name from sessions order by user_name");
console.log("利用者:", names.rows.map((row) => row.user_name).join(", "));

await client.end();
