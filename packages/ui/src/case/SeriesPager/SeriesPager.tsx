import { clsx } from "clsx";

/** シリーズの中の隣の記事。 */
export type SeriesPagerLink = {
  title: string;
  href: string;
};

export type SeriesPagerProps = {
  /** シリーズの名前。`<nav>` の名前を「シリーズ <名前>」にする。 */
  series: string;
  /** 今の記事がシリーズの何本目か。1 から数える。 */
  position: number;
  total: number;
  /** 前の記事。無ければ前の側を描かない。 */
  prev?: SeriesPagerLink;
  /** 次の記事。無ければ次の側を描かない。 */
  next?: SeriesPagerLink;
};

const linkClassName =
  "flex min-h-11 flex-col gap-1 rounded-md p-4 ring-1 ring-border ring-inset hover:bg-surface-subtle focus-visible:focus-ring";

/**
 * シリーズの中の位置と、前と次の記事へのリンク。
 * 広い画面では前を左、次を右に並べ、前が無くても次は右に置く。
 */
export function SeriesPager({ series, position, total, prev, next }: SeriesPagerProps) {
  return (
    <nav aria-label={`シリーズ ${series}`} className="flex flex-col gap-4">
      <p className="text-caption text-text-secondary">
        シリーズ「{series}」 <span aria-hidden="true">{`${position} / ${total}`}</span>
        <span className="sr-only">{`${total} 本のうち ${position} 本目`}</span>
      </p>
      {(prev || next) && (
        <div className="grid gap-4 md:grid-cols-2">
          {prev && (
            <a className={linkClassName} href={prev.href} rel="prev">
              <span className="text-caption text-text-secondary">前の記事</span>
              <span className="text-body-dense text-link underline underline-offset-4">
                {prev.title}
              </span>
            </a>
          )}
          {next && (
            <a
              className={clsx(linkClassName, "text-right md:col-start-2")}
              href={next.href}
              rel="next"
            >
              <span className="text-caption text-text-secondary">次の記事</span>
              <span className="text-body-dense text-link underline underline-offset-4">
                {next.title}
              </span>
            </a>
          )}
        </div>
      )}
    </nav>
  );
}
