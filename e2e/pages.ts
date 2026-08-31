/** 撮影対象。ページを足したらここへ 1 行足す */
export const PAGES = [
  "/",
  "/blog/",
  "/blog/articles/",
  "/blog/labs/",
  "/playground/",
  "/articles/index-not-used/",
  "/articles/wal-and-checkpoint/",
  "/labs/rdbms-query-execution/",
  "/labs/vacuum-and-bloat/",
  "/playground/postgres/",
] as const;

export const THEMES = ["light", "dark"] as const;

/** 狭い方は --breakpoint-narrow (721px) の下、広い方は --breakpoint-wide (1101px) の上 */
export const WIDTHS = [500, 1280] as const;

export const shotName = (path: string, theme: string, width: number): string =>
  `${path.replaceAll("/", "_") || "_root"}${theme}-${width}.png`;
