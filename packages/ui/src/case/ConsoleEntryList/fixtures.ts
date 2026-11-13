import type { ConsoleEntry } from "./ConsoleEntryList";

// カタログに載せるダミーのデータ。ホストは .example にし、利用者の名前はダミーにする
export const ENTRIES: ConsoleEntry[] = [
  {
    id: "1",
    level: "debug",
    source: "server.js",
    time: "10:00:00.120",
    args: [{ kind: "string", value: "設定を読み込んだ" }],
  },
  {
    id: "2",
    level: "log",
    source: "server.js",
    time: "10:00:00.180",
    args: [
      { kind: "string", value: "listening on" },
      { kind: "number", value: 3000 },
    ],
  },
  {
    id: "3",
    level: "info",
    source: "プレビュー",
    time: "10:00:01.002",
    args: [
      { kind: "string", value: "ログインした利用者" },
      {
        kind: "object",
        entries: [
          { key: "id", value: { kind: "number", value: 42 } },
          { key: "name", value: { kind: "string", value: "山田 花子" } },
          {
            key: "roles",
            value: {
              kind: "array",
              items: [
                { kind: "string", value: "reader" },
                { kind: "string", value: "writer" },
              ],
            },
          },
          {
            key: "session",
            value: {
              kind: "object",
              entries: [
                { key: "expiresAt", value: { kind: "string", value: "2026-11-14T10:00:00Z" } },
                { key: "refresh", value: { kind: "boolean", value: true } },
              ],
            },
          },
        ],
      },
    ],
  },
  {
    id: "4",
    level: "warn",
    source: "server.js",
    time: "10:00:01.250",
    args: [{ kind: "string", value: "state のパラメータがありません" }],
  },
  {
    id: "5",
    level: "error",
    source: "server.js",
    time: "10:00:01.300",
    args: [
      {
        kind: "error",
        name: "TypeError",
        message: "Cannot read properties of undefined (reading 'token')",
        stack: [
          "at callback (/home/project/src/callback.js:12:20)",
          "at Server.<anonymous> (/home/project/src/server.js:30:5)",
        ],
      },
    ],
  },
  {
    id: "6",
    level: "log",
    source: "server.js",
    time: "10:00:02.000",
    args: [
      {
        kind: "map",
        entries: [
          {
            key: { kind: "string", value: "client.example" },
            value: { kind: "number", value: 2 },
          },
          {
            key: { kind: "string", value: "auth.example" },
            value: { kind: "number", value: 1 },
          },
        ],
      },
      {
        kind: "set",
        items: [
          { kind: "string", value: "GET" },
          { kind: "string", value: "POST" },
        ],
      },
    ],
  },
  {
    id: "7",
    level: "log",
    source: "プレビュー",
    time: "10:00:02.100",
    args: [
      {
        kind: "object",
        className: "Node",
        entries: [
          { key: "value", value: { kind: "number", value: 1 } },
          { key: "next", value: { kind: "circular" } },
          { key: "render", value: { kind: "function", name: "render" } },
          { key: "element", value: { kind: "text", value: "<button#login>" } },
        ],
      },
    ],
  },
];

export const LONG_ENTRY: ConsoleEntry = {
  id: "long",
  level: "error",
  source: "server.js",
  args: [
    {
      kind: "string",
      value:
        "fetch failed: https://auth.example/oauth2/token?grant_type=authorization_code&code=dummy-code-value-that-is-very-long&redirect_uri=https%3A%2F%2Fclient.example%2Fcallback",
    },
  ],
};
