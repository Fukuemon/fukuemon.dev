import { Tabs } from "@fukuemon/ui";
import { Activity, type ReactNode } from "react";

import { useSelection } from "./context";
import type { BottomTab } from "./selection";

/**
 * 下のペインの、端末と HTTP の流れを切り替えるタブ。
 * 選んでいないタブのペインは Activity で隠す。隠している間の記録は store が持つ。
 * 端末のエンジンは、隠すと Effect の後始末で破棄され、見せると作り直して出力の記録を書き直す。スクロールの位置と選択は残らない。
 */
export function BottomTabs({ terminal, http }: { terminal: ReactNode; http: ReactNode }) {
  const { selection, dispatch } = useSelection();
  const selected = selection.bottom ?? "terminal";
  // Tabs は選んだタブの中身だけを描くので、どのタブにも同じ中身を渡し、中で Activity で切り替える
  const panes = (
    <div className="flex min-h-0 flex-1 flex-col *:min-h-0 *:flex-1">
      <Activity mode={selected === "terminal" ? "visible" : "hidden"}>{terminal}</Activity>
      <Activity mode={selected === "http" ? "visible" : "hidden"}>{http}</Activity>
    </div>
  );
  return (
    <div className="flex size-full min-h-0 flex-col">
      <Tabs
        density="compact"
        items={[
          { id: "terminal", label: "端末", content: panes },
          { id: "http", label: "HTTP の流れ", content: panes },
        ]}
        label="下のペイン"
        onSelect={(id) => dispatch({ type: "select-bottom", tab: id as BottomTab })}
        panel="flush"
        selectedId={selected}
      />
    </div>
  );
}
