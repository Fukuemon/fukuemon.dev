// subset-font は型を同梱しない。使う引数だけを書く
declare module "subset-font" {
  export default function subsetFont(
    font: Uint8Array,
    text: string,
    options?: { targetFormat?: "sfnt" | "woff" | "woff2" },
  ): Promise<Buffer>;
}
