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

const PAGE = "M3.5 1.5h6l3 3v10h-9zM9.5 1.5v3h3";

const MARK: Record<FileKind, string | undefined> = {
  code: "M6.5 8l-2 2.5 2 2.5M9.5 8l2 2.5-2 2.5",
  document: "M5.5 8.5h5M5.5 10.5h5M5.5 12.5h3",
  data: "M7 8.5c-1 0-1 .5-1 1.5s0 1.5-1 1.5c1 0 1 .5 1 1.5s0 1.5 1 1.5M9 8.5c1 0 1 .5 1 1.5s0 1.5 1 1.5c-1 0-1 .5-1 1.5s0 1.5-1 1.5",
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
