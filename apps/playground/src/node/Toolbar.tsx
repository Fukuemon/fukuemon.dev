import { Button, ConfirmDialog, Notice } from "@fukuemon/ui";
import {
  type ReactNode,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";

import type { Store } from "@fukuemon/node-runtime";

import { overLimitMessage, resetConfirmMessage } from "./messages";
import type { NodeSession } from "./session";

const useStore = <T,>(store: Store<T>) => useSyncExternalStore(store.subscribe, store.getSnapshot);

/** ペインの上に置く、実行、起動し直す、初期の状態に戻すのボタンと、保存の状態の案内。 */
export function Toolbar({ session, title }: { session: NodeSession; title?: ReactNode }) {
  const busy = useStore(session.busy);
  const hasSaved = useStore(session.hasSaved);
  const versionChanged = useStore(session.versionChanged);
  const saveFailed = useStore(session.saveFailed);
  const overLimit = useStore(session.overLimit);
  const commandFailed = useStore(session.commandFailed);
  const restartReadFailed = useStore(session.restartReadFailed);
  const [running, startRunning] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetFailed, setResetFailed] = useState(false);
  const focusRestart = useRef(false);
  const restartRef = useRef<HTMLButtonElement>(null);

  // 戻すと「初期の状態に戻す」が消え、閉じた <dialog> はフォーカスを body に落とす。<dialog> が閉じた後の描画で移す
  useEffect(() => {
    if (!focusRestart.current || confirming) return;
    focusRestart.current = false;
    restartRef.current?.focus();
  }, [confirming]);

  const run = () => {
    // 失敗は、session の commandFailed で出す
    startRunning(() => session.run().catch(() => undefined));
  };

  // 戻し終えるまで確認のダイアログを閉じない。戻せなかったときは、<dialog> がフォーカスを「初期の状態に戻す」へ戻す
  const reset = () => {
    setResetting(true);
    setResetFailed(false);
    session
      .reset()
      .then(() => {
        focusRestart.current = true;
      })
      .catch((error: unknown) => {
        console.error("初期の状態に戻せない", error);
        setResetFailed(true);
      })
      .finally(() => {
        setResetting(false);
        setConfirming(false);
      });
  };

  return (
    <div className="flex flex-col gap-2">
      <header className="-mx-2 -mt-2 flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b-2 border-text bg-surface px-3 py-1.5">
        <div className="min-w-0">{title}</div>
        {/* 主のボタンを右端に固定する。保存した後に出るボタンを左に足し、押そうとしたボタンが動かないようにする */}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {hasSaved && (
            <Button
              disabled={busy || running}
              onClick={() => setConfirming(true)}
              size="XS"
              variant="secondary"
            >
              初期の状態に戻す
            </Button>
          )}
          <Button
            disabled={busy || running}
            isLoading={busy}
            onClick={() => void session.restart()}
            ref={restartRef}
            size="XS"
            variant="secondary"
          >
            起動し直す
          </Button>
          <Button disabled={busy} isLoading={running} onClick={run} size="XS">
            実行する
          </Button>
        </div>
      </header>
      <div className="flex flex-col gap-2 px-1 empty:hidden">
        {versionChanged && (
          <Notice density="compact" title="記事の初期ファイルが変わりました">
            前に保存したファイルを開いています。記事の新しいファイルで始めるときは、「初期の状態に戻す」を押してください。
          </Notice>
        )}
        {session.canSave && saveFailed && !overLimit && (
          <Notice density="compact" isAlert title="ファイルを保存できませんでした" tone="warning">
            ブラウザの保存の容量が足りないか、保存できない状態です。次にファイルを変えたときに、もう一度保存します。
          </Notice>
        )}
        {session.canSave && overLimit && (
          <Notice density="compact" title="保存の上限を超えたため、保存していません" tone="warning">
            {overLimitMessage(hasSaved, session.project.database === true)}
          </Notice>
        )}
        {!session.canSave && (
          <Notice density="compact" title="ファイルを保存できません" tone="warning">
            このブラウザでは IndexedDB を使えないので、ページを閉じると変えたファイルが消えます。
          </Notice>
        )}
        {restartReadFailed && (
          <Notice
            density="compact"
            isAlert
            title="作業ディレクトリを読めませんでした"
            tone="warning"
          >
            直前に変えたファイルは、起動し直した実行環境に無いことがあります。ファイルを確かめてから、続けてください。
          </Notice>
        )}
        {commandFailed && (
          <Notice
            density="compact"
            isAlert
            title="起動のコマンドを実行できませんでした"
            tone="danger"
          >
            実行環境が止まっているおそれがあります。「起動し直す」を押してから、もう一度実行してください。
          </Notice>
        )}
        {resetFailed && (
          <Notice density="compact" isAlert title="初期の状態に戻せませんでした" tone="danger">
            保存したファイルを消せませんでした。ファイルは前のままです。
          </Notice>
        )}
      </div>
      <ConfirmDialog
        confirmLabel="消して戻す"
        isConfirming={resetting}
        isOpen={confirming}
        onCancel={() => setConfirming(false)}
        onConfirm={reset}
        title="保存したファイルを消して、初期の状態に戻す"
      >
        {resetConfirmMessage(session.project.database === true)}
      </ConfirmDialog>
    </div>
  );
}
