// webcontainer/ は、guest/ のファイルを、ビルドで文字列にして読み込む
declare module "*.cjs?raw" {
  const source: string;
  export default source;
}
