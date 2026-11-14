import { Button, ConfirmDialog, Notice } from "@fukuemon/ui";
import { useState, useSyncExternalStore, useTransition } from "react";

import type { Store } from "@fukuemon/node-runtime";

import type { NodeSession } from "./session";

const useStore = <T,>(store: Store<T>) => useSyncExternalStore(store.subscribe, store.getSnapshot);

/** ペインの上に置く、実行、起動し直す、初期の状態に戻すのボタンと、保存の状態の案内。 */
export function Toolbar({ session }: { session: NodeSession }) {
  const busy = useStore(session.busy);
  const hasSaved = useStore(session.hasSaved);
  const versionChanged = useStore(session.versionChanged);
  const saveFailed = useStore(session.saveFailed);
  const [running, startRunning] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [resetFailed, setResetFailed] = useState(false);

  const reset = () => {
    setConfirming(false);
    setResetFailed(false);
    session.reset().catch((error: unknown) => {
      console.error("初期の状態に戻せない", error);
      setResetFailed(true);
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          disabled={busy}
          isLoading={running}
          onClick={() => startRunning(() => session.run())}
          size="S"
        >
          実行する
        </Button>
        <Button
          disabled={busy || running}
          onClick={() => void session.restart()}
          size="S"
          variant="secondary"
        >
          起動し直す
        </Button>
        {hasSaved && (
          <Button
            disabled={busy || running}
            onClick={() => setConfirming(true)}
            size="S"
            variant="secondary"
          >
            初期の状態に戻す
          </Button>
        )}
      </div>
      {versionChanged && (
        <Notice density="compact" title="記事の初期ファイルが変わりました">
          前に保存したファイルを開いています。記事の新しいファイルで始めるときは、「初期の状態に戻す」を押してください。
        </Notice>
      )}
      {session.canSave && saveFailed && (
        <Notice density="compact" isAlert title="ファイルを保存できませんでした" tone="warning">
          ブラウザの保存の容量が足りないか、保存できない状態です。次にファイルを変えたときに、もう一度保存します。
        </Notice>
      )}
      {!session.canSave && (
        <Notice density="compact" title="ファイルを保存できません" tone="warning">
          このブラウザでは IndexedDB を使えないので、ページを閉じると変えたファイルが消えます。
        </Notice>
      )}
      {resetFailed && (
        <Notice density="compact" isAlert title="初期の状態に戻せませんでした" tone="danger">
          保存したファイルを消せませんでした。ファイルは前のままです。
        </Notice>
      )}
      <ConfirmDialog
        confirmLabel="戻す"
        isOpen={confirming}
        onCancel={() => setConfirming(false)}
        onConfirm={reset}
        title="初期の状態に戻しますか"
      >
        保存したファイルを消し、記事の初期ファイルで実行環境を起動し直します。消したファイルは戻せません。
      </ConfirmDialog>
    </div>
  );
}
