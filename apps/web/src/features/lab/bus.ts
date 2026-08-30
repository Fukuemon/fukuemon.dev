import { useEffect, useRef } from "react";

const RAN = "lab:ran";
const PRESET = "lab:preset";

type Detail = { contentId: string };
type PresetDetail = Detail & { sql: string };

export function emitRan(contentId: string): void {
  globalThis.dispatchEvent(new CustomEvent(RAN, { detail: { contentId } }));
}

export function emitPreset(contentId: string, sql: string): void {
  globalThis.dispatchEvent(new CustomEvent(PRESET, { detail: { contentId, sql } }));
}

function useBus<T extends Detail>(type: string, contentId: string, on: (detail: T) => void): void {
  // 依存に入れると、呼ぶ側が useCallback を外した途端に毎レンダー購読を張り直す
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
