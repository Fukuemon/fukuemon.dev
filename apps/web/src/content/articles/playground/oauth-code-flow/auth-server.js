import { randomBytes } from "node:crypto";
import { createServer } from "node:http";

import { escapeHtml, readForm } from "./shared.js";

const PORT = 4000;
const codes = new Map();
const random = () => randomBytes(8).toString("hex");

async function handle(request, response) {
  const url = new URL(request.url, "http://localhost");

  if (url.pathname === "/") {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(
      "<h1>認可サーバー</h1><p>ログインは、3000 番のクライアントのページから始めます。</p>",
    );
    return;
  }

  if (url.pathname === "/authorize" && request.method === "GET") {
    const fields = ["client_id", "redirect_uri", "state"]
      .map(
        (name) =>
          `<input type="hidden" name="${name}" value="${escapeHtml(url.searchParams.get(name) ?? "")}">`,
      )
      .join("");
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(
      `<h1>認可サーバー</h1><p>demo-client に、名前の読み取りを許しますか。</p>` +
        `<form method="post" action="/authorize">${fields}<button>許可する</button></form>`,
    );
    return;
  }

  if (url.pathname === "/authorize" && request.method === "POST") {
    const form = await readForm(request);
    if (!URL.canParse(form.get("redirect_uri"))) {
      response.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
      response.end("<h1>redirect_uri がありません</h1>");
      return;
    }
    const code = random();
    codes.set(code, form.get("client_id"));
    const back = new URL(form.get("redirect_uri"));
    back.searchParams.set("code", code);
    back.searchParams.set("state", form.get("state"));
    response.writeHead(302, { Location: back.href });
    response.end();
    return;
  }

  if (url.pathname === "/token" && request.method === "POST") {
    const form = await readForm(request);
    if (!codes.delete(form.get("code"))) {
      response.writeHead(400, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: "invalid_grant" }));
      return;
    }
    const token = random();
    response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(JSON.stringify({ access_token: token, token_type: "Bearer", expires_in: 3600 }));
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

server.listen(PORT, () => console.log(`認可サーバーが ${PORT} 番で待ち受けています`));
