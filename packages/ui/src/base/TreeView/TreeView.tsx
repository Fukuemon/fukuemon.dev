import { clsx } from "clsx";
import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from "react";

/** 木の 1 つの項目。children を持つ項目は枝で、開閉できる。 */
export type TreeNode = {
  id: string;
  /** タイプアヘッドで探す文字。content を渡さないときは、画面にもこの文字を描く。 */
  label: string;
  /**
   * label の代わりに描く中身。文字の一部を太字にするときに使う。読み上げる名前は、この中身の文字になる。
   * label と同じ文字を描き、押せる要素を入れない。treeitem の中に、ほかの操作を置けないためである。
   */
  content?: ReactNode;
  children?: readonly TreeNode[];
  /** ラベルの左に描く印。枝は、開いているかを受け取る。印は `aria-hidden` にする。 */
  icon?: (isOpen: boolean) => ReactNode;
};

export type TreeViewProps = {
  /** 木の読み上げる名前。 */
  label: string;
  items: readonly TreeNode[];
  /** 選んだ項目。フォーカスの移動では変わらず、Enter のキーかクリックで onSelect を呼ぶ。 */
  selectedId?: string;
  onSelect?: (id: string) => void;
  defaultExpandedIds?: readonly string[];
  /** 渡すと、項目で F2 のキーを押したときに呼ぶ。名前を変える欄を開くための入口で、項目には `aria-keyshortcuts` で示す。 */
  onRequestRename?: (id: string) => void;
  /** 渡すと、項目で Delete のキーを押したときに呼ぶ。削除の確認を開くための入口で、項目には `aria-keyshortcuts` で示す。 */
  onRequestDelete?: (id: string) => void;
};

/** 文字を続けて打つ間の区切り。この間が空くと、打った文字を忘れる。 */
const TYPEAHEAD_RESET_MS = 500;

type VisibleNode = {
  node: TreeNode;
  level: number;
  parentId: string | undefined;
  setSize: number;
  posInSet: number;
};

const flatten = (
  nodes: readonly TreeNode[],
  expanded: ReadonlySet<string>,
  level = 1,
  parentId?: string,
): VisibleNode[] =>
  nodes.flatMap((node, index) => [
    { node, level, parentId, setSize: nodes.length, posInSet: index + 1 },
    ...(node.children && expanded.has(node.id)
      ? flatten(node.children, expanded, level + 1, node.id)
      : []),
  ]);

/**
 * 項目を階層で並べる木。WAI-ARIA APG の Tree View のキーボードの操作に従う。
 * 上下の矢印のキーで見えている項目の間を移り、Home と End で端へ移る。
 * 右の矢印のキーは、閉じた枝を開き、開いた枝では最初の子へ移る。左の矢印のキーは、開いた枝を閉じ、それ以外では親へ移る。
 * 文字を打つと、その文字で始まるラベルの項目へ移る（タイプアヘッド）。続けて打つと、打った文字の並びで探す。同じ文字だけを繰り返すと、その文字で始まる項目を順に巡る。
 * 見えている項目を `aria-level` 付きで平らに並べる。`group` で入れ子にすると、フォーカスの枠が子の項目まで囲むためである。
 */
