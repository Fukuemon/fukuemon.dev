import { useEffect, useRef } from "react";

/**
 * 島をまたぐ通知。
 *
 * 実行パネルと側柱は別の React root なので、props でも context でも繋がらない。
 * 唯一の共通の足場が `document` なので、CustomEvent を通す。
 *
 * **購読は必ずこの層を通す。** `addEventListener` を component に置くと、
 * 事象名と `contentId` の照合が使う側の数だけ重複する。
 */

/** 実行パネルが走り終えた合図。側柱が DB を引き直す */
const RAN = "lab:ran";
/** 側柱の「試す」から実行パネルの入力欄へ SQL を渡す */
const PRESET = "lab:preset";

type Detail = { contentId: string };
type PresetDetail = Detail & { sql: string };

export function emitRan(contentId: string): void {
  globalThis.dispatchEvent(new CustomEvent(RAN, { detail: { contentId } }));
}

export function emitPreset(contentId: string, sql: string): void {
  globalThis.dispatchEvent(new CustomEvent(PRESET, { detail: { contentId, sql } }));
}

/**
 * 外部システム (別の島) の購読。React の Effect が正しく残る用途である。
 *
 * `on` は ref 経由で読む。依存に入れると、呼ぶ側が `useCallback` を外した途端に
 * 毎レンダー購読を張り直す。
 */
function useBus<T extends Detail>(type: string, contentId: string, on: (detail: T) => void): void {
  const latest = useRef(on);
  useEffect(() => {
    latest.current = on;
  });
  useEffect(() => {
    const handle = (e: Event) => {
      const detail = (e as CustomEvent<T>).detail;
      if (detail.contentId === contentId) latest.current(detail);
    };
    globalThis.addEventListener(type, handle);
    return () => globalThis.removeEventListener(type, handle);
  }, [type, contentId]);
}

export function useRan(contentId: string, on: () => void): void {
  useBus<Detail>(RAN, contentId, on);
}

export function usePreset(contentId: string, on: (sql: string) => void): void {
  useBus<PresetDetail>(PRESET, contentId, (d) => on(d.sql));
}
