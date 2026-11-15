import { readFileSync } from "node:fs";

// ブラウザから見えるサーバーの URL は、実行環境が決めて、このファイルに書く
export function browserUrl(port) {
  const ports = JSON.parse(readFileSync(process.env.PLAYGROUND_PORTS_FILE, "utf8"));
  return ports[port];
}

export function readCookies(request) {
  return Object.fromEntries(
    (request.headers.cookie ?? "")
      .split(/;\s*/)
      .filter(Boolean)
      .map((pair) => pair.split("=")),
  );
}

export async function readForm(request) {
  let body = "";
  for await (const chunk of request) body += chunk;
  return new URLSearchParams(body);
}

const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export const escapeHtml = (text) => text.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
