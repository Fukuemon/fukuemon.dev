import type { OpenPort } from "@fukuemon/node-runtime";
import { PreviewFrame, Tabs } from "@fukuemon/ui";
import { Activity, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { useRuntime, useSelection } from "./context";
import { PREVIEW_TIMEOUT_MESSAGE, PREVIEW_TIMEOUT_MS, bootFailureMessage } from "./messages";

const NO_PORTS: readonly OpenPort[] = [];
const noPorts = { subscribe: () => () => undefined, getSnapshot: () => NO_PORTS };

type PortFrameProps = {
  port: OpenPort;
  /** 再読み込みのたびに増やす。iframe を作り直す。 */
  generation: number;
  /** iframe が PREVIEW_TIMEOUT_MS までに読み込まれないときに呼ぶ。 */
  onTimeout: (port: number) => void;
};

function PortFrame({ port, generation, onTimeout }: PortFrameProps) {
  // Activity で隠すと Effect が止まり、見せると動き直す。読み込んだ世代を持ち、見せ直したときに上限を数え直さない
  const loaded = useRef<number>(undefined);
  const handlers = useRef({ onTimeout });
  useEffect(() => {
    handlers.current = { onTimeout };
  });
  useEffect(() => {
    const timer = setTimeout(() => {
      if (loaded.current !== generation) handlers.current.onTimeout(port.port);
    }, PREVIEW_TIMEOUT_MS);
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
 */
export function PreviewPane() {
  const { runtime, reason } = useRuntime();
  const { selection, dispatch } = useSelection();
  const store = runtime?.ports ?? noPorts;
  const ports = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [generations, setGenerations] = useState<ReadonlyMap<number, number>>(new Map());
  const [timedOut, setTimedOut] = useState<ReadonlySet<number>>(new Set());
  const active = ports.find((port) => port.port === selection.preview) ?? ports[0];

  const onTimeout = (port: number) => setTimedOut((current) => new Set(current).add(port));
  const reload = (port: number) => {
    setTimedOut((current) => {
      const next = new Set(current);
      next.delete(port);
      return next;
    });
    setGenerations((current) => new Map(current).set(port, (current.get(port) ?? 0) + 1));
  };

  const state =
    reason !== undefined
      ? ({
          kind: "error",
          title: "プレビューを開けません",
          message: bootFailureMessage(reason),
        } as const)
      : active === undefined
        ? ({ kind: "loading", label: "サーバーが待ち受けるのを待っています" } as const)
        : timedOut.has(active.port)
          ? ({
              kind: "error",
              title: "プレビューを開けません",
              message: PREVIEW_TIMEOUT_MESSAGE,
            } as const)
          : undefined;

  const frames = (
    <div className="flex min-h-0 flex-1 flex-col *:min-h-48 *:w-full *:flex-1">
      {ports.map((port) => (
        <Activity key={port.port} mode={port.port === active?.port ? "visible" : "hidden"}>
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
      onReload={active && (() => reload(active.port))}
      state={state}
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
