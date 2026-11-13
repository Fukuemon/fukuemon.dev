import { clsx } from "clsx";
import { useEffect, useState } from "react";

/** 目次の 1 項目。id はページの見出しの要素の id で、リンクは `#id` を指す。 */
export type TableOfContentsItem = {
  id: string;
  label: string;
  level: 2 | 3;
};

export type TableOfContentsProps = {
  /** ページの見出しの順に並べる。level 3 の項目は、直前の level 2 の項目の下に入れる。 */
  headings: readonly TableOfContentsItem[];
};

type Section = {
  item: TableOfContentsItem;
  children: TableOfContentsItem[];
};

const toSections = (items: readonly TableOfContentsItem[]): Section[] => {
  const sections: Section[] = [];
  for (const item of items) {
    const last = sections.at(-1);
    if (item.level === 3 && last) last.children.push(item);
    else sections.push({ item, children: [] });
  }
  return sections;
};

/** 画面の上からこの割合の線を越えた見出しを、読んでいる見出しにする。 */
const READING_LINE = 0.3;
const OBSERVED_ABOVE_PX = 1_000_000;

/** 読んでいる見出しの id。画面の上の線より上にある見出しのうち、最後のものを返す。ページの末尾までスクロールしたら、最後の見出しを返す。 */
const useCurrentHeadingId = (ids: readonly string[]) => {
  const [currentId, setCurrentId] = useState<string | undefined>(undefined);
  const idsKey = ids.join(" ");

  useEffect(() => {
    const headings = idsKey
      .split(" ")
      .map((id) => document.getElementById(id))
      .filter((element) => element !== null);
    if (headings.length === 0) return;
    // スクロールしないページでは、末尾にいても読み始めたばかりなので、最後の見出しにしない
    const isAtEnd = () =>
      window.scrollY > 0 &&
      window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 1;
    const update = () => {
      if (isAtEnd()) {
        setCurrentId(headings.at(-1)?.id);
        return;
      }
      const line = window.innerHeight * READING_LINE;
      const passed = headings.filter((heading) => heading.getBoundingClientRect().top < line);
      setCurrentId(passed.at(-1)?.id);
    };
    // 短いページの最後の見出しは線を越えないので、末尾に届いたかと離れたかは scroll で拾う
    let wasAtEnd = isAtEnd();
    const handleScroll = () => {
      if (isAtEnd() === wasAtEnd) return;
      wasAtEnd = !wasAtEnd;
      update();
    };
    // 観察の結果は変わった見出しの分しか届かないので、どれかが線を越えるたびに全ての見出しの位置から決め直す
    const observer = new IntersectionObserver(
      update,
      // 上の端を画面の外へ大きく広げ、線より上を全て交わる範囲にする。
      // 線の下から画面の上の外へ一度に飛んだ見出しも、交わる範囲に入るので通知が届く。
      // root を document にするのは、iframe の中（カタログ）でも iframe の表示の領域で切らずに広げた範囲を使うためである
      {
        root: document,
        rootMargin: `${OBSERVED_ABOVE_PX}px 0px -${(1 - READING_LINE) * 100}% 0px`,
      },
    );
    for (const heading of headings) observer.observe(heading);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", handleScroll);
    };
  }, [idsKey]);

  return currentId;
};

/**
 * 記事の見出しの目次。h2 と h3 の 2 段を、入れ子のリストで並べる。hover で、見出しの文字の下に 2px の罫を行ごとに引く。
 * JavaScript が動くときは、読んでいる見出しのリンクに `aria-current="location"` を付け、太字と左の線で示す。
 * 静的に描いた HTML では、見出しへのリンクだけが働く。
 */
export function TableOfContents({ headings }: TableOfContentsProps) {
  const currentId = useCurrentHeadingId(headings.map((item) => item.id));

  const renderLink = (item: TableOfContentsItem) => {
    const isCurrent = item.id === currentId;
    return (
      <a
        aria-current={isCurrent ? "location" : undefined}
        className={clsx(
          "flex min-h-11 items-center border-l-2 py-2 pr-2 text-body-dense focus-visible:focus-ring",
          item.level === 3 ? "pl-8" : "pl-4",
          isCurrent
            ? "border-current-page font-bold text-current-page"
            : "border-border text-text-secondary",
        )}
        href={`#${item.id}`}
      >
        <span>
          <span className="link-rule">{item.label}</span>
        </span>
      </a>
    );
  };

  return (
    <nav aria-label="目次">
      <ol className="flex flex-col">
        {toSections(headings).map(({ item, children }) => (
          <li key={item.id}>
            {renderLink(item)}
            {children.length > 0 && (
              <ol className="flex flex-col">
                {children.map((child) => (
                  <li key={child.id}>{renderLink(child)}</li>
                ))}
              </ol>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
