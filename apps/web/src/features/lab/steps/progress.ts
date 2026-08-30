export type Progress = {
  completedSteps: number[];
  lastStep: number;
};

// path は改名されうる。contentId を鍵にして改名で進捗が消えないようにする
const key = (contentId: string) => `lab:${contentId}`;

/** 実行パネルと手順一覧は別の island になる。書き込みを知らせる */
export const PROGRESS_EVENT = "lab:progress";

export type ProgressEvent = CustomEvent<{ contentId: string; value: Progress }>;

const clamp = (n: number, max: number) => Math.min(Math.max(0, Math.trunc(n)), Math.max(0, max));

/**
 * localStorage はプライベートウィンドウや設定で例外を投げる。読めなくてもページを壊さない。
 * 手順を減らすと古い番号が残るので、必ず現在の手順数で丸める。
 */
export function loadProgress(contentId: string, stepCount = Number.MAX_SAFE_INTEGER): Progress | undefined {
  try {
    const raw = globalThis.localStorage?.getItem(key(contentId));
    if (!raw) return undefined;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return undefined;
    const { completedSteps, lastStep } = parsed as Partial<Progress>;
    if (!Array.isArray(completedSteps) || typeof lastStep !== "number") return undefined;
    const max = stepCount - 1;
    return {
      completedSteps: [
        ...new Set(
          completedSteps.filter((n) => Number.isInteger(n) && n >= 0 && n <= max).map(Number),
        ),
      ].sort((a, b) => a - b),
      lastStep: clamp(lastStep, max),
    };
  } catch {
    return undefined;
  }
}

export function saveProgress(contentId: string, value: Progress): void {
  try {
    globalThis.localStorage?.setItem(key(contentId), JSON.stringify(value));
  } catch {
    // 保存できなくても、同じページの island へは値を渡す
  }
  globalThis.dispatchEvent?.(
    new CustomEvent(PROGRESS_EVENT, { detail: { contentId, value } }) satisfies ProgressEvent,
  );
}

/** 手順を 1 つ完了にする。実行パネルから呼ぶ */
export function completeStep(contentId: string, stepIndex: number, stepCount: number): void {
  const prev = loadProgress(contentId, stepCount) ?? { completedSteps: [], lastStep: stepIndex };
  if (prev.completedSteps.includes(stepIndex)) return;
  saveProgress(contentId, {
    completedSteps: [...prev.completedSteps, stepIndex].sort((a, b) => a - b),
    lastStep: Math.max(prev.lastStep, stepIndex),
  });
}
