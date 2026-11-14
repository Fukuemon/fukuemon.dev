/** iOS と iPadOS を見分けるのに使う、ブラウザの情報。`navigator` をそのまま渡せる。 */
export interface DeviceInfo {
  userAgent: string;
  maxTouchPoints: number;
}

/**
 * iOS か iPadOS の WebKit のブラウザなら true を返す。
 * iPadOS の Safari は、標準の設定で Mac の Safari と同じ UA を名乗るので、Macintosh を名乗り触る点を 2 つ以上持つものを iPadOS とみなす。
 */
export const isAppleTouchDevice = ({ userAgent, maxTouchPoints }: DeviceInfo) =>
  /\b(iPhone|iPad|iPod)\b/.test(userAgent) ||
  (/\bMacintosh\b/.test(userAgent) && maxTouchPoints > 1);

/**
 * iOS と iPadOS のときだけ、viewport の指定に `maximum-scale=1` を足し、16px 未満の入力欄にフォーカスしたときの自動の拡大を止める。
 * iOS 10 からの Safari はピンチズームを止めない。Android の Chrome はピンチズームも止めるので、ほかの端末では何もしない（docs/adr/0071-touch-targets-and-ios-zoom-in-playground.md）。
 * ページの読み込みの初めに 1 回呼ぶ。
 */
export function limitIosInputZoom(doc: Document = document, device: DeviceInfo = navigator) {
  if (!isAppleTouchDevice(device)) return;
  const meta = doc.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (!meta || /maximum-scale/.test(meta.content)) return;
  meta.content = `${meta.content}, maximum-scale=1`;
}
