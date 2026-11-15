import { readFileSync } from "node:fs";
import { signSvg } from "../../../components/sign/sign";
import { inkSvg } from "./ink-svg";

const ID = "virtual:ink-gate";
const RESOLVED = `\0${ID}`;
const SIGN_PATH = new URL("../../../components/sign/sign.svg", import.meta.url);

/** イントロの墨の絵と署名の SVG を、`.ink-gate` に挿入する HTML の文字列にする */
export function inkGateFragment(sign: string = readFileSync(SIGN_PATH, "utf8")): string {
  return inkSvg().svg + signSvg(sign);
}

/** Vite のプラグインのうち、この仮想モジュールが使う部分 */
interface VirtualModulePlugin {
  readonly name: string;
  resolveId(id: string): string | undefined;
  load(id: string): string | undefined;
}

/**
 * `virtual:ink-gate` の default export を、ビルドのときに作った `inkGateFragment()` の文字列にする。
 * イントロを出すときだけ読み込む `ink-gate-entry.ts` が、この文字列を HTML に挿入する。
 */
export function inkGateVirtualModule(): VirtualModulePlugin {
  return {
    name: "ink-gate-fragment",
    resolveId: (id) => (id === ID ? RESOLVED : undefined),
    load: (id) =>
      id === RESOLVED ? `export default ${JSON.stringify(inkGateFragment())};` : undefined,
  };
}
