import { afterEach, beforeEach } from "vite-plus/test";
import { cdp, userEvent } from "vite-plus/test/browser/context";

// cdp() の型に send() が付くのはプロバイダの型を読み込んだときだけで、このプロジェクトの tsc では付かない
type CdpSend = { send: (method: string, params: object) => Promise<unknown> };

const setForcedColors = (value: "active" | "none") =>
  (cdp() as unknown as CdpSend).send("Emulation.setEmulatedMedia", {
    features: [{ name: "forced-colors", value }],
  });

/** describe の中で呼ぶと、そのテストの間だけ、ブラウザを `forced-colors: active` にする。 */
export function useForcedColors() {
  beforeEach(() => setForcedColors("active"));
  afterEach(() => setForcedColors("none"));
}

export const style = (element: Element) => getComputedStyle(element);

/** 何も塗られていない背景の色。ハイコントラストでは `body` の背景が Canvas になる。 */
export const canvas = () => style(document.body).backgroundColor;

/** Tab のキーを 1 回押して、フォーカスを受けた要素の輪を返す。 */
export async function outlineAfterTab(element: HTMLElement) {
  await userEvent.tab();
  const outline = style(element);
  return {
    focused: document.activeElement === element,
    style: outline.outlineStyle,
    width: outline.outlineWidth,
  };
}

export const FOCUS_RING = { focused: true, style: "solid", width: "2px" };
