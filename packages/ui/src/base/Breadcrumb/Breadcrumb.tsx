export type BreadcrumbItem = {
  label: string;
  href: string;
};

export type BreadcrumbProps = {
  /** 上の階層から順に並べる。最後の項目は今のページで、リンクにせず `aria-current="page"` を付ける。 */
  items: readonly BreadcrumbItem[];
};

/**
 * 今のページの位置を示すパンくずリスト。DADS のパンくずリストを元にする。hover で、リンクの箱の下に筆の線を左から引く。
 * リンクは、押せる領域を 44 px にするため、文中のリンクの `Link` を使わずに `<a>` で描く。
 */
export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav aria-label="パンくずリスト">
      <ol className="flex flex-wrap items-center text-body-dense text-text">
        {items.map((item, index) => {
          const isCurrent = index === items.length - 1;
          return (
            <li className="flex items-center" key={item.href}>
              {isCurrent ? (
                <span aria-current="page" className="inline-flex min-h-11 items-center">
                  {item.label}
                </span>
              ) : (
                <>
                  <a
                    className="inline-flex min-h-11 min-w-11 items-center justify-center text-link underline underline-offset-4 brush-hover visited:text-link-visited focus-visible:focus-ring"
                    href={item.href}
                  >
                    {item.label}
                  </a>
                  <svg
                    aria-hidden="true"
                    className="mx-1 shrink-0 text-text-secondary"
                    height="16"
                    viewBox="0 0 16 16"
                    width="16"
                  >
                    <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
