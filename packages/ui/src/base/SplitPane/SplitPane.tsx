import { clsx } from "clsx";
import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useId,
  useRef,
  useState,
} from "react";

/** horizontal は 2 つの領域を左右に、vertical は上下に並べる。 */
export type SplitPaneOrientation = "horizontal" | "vertical";

export type SplitPaneProps = {
  /** 仕切りの読み上げる名前。 */
  label: string;
  /** 左か上の領域。仕切りの値は、この領域の大きさの割合（%）である。 */
  primary: ReactNode;
  secondary: ReactNode;
  orientation?: SplitPaneOrientation;
  defaultSize?: number;
};

const MIN = 20;
const MAX = 80;
const STEP = 5;

const clamp = (value: number) => Math.min(MAX, Math.max(MIN, value));

/**
 * 2 つの領域と、その間で動かせる仕切り。WAI-ARIA APG の Window Splitter のキーボードの操作に従う。
 * 仕切りにフォーカスがあるとき、左右に並べたら左右の矢印のキー、上下に並べたら上下の矢印のキーで 5% ずつ動き、Home と End で最小と最大へ動く。
 * 仕切りは押せる幅を 44 px 取り、見た目の線は 1 px にする。両側の領域に重ねると、領域のスクロールバーを押せなくなるためである。
 */
export function SplitPane({
  label,
  primary,
  secondary,
  orientation = "horizontal",
  defaultSize = 50,
}: SplitPaneProps) {
  const primaryId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const [size, setSize] = useState(() => clamp(defaultSize));
  const isHorizontal = orientation === "horizontal";

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const [decrease, increase] = isHorizontal
      ? ["ArrowLeft", "ArrowRight"]
      : ["ArrowUp", "ArrowDown"];
    const keys: Record<string, () => number> = {
      [decrease]: () => size - STEP,
      [increase]: () => size + STEP,
      Home: () => MIN,
      End: () => MAX,
    };
    const next = keys[event.key];
    if (!next) return;
    event.preventDefault();
    setSize(clamp(next()));
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = isHorizontal
      ? (event.clientX - rect.left) / rect.width
      : (event.clientY - rect.top) / rect.height;
    setSize(clamp(Math.round(ratio * 100)));
  };

  return (
    <div className={clsx("flex size-full", !isHorizontal && "flex-col")} ref={rootRef}>
      <div
        className="min-h-0 min-w-0 overflow-auto"
        id={primaryId}
        // 割合は決まった段を持たないので、領域の大きさは style で渡す
        style={{ flexBasis: `${size}%` }}
      >
        {primary}
      </div>
      <div
        aria-controls={primaryId}
        aria-label={label}
        aria-orientation={isHorizontal ? "vertical" : "horizontal"}
        aria-valuemax={MAX}
        aria-valuemin={MIN}
        aria-valuenow={size}
        className={clsx(
          "flex shrink-0 touch-none justify-center focus-visible:focus-ring",
          isHorizontal ? "w-11 cursor-col-resize" : "h-11 cursor-row-resize flex-col",
        )}
        onKeyDown={handleKeyDown}
        onPointerDown={(event) => {
          isDraggingRef.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={() => {
          isDraggingRef.current = false;
        }}
        onLostPointerCapture={() => {
          isDraggingRef.current = false;
        }}
        role="separator"
        tabIndex={0}
      >
        <span aria-hidden="true" className={clsx("bg-border", isHorizontal ? "w-px" : "h-px")} />
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-auto">{secondary}</div>
    </div>
  );
}
