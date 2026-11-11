import type { HttpActor, HttpExchange } from "./HttpExchangeList";

// カタログに載せるダミーのデータ。ホストは .example にし、Cookie と認可の値はトークンの形にしない
export const ACTORS: HttpActor[] = [
  { id: "browser", name: "ブラウザ" },
  { id: "client", name: "クライアント" },
  { id: "auth", name: "認可サーバー" },
  { id: "db", name: "DB" },
];

export const EXCHANGES: HttpExchange[] = [
  {
    id: "1",
    fromId: "browser",
    toId: "client",
    method: "GET",
    url: "https://client.example/login",
    status: 302,
    request: { headers: [{ name: "Accept", value: "text/html" }] },
    response: {
      headers: [
        { name: "Location", value: "https://auth.example/authorize?response_type=code" },
        { name: "Set-Cookie", value: "state=dummy-state; HttpOnly; SameSite=Lax" },
      ],
    },
  },
  {
    id: "2",
    fromId: "browser",
    toId: "auth",
    method: "GET",
    url: "https://auth.example/authorize?response_type=code",
    status: 200,
    request: { headers: [{ name: "Accept", value: "text/html" }] },
    response: {
      headers: [{ name: "Content-Type", value: "text/html; charset=utf-8" }],
      body: "<form>…</form>",
    },
  },
  {
    id: "3",
    fromId: "client",
    toId: "auth",
    method: "POST",
    url: "https://auth.example/token",
    status: 400,
    request: {
      headers: [{ name: "Content-Type", value: "application/x-www-form-urlencoded" }],
      body: "grant_type=authorization_code&code=dummy-code",
    },
    response: {
      headers: [{ name: "Content-Type", value: "application/json" }],
      body: '{\n  "error": "invalid_grant"\n}',
    },
  },
  {
    id: "4",
    fromId: "auth",
    toId: "db",
    method: "POST",
    url: "https://db.example/query",
    status: 503,
    request: { headers: [{ name: "Content-Type", value: "application/json" }] },
    response: { headers: [{ name: "Retry-After", value: "10" }] },
  },
  {
    id: "5",
    fromId: "client",
    toId: "auth",
    method: "POST",
    url: "https://auth.example/token",
    request: { headers: [{ name: "Content-Type", value: "application/x-www-form-urlencoded" }] },
  },
];

const LONG_QUERY = Array.from({ length: 12 }, (_, i) => `param${i}=value-${i}-dummy`).join("&");

export const LONG_EXCHANGE: HttpExchange = {
  id: "long",
  fromId: "browser",
  toId: "auth",
  method: "GET",
  url: `https://auth.example/authorize?${LONG_QUERY}`,
  status: 200,
  request: {
    headers: [
      { name: "Accept", value: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
      {
        name: "Cookie",
        value: Array.from({ length: 8 }, (_, i) => `dummy_cookie_${i}=value-${i}`).join("; "),
      },
      { name: "X-Dummy-Long-Header-Name-For-Catalog", value: LONG_QUERY },
    ],
  },
  response: {
    headers: [{ name: "Content-Type", value: "application/json" }],
    body: JSON.stringify({ message: LONG_QUERY, items: [1, 2, 3] }),
  },
};
