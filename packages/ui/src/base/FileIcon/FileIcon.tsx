import { clsx } from "clsx";

/** ファイルの系統。線の形で見分け、色は差し色の役割に合わせる。 */
export type FileKind = "code" | "document" | "data" | "other";

const CODE = new Set([
  "js",
  "mjs",
  "cjs",
  "jsx",
  "ts",
  "tsx",
  "py",
  "go",
  "rs",
  "sh",
  "css",
  "html",
]);
const DOCUMENT = new Set(["md", "mdx", "txt"]);
const DATA = new Set(["json", "yaml", "yml", "toml", "env"]);

export function fileKindOf(name: string): FileKind {
  const extension = name.includes(".") ? (name.split(".").at(-1)?.toLowerCase() ?? "") : "";
  if (CODE.has(extension)) return "code";
  if (DOCUMENT.has(extension)) return "document";
  if (DATA.has(extension)) return "data";
  return "other";
}

const COLOR: Record<FileKind, string> = {
  code: "text-info",
  document: "text-primary",
  data: "text-text",
  other: "text-text-secondary",
};

// 紙を 11 の幅にし、中の印と紙の線の間を 1.5 以上空ける。データの {} は、曲線だと線の太さで潰れるので、角の折れ線にする
const PAGE = "M2.5 1.5h7l4 4v9h-11zM9.5 1.5v4h4";

const MARK: Record<FileKind, string | undefined> = {
  code: "M6.5 8L5 10l1.5 2M9.5 8l1.5 2-1.5 2",
  document: "M5 8.5h6M5 10.5h6M5 12.5h3.5",
  data: "M7 7.5H6v2L5 10l1 .5v2h1M9 7.5h1v2l1 .5-1 .5v2H9",
  other: undefined,
};

export type FileIconProps = {
  kind: "file" | "directory";
  /** ファイルの名前。拡張子から系統を決める。 */
  name?: string;
  /** ディレクトリが開いているか。開閉で形が変わる。 */
  isOpen?: boolean;
};

/**
 * ファイルとディレクトリの印。自前の SVG で、読み上げからは外す。
 * ディレクトリは開閉で形が変わる。ファイルは系統（コード、文書、データ、そのほか）で線の形を変え、色は差し色（藍、緑、墨、薄い墨）で分ける。
 * 色だけで分けないので、線の形でも見分けられる。
 */
export function FileIcon({ kind, name = "", isOpen = false }: FileIconProps) {
  const fileKind = fileKindOf(name);
  const mark = kind === "file" ? MARK[fileKind] : undefined;
  return (
    <svg
      aria-hidden="true"
      className={clsx("shrink-0", kind === "directory" ? "text-text-secondary" : COLOR[fileKind])}
      data-icon={kind === "directory" ? (isOpen ? "directory-open" : "directory") : fileKind}
      fill="none"
      height="20"
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="miter"
      strokeWidth="1.25"
      viewBox="0 0 16 16"
      width="20"
    >
      {kind === "directory" ? (
        <path
          d={
            isOpen
              ? "M1.5 3.5h4.5l1.5 1.5h6v2M4 7h11.5l-2.5 6.5H1.5V3.5"
              : "M1.5 3.5h4.5l1.5 1.5h7v8h-13z"
          }
        />
      ) : (
        <>
          <path d={PAGE} />
          {mark !== undefined && <path d={mark} />}
        </>
      )}
    </svg>
  );
}
