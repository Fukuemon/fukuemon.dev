export type PageLoadingProps = {
  /** 待っていることを表す文。印が止まっていても伝わるよう、必ず渡して画面に出す。 */
  label: string;
};

/**
 * コードを動かせるようになるまでの待ちを、画面の右下に 1 つだけ出す。文の下に、主の色の筆の線を右寄せで置き、左から伸びて右へ抜ける。
 * 領域ごとの待ちには `Loading` を使う。文は暗黙の role が status の `output` に入れ、読み上げの対象にする。
 */
export function PageLoading({ label }: PageLoadingProps) {
  return (
    <output className="pointer-events-none fixed right-6 bottom-6 z-20 flex flex-col items-end gap-2 text-body-compact text-text">
      {label}
      <span aria-hidden="true" className="h-1.5 w-28 animate-loading bg-primary stroke-brush" />
    </output>
  );
}