export function TreeView({
  label,
  items,
  selectedId,
  onSelect,
  defaultExpandedIds = [],
  onRequestRename,
  onRequestDelete,
}: TreeViewProps) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(defaultExpandedIds));
  const visible = flatten(items, expanded);
  const [focusedId, setFocusedId] = useState<string | undefined>(undefined);
  const tabStopId = visible.some((v) => v.node.id === focusedId)
    ? focusedId
    : (visible.find((v) => v.node.id === selectedId) ?? visible[0])?.node.id;
  const itemRefs = useRef(new Map<string, HTMLLIElement>());
  const typed = useRef({ text: "", timer: 0 });

  useEffect(() => {
    const current = typed.current;
    return () => window.clearTimeout(current.timer);
  }, []);

  const typeAhead = (char: string, index: number) => {
    const state = typed.current;
    window.clearTimeout(state.timer);
    state.text += char.toLowerCase();
    state.timer = window.setTimeout(() => {
      state.text = "";
    }, TYPEAHEAD_RESET_MS);
    const isRepeat = [...state.text].every((c) => c === state.text[0]);
    const query = isRepeat ? state.text.slice(0, 1) : state.text;
    const start = isRepeat ? index + 1 : index;
    const ordered = [...visible.slice(start), ...visible.slice(0, start)];
    focus(ordered.find((v) => v.node.label.toLowerCase().startsWith(query))?.node.id);
  };

  const focus = (id: string | undefined) => {
    if (id === undefined) return;
    setFocusedId(id);
    itemRefs.current.get(id)?.focus();
  };

  const setOpen = (id: string, isOpen: boolean) => {
    const next = new Set(expanded);
    if (isOpen) next.add(id);
    else next.delete(id);
    setExpanded(next);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLLIElement>, index: number) => {
    const current = visible[index];
    if (!current) return;
    const { node } = current;
    const isBranch = node.children !== undefined;
    const isOpen = expanded.has(node.id);
    const keys: Record<string, () => void> = {
      ArrowDown: () => focus(visible[index + 1]?.node.id),
      ArrowUp: () => focus(visible[index - 1]?.node.id),
      Home: () => focus(visible[0]?.node.id),
      End: () => focus(visible.at(-1)?.node.id),
      ArrowRight: () => {
        if (!isBranch) return;
        if (isOpen) focus(node.children?.[0]?.id);
        else setOpen(node.id, true);
      },
      ArrowLeft: () => {
        if (isBranch && isOpen) setOpen(node.id, false);
        else focus(current.parentId);
      },
      Enter: () => onSelect?.(node.id),
      F2: () => onRequestRename?.(node.id),
      Delete: () => onRequestDelete?.(node.id),
    };
    const isChar = event.key.length === 1 && event.key !== " ";
    if (isChar && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      typeAhead(event.key, index);
      return;
    }
    typed.current.text = "";
    if (event.key === "F2" && !onRequestRename) return;
    if (event.key === "Delete" && !onRequestDelete) return;
    const action = keys[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  };

  const shortcuts =
    [onRequestRename && "F2", onRequestDelete && "Delete"].filter(Boolean).join(" ") || undefined;

  return (
    <ul aria-label={label} className="flex flex-col text-body-dense text-text" role="tree">
      {visible.map(({ node, level, setSize, posInSet }, index) => {
        const isBranch = node.children !== undefined;
        const isOpen = expanded.has(node.id);
        return (
          <li
            aria-expanded={isBranch ? isOpen : undefined}
            aria-keyshortcuts={shortcuts}
            aria-level={level}
            aria-posinset={posInSet}
            aria-selected={onSelect ? node.id === selectedId : undefined}
            aria-setsize={setSize}
            className={clsx(
              // 折り返した項目でも、印を 1 行目にそろえ、項目の間を空ける
              "flex min-h-11 items-start gap-1 py-3 pr-2 transition-colors focus-visible:focus-ring",
              "aria-selected:bg-primary-surface aria-selected:font-bold",
              (isBranch || onSelect) && "cursor-pointer hover:bg-surface-subtle",
            )}
            key={node.id}
            onClick={() => {
              setFocusedId(node.id);
              if (isBranch) setOpen(node.id, !isOpen);
              onSelect?.(node.id);
            }}
            onKeyDown={(event) => handleKeyDown(event, index)}
            ref={(element) => {
              if (element) itemRefs.current.set(node.id, element);
              else itemRefs.current.delete(node.id);
            }}
            role="treeitem"
            // 階層の深さは決まった段を持たないので、字下げの幅は style で渡す
            style={{ paddingInlineStart: `${(level - 1) * 1.5 + 0.5}rem` }}
            tabIndex={node.id === tabStopId ? 0 : -1}
          >
            <span className="flex h-5 shrink-0 items-center">
              <svg
                aria-hidden="true"
                className={clsx(
                  "transition-transform",
                  isOpen && "rotate-90",
                  !isBranch && "invisible",
                )}
                height="16"
                viewBox="0 0 16 16"
                width="16"
              >
                <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </span>
            {node.icon && (
              <span className="flex h-5 shrink-0 items-center">{node.icon(isOpen)}</span>
            )}
            {node.content ?? node.label}
          </li>
        );
      })}
    </ul>
  );
}
