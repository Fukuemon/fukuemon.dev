import type { OpenPort } from "@fukuemon/node-runtime";
import { Notice, PreviewFrame, Tabs } from "@fukuemon/ui";
import { Activity, useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react";

import { useRuntime, useSelection } from "./context";
import { PREVIEW_TIMEOUT_MESSAGE, PREVIEW_TIMEOUT_MS, bootFailureMessage } from "./messages";

const NO_PORTS: readonly OpenPort[] = [];
const noPorts = { subscribe: () => () => undefined, getSnapshot: () => NO_PORTS };

// 実装は、ポートが開くたびに一覧のオブジェクトを作り直すので、読み込まれなかった印はポートと URL の組で持つ
const portKey = (port: OpenPort) => `${port.port} ${port.url}`;

type PortFrameProps = {
  port: OpenPort;
  /** 再読み込みのたびに増やす。iframe を作り直す。 */
  generation: number;
  /** iframe が PREVIEW_TIMEOUT_MS までに読み込まれないときに呼ぶ。 */
  onTimeout: (port: OpenPort) => void;
};

function PortFrame({ port, generation, onTimeout }: PortFrameProps) {
  // Activity で隠すと Effect が止まり、見せると動き直す。読み込んだ世代を持ち、見せ直したときに上限を数え直さない
  const loaded = useRef<number>(undefined);
  const timeout = useEffectEvent(() => {
    if (loaded.current !== generation) onTimeout(port);
  });
  useEffect(() => {
    const timer = setTimeout(timeout, PREVIEW_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [port.port, generation]);
  return (
    <iframe
      allow={port.allow}
      key={generation}
      onLoad={() => {
        loaded.current = generation;
      }}
      sandbox={port.sandbox}
      src={port.url}
      title={`${port.port} 番のプレビュー`}
    />
  );
}

/**
 * プレビューのペイン。待ち受けたポートをタブで並べ、選んだポートのページを iframe で出す。
 * 選んでいないポートの iframe も、Activity で隠して残す。タブを切り替えても、ページの状態が消えないためである。
 * 読み込まれないポートは、そのポートのパネルにだけ理由を出し、ほかのポートのタブと iframe は残す。
 * 読み込まれなかった印は、そのポートが一覧から消えると消える。サーバーを起動し直したときに、印が残らないためである。
 */
export function PreviewPane() {
  const { runtime, reason } = useRuntime();
  const { selection, dispatch } = useSelection();
  const store = runtime?.ports ?? noPorts;
  const ports = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [generations, setGenerations] = useState<ReadonlyMap<number, number>>(new Map());
  const [timedOut, setTimedOut] = useState<ReadonlySet<string>>(new Set());
  const [shownPorts, setShownPorts] = useState(ports);
  if (shownPorts !== ports) {
    setShownPorts(ports);
    const open = new Set(ports.map(portKey));
    setTimedOut((current) => new Set([...current].filter((key) => open.has(key))));
  }
  const active = ports.find((port) => port.port === selection.preview) ?? ports[0];
  const activeTimedOut = active !== undefined && timedOut.has(portKey(active));

  const onTimeout = (port: OpenPort) =>
    setTimedOut((current) => new Set(current).add(portKey(port)));
  const reload = (port: OpenPort) => {
    setTimedOut((current) => {
      const next = new Set(current);
      next.delete(portKey(port));
      return next;
    });
    setGenerations((current) => new Map(current).set(port.port, (current.get(port.port) ?? 0) + 1));
  };

  const frames = (
    <div className="flex min-h-0 flex-1 flex-col *:min-h-48 *:w-full *:flex-1">
      {activeTimedOut && (
        <div className="p-4">
          <Notice isAlert title="プレビューを開けません" tone="danger">
            {PREVIEW_TIMEOUT_MESSAGE}
          </Notice>
        </div>
      )}
      {ports.map((port) => (
        <Activity key={port.port} mode={port === active && !activeTimedOut ? "visible" : "hidden"}>
          <PortFrame
            generation={generations.get(port.port) ?? 0}
            onTimeout={onTimeout}
            port={port}
          />
        </Activity>
      ))}
    </div>
  );

  return (
    <PreviewFrame
      onReload={active && (() => reload(active))}
      state={
        reason !== undefined
          ? { kind: "error", title: "プレビューを開けません", message: bootFailureMessage(reason) }
          : active === undefined
            ? { kind: "loading", label: "サーバーが待ち受けるのを待っています" }
            : undefined
      }
      url={active?.url ?? ""}
    >
      {active && (
        <Tabs
          items={ports.map((port) => ({
            id: String(port.port),
            label: String(port.port),
            content: frames,
          }))}
          label="ポート"
          onSelect={(id) => dispatch({ type: "select-preview", port: Number(id) })}
          panel="flush"
          selectedId={String(active.port)}
        />
      )}
    </PreviewFrame>
  );
}
