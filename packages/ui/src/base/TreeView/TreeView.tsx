import { clsx } from "clsx";
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";

/** 木の 1 つの項目。children を持つ項目は枝で、開閉できる。 */
export type TreeNode = {
  id: string;
  /** タイプアヘッドで探す文字。content を渡さないときは、画面にもこの文字を描く。 */
  label: string;
  /**
   * label の代わりに描く中身。文字の一部を太字にするときに使う。読み上げる名前は、この中身の文字になる。
   * label と同じ文字を描き、押せる要素を入れない。treeitem の中に、ほかの操作を置けないためである。名前の欄は、TreeViewProps の editor で描く。
   */
  content?: ReactNode;
  children?: readonly TreeNode[];
  /** ラベルの左に描く印。枝は、開いているかを受け取る。印は `aria-hidden` にする。 */
  icon?: (isOpen: boolean) => ReactNode;
};

/**
 * 木の行の中に描く名前の欄。content に欄を渡す。
 * rename は、id の項目の名前の代わりに content を描く。
 * insert は、parentId の枝の子の先頭（parentId が undefined のときは木の先頭）に行を 1 つ足し、content を描く。parentId は children を持つ項目の id にする。
 * insert の行の印は icon で渡す。行は開かないので、印は閉じた形を渡す。
 * 欄のある行までの枝は開く。欄を外した後、フォーカスがどこにも無ければ、木の項目へ戻す。
 * 欄を外すまでに selectedId が変わり、その項目が見えていればその項目へ、変わらなければ前にいた項目へ戻す。
 * 欄を開いている間は、行にフォーカスの輪を引かない。content に渡す欄が、自分のフォーカスの表示を持つ。
 */
