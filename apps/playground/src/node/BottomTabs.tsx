import { Tabs } from "@fukuemon/ui";
import { Activity, type ReactNode, Suspense } from "react";

import { useConsoleRecords } from "./ConsolePane";
import { consoleTabLabel } from "./console-view";
import { useSelection } from "./context";
import { useHttpRecords } from "./HttpPane";
import { httpTabLabel } from "./messages";
import type { BottomTab } from "./selection";

type Panes = { terminal: ReactNode; consolePane: ReactNode; http: ReactNode };
type Counts = { consoleCount: number; httpCount: number };

/**
 * 下のペインの、端末、コンソール、HTTP の流れを切り替えるタブ。
 * 選んでいないタブのペインは Activity で隠す。隠している間の記録は store が持つ。
 * 端末のエンジンは、隠すと Effect の後始末で破棄され、見せると作り直して出力の記録を書き直す。スクロールの位置と選択は残らない。
 * コンソールと HTTP のタブの文には記録の件数を添え、端末を見ている間も記録が届いたことが分かるようにする。起動を待つ間は件数を添えない。
 */
export function BottomTabs(panes: Panes) {
  return (
    <Suspense fallback={<BottomTabsView {...panes} consoleCount={0} httpCount={0} />}>
      <CountedBottomTabs {...panes} />
    </Suspense>
  );
}

function CountedBottomTabs(panes: Panes) {
  const http = useHttpRecords();
  const logs = useConsoleRecords();
  return (
    <BottomTabsView {...panes} consoleCount={logs.records.length} httpCount={http.records.length} />
  );
}

function BottomTabsView({ terminal, consolePane, http, consoleCount, httpCount }: Panes & Counts) {
  const { selection, dispatch } = useSelection();
  const selected = selection.bottom ?? "terminal";
  // Tabs は選んだタブの中身だけを描くので、どのタブにも同じ中身を渡し、中で Activity で切り替える
  const content = (
    <div className="flex min-h-0 flex-1 flex-col *:min-h-0 *:flex-1">
      <Activity mode={selected === "terminal" ? "visible" : "hidden"}>{terminal}</Activity>
      <Activity mode={selected === "console" ? "visible" : "hidden"}>{consolePane}</Activity>
      <Activity mode={selected === "http" ? "visible" : "hidden"}>{http}</Activity>
    </div>
  );
  return (
    <div className="flex size-full min-h-0 flex-col [&>div>[role=tablist]]:mx-1">
      <Tabs
        density="compact"
        items={[
          { id: "terminal", label: "端末", content },
          { id: "console", label: consoleTabLabel(consoleCount), content },
          { id: "http", label: httpTabLabel(httpCount), content },
        ]}
        label="端末、コンソール、HTTP の流れ"
        onSelect={(id) => dispatch({ type: "select-bottom", tab: id as BottomTab })}
        panel="flush"
        selectedId={selected}
      />
    </div>
  );
}
