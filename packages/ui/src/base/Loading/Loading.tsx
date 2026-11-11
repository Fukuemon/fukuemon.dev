export type LoadingProps = {
  /** 待っていることを表す文。印が止まっていても伝わるよう、必ず渡して画面に出す。 */
  label: string;
};

/**
 * 終わりの見えない待ちを示す、罫の印と文。薄い罫の上を、主の色の罫が左から伸びて右へ抜ける。DADS のプログレスインジケーターを元にする。
 * 文は `role="status"` に入れ、読み上げの対象にする。
 */
export function Loading({ label }: LoadingProps) {
  return (
    <div className="inline-flex items-center gap-3 text-body-dense text-text" role="status">
      <span
        aria-hidden="true"
        className="relative h-0.5 w-6 shrink-0 overflow-hidden bg-border after:absolute after:inset-0 after:animate-loading after:bg-primary"
      />
      {label}
    </div>
  );
}
