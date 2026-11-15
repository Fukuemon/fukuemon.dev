import { createServer } from "node:http";

const server = createServer((request, response) => {
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.end(`<h1>記事から開いた実行環境</h1><p>${request.method} ${request.url}</p>`);
});

server.listen(3000, () => console.log("3000 番で待ち受けています"));
