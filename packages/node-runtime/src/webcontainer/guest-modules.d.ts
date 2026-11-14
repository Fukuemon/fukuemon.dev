// DB のプロセスの依存の package.json は文字列のまま、スクリプトは束ねて、実行環境に書く。束ねる処理は vite.ts の guestBundle にある
declare module "*.json?raw" {
  const source: string;
  export default source;
}

declare module "*.ts?bundle" {
  const source: string;
  export default source;
}
