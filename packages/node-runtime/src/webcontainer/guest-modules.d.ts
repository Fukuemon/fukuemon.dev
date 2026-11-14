// DB のプロセスの依存の package.json は文字列のまま、スクリプトは束ねて、実行環境に書く。束ねる処理は vite.ts の guestBundle にある
// index.ts が参照で読み込み、index.ts を import する apps/playground の tsc にも型を渡す。modules.d.ts は参照しないので、分けて置く
declare module "*.json?raw" {
  const source: string;
  export default source;
}

declare module "*.ts?bundle" {
  const source: string;
  export default source;
}
