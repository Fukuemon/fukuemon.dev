/**
 * プレビューの iframe の読み込みを、上限の時間まで待つ。上限までに generation の iframe が読み込まれていなければ、onTimeout を呼ぶ。
 * 読み込んだ世代は loadedGeneration で読む。
 * 返す関数を呼ぶと、待つのをやめる。
 */
export function watchPreviewLoad(
  generation: number,
  loadedGeneration: () => number | undefined,
  onTimeout: () => void,
  timeoutMs: number,
): () => void {
  const timer = setTimeout(() => {
    if (loadedGeneration() !== generation) onTimeout();
  }, timeoutMs);
  return () => clearTimeout(timer);
}
