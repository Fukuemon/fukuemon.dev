import { randomBytes } from "node:crypto";
import { createServer } from "node:http";

import { browserUrl, readCookies } from "./shared.js";

const PORT = 3000;
const AUTH_PORT = 4000;
const sessions = new Map();
const random = () => randomBytes(8).toString("hex");

async function handle(request, response) {
  const url = new URL(request.url, "http://localhost");
  const cookies = readCookies(request);

  if (url.pathname === "/") {
    const token = sessions.get(cookies.session);
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(
      token
        ? `<h1>ログインしました</h1><p>アクセストークンを受け取りました。有効期限は ${token.expires_in} 秒です。</p>`
        : `<h1>クライアント</h1><p><a href="/login">認可サーバーでログインする</a></p>`,
    );
    return;
  }

  if (url.pathname === "/login") {
    const state = random();
    const authorize = new URL("/authorize", browserUrl(AUTH_PORT));
    authorize.searchParams.set("response_type", "code");
    authorize.searchParams.set("client_id", "demo-client");
    authorize.searchParams.set("redirect_uri", new URL("/callback", browserUrl(PORT)).href);
    authorize.searchParams.set("state", state);
    response.writeHead(302, {
      Location: authorize.href,
      "Set-Cookie": `state=${state}; HttpOnly; Path=/`,
    });
    response.end();
    return;
  }

  if (url.pathname === "/callback") {
    if (cookies.state !== url.searchParams.get("state")) {
      response.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
      response.end("<h1>state が一致しません</h1>");
      return;
    }
    // サーバーの間の通信は、ブラウザを通さず、実行環境の中の localhost へ送る
    const tokenResponse = await fetch(`http://localhost:${AUTH_PORT}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: url.searchParams.get("code"),
        client_id: "demo-client",
      }),
    });
    if (!tokenResponse.ok) {
      response.writeHead(502, { "Content-Type": "text/html; charset=utf-8" });
      response.end("<h1>トークンを受け取れませんでした</h1>");
      return;
    }
    const session = random();
    sessions.set(session, await tokenResponse.json());
    response.writeHead(302, {
      Location: "/",
      "Set-Cookie": `session=${session}; HttpOnly; Path=/`,
    });
    response.end();
    return;
  }

  response.writeHead(404).end();
}

const server = createServer((request, response) => {
  handle(request, response).catch((error) => {
    console.error(error);
    if (!response.headersSent) response.writeHead(500);
    response.end();
  });
});

server.listen(PORT, () => console.log(`クライアントが ${PORT} 番で待ち受けています`));