export type TreeEditor =
  | { kind: "rename"; id: string; content: ReactNode }
  | {
      kind: "insert";
      parentId: string | undefined;
      isBranch: boolean;
      icon?: ReactNode;
      content: ReactNode;
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
  /** compact は、項目の高さを 24px 以上にする。コードを動かす画面の木に使い、文字は textSize で選ぶ。 */
  density?: "default" | "compact";
  /**
   * density が compact のときの文字。compact は 12px（コンソールの値の木）、body-compact は 13px（ファイルの木）にする。
   * body-compact では、選んだ項目を太字にせず、面の色と左の 2px の主の色の罫で示す。太字にすると名前の幅が変わり、行の中身の位置がずれるためである。
   */
  textSize?: "compact" | "body-compact";
  /** 渡すと、木の行の中に名前の欄を描く。欄の中のキーとクリックは、木の操作に使わない。 */
  editor?: TreeEditor;
  /**
   * 欄を閉じた後に、フォーカスを移す項目の id。欄で作った項目か、名前を変えた項目を渡す。取り消したときは渡さない。
   * editor を外す更新と同じ更新か、それより前に渡す。TreeView は欄を外した後に 1 回だけ読むので、外した後に変えても効かない。
   * 欄を閉じて木の項目へ戻した後、この項目が見えるようになったら、その項目へフォーカスを移す。呼ぶ側が、後から木に項目を足すことがあるためである。
   * 移る前に木を操作するか、フォーカスがほかの要素へ移ったら、移さない。項目が出ないまま、フォーカスが戻した項目に残る間は待ち続ける。
   */
  focusAfterEdit?: string;
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

/** id の項目の祖先の枝の id を、根から順に返す。id が木に無いときは undefined を返す。 */
const ancestorsOf = (nodes: readonly TreeNode[], id: string): string[] | undefined => {
  for (const node of nodes) {
    if (node.id === id) return [];
    const below = node.children && ancestorsOf(node.children, id);
    if (below) return [node.id, ...below];
  }
  return undefined;
};

/** 欄を描くために開いておく枝。rename はその項目の祖先、insert は親とその祖先である。 */
const branchesToOpen = (nodes: readonly TreeNode[], editor: TreeEditor | undefined): string[] => {
  if (editor === undefined) return [];
  const target = editor.kind === "rename" ? editor.id : editor.parentId;
  if (target === undefined) return [];
  const ancestors = ancestorsOf(nodes, target) ?? [];
  return editor.kind === "rename" ? ancestors : [...ancestors, target];
};

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
  density = "default",
  textSize = "compact",
  editor,
  focusAfterEdit,
}: TreeViewProps) {
  const isCompact = density === "compact";
  const isBodyCompact = isCompact && textSize === "body-compact";
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(defaultExpandedIds));
  const closed = branchesToOpen(items, editor).filter((id) => !expanded.has(id));
  // 欄を出すときに閉じた枝を開く。開いた状態は欄を外した後も残すので、描く間に state を直す
  if (closed.length > 0) setExpanded(new Set([...expanded, ...closed]));
  const visible = flatten(items, expanded);
  const [focusedId, setFocusedId] = useState<string | undefined>(undefined);
  const tabStopId = visible.some((v) => v.node.id === focusedId)
    ? focusedId
    : (visible.find((v) => v.node.id === selectedId) ?? visible[0])?.node.id;
  const itemRefs = useRef(new Map<string, HTMLLIElement>());
  const editorRef = useRef<HTMLSpanElement>(null);
  const typed = useRef({ text: "", timer: 0 });
  const isMounted = useRef(false);

  useEffect(() => {
    const current = typed.current;
    isMounted.current = true;
    return () => {
      window.clearTimeout(current.timer);
      isMounted.current = false;
    };
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

  const isEditing = editor !== undefined;
  const follow = useRef<{ from: string | undefined; id: string } | undefined>(undefined);
  const readSelectedId = useEffectEvent(() => selectedId);
  // フォーカスがまだ戻した項目にあり、作った項目か名前を変えた項目が見えるようになったら、その項目へ移る。フォーカスが動いたらやめる
  const followEdited = useEffectEvent(() => {
    const pending = follow.current;
    if (pending === undefined) return;
    const active = document.activeElement;
    // 戻した項目が木から消えたか、戻す項目が無かったときは、フォーカスが body にある間は追い続ける
    const isLost =
      (active === null || active === document.body) &&
      (pending.from === undefined || !itemRefs.current.has(pending.from));
    if (!isLost && (pending.from === undefined || active !== itemRefs.current.get(pending.from))) {
      follow.current = undefined;
      return;
    }
    if (!visible.some((v) => v.node.id === pending.id)) return;
    follow.current = undefined;
    focus(pending.id);
  });

  // 欄を外すまでに選んだ項目が変わったらその項目へ、変わらなければ前にいた項目へ戻す。
  // フォーカスがほかの要素にあるときは、欄の外を押して確定したときなので、動かさない
  const restoreFocus = useEffectEvent((selectedAtStart: string | undefined) => {
    const active = document.activeElement;
    if (active !== null && active !== document.body) return;
    const isNewSelection =
      selectedId !== selectedAtStart && visible.some((v) => v.node.id === selectedId);
    const target = isNewSelection ? selectedId : tabStopId;
    focus(target);
    // 呼ぶ側が、後から木に項目を足すことがある。その項目が見えるようになったら移る
    if (focusAfterEdit !== undefined && focusAfterEdit !== target) {
      follow.current = { from: target, id: focusAfterEdit };
      followEdited();
    }
  });

  useEffect(() => followEdited());

  useEffect(() => {
    if (!isEditing) return;
    follow.current = undefined;
    const selectedAtStart = readSelectedId();
    // blur での確定は、フォーカスが次の要素へ移る前に描き直すので、移り終えた後に見る
    return () => {
      window.setTimeout(() => {
        // 欄を開いたまま木を外したときは、外した後にタイマーが動くので、何もしない
        if (isMounted.current) restoreFocus(selectedAtStart);
      }, 0);
    };
  }, [isEditing]);

  const isFromEditor = (event: { target: EventTarget }) =>
    event.target instanceof Node && editorRef.current?.contains(event.target) === true;

  const setOpen = (id: string, isOpen: boolean) => {
    const next = new Set(expanded);
    if (isOpen) next.add(id);
    else next.delete(id);
    setExpanded(next);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLLIElement>, index: number) => {
    if (isFromEditor(event)) return;
    follow.current = undefined;
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

  const rowClassName = clsx(
    // 折り返した項目でも、印を 1 行目にそろえ、項目の間を空ける
    "flex items-start gap-1 rounded-control pr-2 transition-colors",
    isBodyCompact ? "min-h-6 py-0.5" : isCompact ? "min-h-6 py-1" : "min-h-11 py-3",
    isBodyCompact && "border-l-2 border-transparent forced-edge-hidden",
  );
  // 階層の深さは決まった段を持たないので、字下げの幅は style で渡す
  const indent = (level: number) => ({
    paddingInlineStart: `${(level - 1) * 1.5 + (isCompact ? 0 : 0.5)}rem`,
  });
  const markClassName = clsx("flex shrink-0 items-center", isCompact ? "h-4" : "h-5");
  const chevron = (isBranch: boolean, isOpen: boolean) => (
    <span className={markClassName}>
      <svg
        aria-hidden="true"
        className={clsx("transition-transform", isOpen && "rotate-90", !isBranch && "invisible")}
        height="16"
        viewBox="0 0 16 16"
        width="16"
      >
        <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </span>
  );
  const editorSlot = (content: ReactNode) => (
    <span className="min-w-0 flex-1" ref={editorRef}>
      {content}
    </span>
  );

  const rows = visible.map(({ node, level, setSize, posInSet }, index) => {
    const isBranch = node.children !== undefined;
    const isOpen = expanded.has(node.id);
    const isRenaming = editor?.kind === "rename" && editor.id === node.id;
    return (
      <li
        aria-expanded={isBranch ? isOpen : undefined}
        aria-keyshortcuts={shortcuts}
        aria-level={level}
        aria-posinset={posInSet}
        aria-selected={onSelect ? node.id === selectedId : undefined}
        aria-setsize={setSize}
        className={clsx(
          rowClassName,
          isCompact ? "focus-visible:focus-ring-inset" : "focus-visible:focus-ring",
          "aria-selected:bg-primary-surface aria-selected:forced-on-row",
          isBodyCompact ? "aria-selected:border-primary" : "aria-selected:font-bold",
          (isBranch || onSelect) && "cursor-pointer hover:bg-surface-subtle",
        )}
        key={node.id}
        onClick={(event) => {
          if (isFromEditor(event)) return;
          follow.current = undefined;
          setFocusedId(node.id);
          if (isBranch) setOpen(node.id, !isOpen);
          onSelect?.(node.id);
        }}
        onFocus={(event) => {
          if (event.target === event.currentTarget) setFocusedId(node.id);
        }}
        onKeyDown={(event) => handleKeyDown(event, index)}
        ref={(element) => {
          if (element) itemRefs.current.set(node.id, element);
          else itemRefs.current.delete(node.id);
        }}
        role="treeitem"
        style={indent(level)}
        tabIndex={node.id === tabStopId ? 0 : -1}
      >
        {chevron(isBranch, isOpen)}
        {node.icon && <span className={markClassName}>{node.icon(isOpen)}</span>}
        {isRenaming ? editorSlot(editor.content) : (node.content ?? node.label)}
      </li>
    );
  });

  if (editor?.kind === "insert") {
    const parentIndex = visible.findIndex((v) => v.node.id === editor.parentId);
    const parent = visible[parentIndex];
    // 親が木に無いか枝でないときは、足す場所が無いので行を出さない
    if (editor.parentId === undefined || parent?.node.children !== undefined) {
      rows.splice(
        parentIndex + 1,
        0,
        // 欄の行は、木の項目と同じ字下げと印で描く。項目ではないので、選択とキーの操作を持たない
        <li
          aria-level={parent ? parent.level + 1 : 1}
          className={rowClassName}
          // 項目の id と重ならない key にする
          key={"\0editor"}
          role="treeitem"
          style={indent(parent ? parent.level + 1 : 1)}
        >
          {chevron(editor.isBranch, false)}
          {editor.icon && <span className={markClassName}>{editor.icon}</span>}
          {editorSlot(editor.content)}
        </li>,
      );
    }
  }

  return (
    <ul
      aria-label={label}
      className={clsx(
        "flex flex-col text-text",
        isBodyCompact ? "text-body-compact" : isCompact ? "text-compact" : "text-body-dense",
      )}
      role="tree"
    >
      {rows}
    </ul>
  );
}
