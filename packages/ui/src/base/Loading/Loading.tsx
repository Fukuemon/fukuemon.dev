export type LoadingProps = {
  /** 待っていることを表す文。回転の印が止まっていても伝わるよう、必ず渡して画面に出す。 */
  label: string;
};

/**
 * 終わりの見えない待ちを示す、回転の印と文。DADS のプログレスインジケーターを元にする。
 * 文は `role="status"` に入れ、読み上げの対象にする。
 */
export function Loading({ label }: LoadingProps) {
  return (
    <div className="inline-flex items-center gap-3 text-body-dense text-text" role="status">
      <span
        aria-hidden="true"
        className="size-6 shrink-0 animate-spin border-4 border-surface-disabled border-t-primary"
      />
      {label}
    </div>
  );
}
