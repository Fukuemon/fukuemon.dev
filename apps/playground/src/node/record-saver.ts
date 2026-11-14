import type { FileContents, Store } from "@fukuemon/node-runtime";

import { isSafeFilePath } from "../project/project";
import { type Workspace, type WorkspaceLoad, createSaver } from "../workspace/workspace";
import { filesToSave, withoutExcludedFromSave } from "./save-rules";
import { createStore } from "./store";

/** IndexedDB に保存する 1 件。作業ディレクトリのファイルの一式を、丸ごと置き換える。 */
export type NodeRecord = { files: Record<string, string>; version: string; savedAt: number };

/** 保存のために読んだ作業ディレクトリ。読んでいる途中で上限を超えたときは over-limit である。 */
export type SaveRead = { kind: "read"; entries: readonly FileContents[] } | { kind: "over-limit" };

/**
 * IndexedDB から読んだ値が、保存のレコードの形か。形でない値は、保存したファイルが無いときと同じに扱う。
 * パスは、プロジェクトの JSON と同じ規則で確かめる。WebContainers の mount に、作業ディレクトリの外を指すパスを渡さないためである。
 */
function isNodeRecord(value: unknown): value is NodeRecord {
  if (typeof value !== "object" || value === null) return false;
  const { files, version } = value as Partial<Record<keyof NodeRecord, unknown>>;
  return (
    typeof version === "string" &&
    typeof files === "object" &&
    files !== null &&
    Object.entries(files).every(
      ([path, contents]) => isSafeFilePath(path) && typeof contents === "string",
    ) &&
    !hasFileAsDirectory(Object.keys(files))
  );
}

/** あるファイルのパスが、別のファイルのパスの途中のディレクトリになっているか（`a` と `a/b`）。そのファイルの一式は、作業ディレクトリに書けない。 */
function hasFileAsDirectory(paths: readonly string[]): boolean {
  const files = new Set(paths);
  return paths.some((path) => {
    const parts = path.split("/");
    return parts.slice(1).some((_, i) => files.has(parts.slice(0, i + 1).join("/")));
  });
}

/**
 * IndexedDB から読んだ結果から、起動と保存に使うレコードを作る。形に合わない値は、保存したファイルが無いときと同じに扱う。
 * 保存しないファイルを除き、除いたファイルがあれば、除いた後のレコードを書き直す必要がある (ADR-0070)。
 */
export function readSavedRecord(saved: WorkspaceLoad<NodeRecord>): {
  record: NodeRecord | undefined;
  needsRewrite: boolean;
} {
  if (saved.kind !== "saved" || !isNodeRecord(saved.record))
    return { record: undefined, needsRewrite: false };
  const loaded = saved.record;
  const files = withoutExcludedFromSave(loaded.files);
  return {
    record: { ...loaded, files },
    needsRewrite: Object.keys(files).length !== Object.keys(loaded.files).length,
  };
}

export type RecordSaverOptions = {
  storage: Workspace<NodeRecord>;
  /** 開いたときに読んだレコードから、保存しないファイルを除いたもの。保存したファイルが無いときは undefined である。 */
  record: NodeRecord | undefined;
  /** 除いたファイルがあり、record を IndexedDB に書き直す必要があるか。 */
  needsRewrite: boolean;
  canSave: boolean;
  /** プロジェクトの初期ファイルのバージョン。保存したファイルが無いときと、消した後のレコードに付ける。 */
  projectVersion: string;
  now: () => number;
};

/** Node のページの保存の状態と判断。どのレコードを書くか、いつ書き直すか、保存の失敗の案内をいつ出し、いつ消すかを持つ。 */
export type RecordSaver = {
  /** IndexedDB に保存したファイルがあるか。 */
  hasSaved: Store<boolean>;
  /** 保存が失敗したときは true である。訪問者の変更の保存が通るか、消せると false に戻る。書き直しの失敗だけで立ったときは、書き直しが通っても false に戻る (ADR-0070)。 */
  saveFailed: Store<boolean>;
  /** 最後に読んだ作業ディレクトリが、保存の上限を超えたときは true である。 */
  overLimit: Store<boolean>;
  /** 読んだ作業ディレクトリを保存する。上限を超えたときは、前に保存したレコードを残し、書き直しだけを試す。 */
  persist: (read: SaveRead) => void;
  /** 書き直しが済んでおらず、新しい保存がキューにも無く、成功もしていなければ、除いた後のレコードを書き直す。 */
  rewriteIfUnsaved: () => void;
  /** 待っている保存を捨て、保存したレコードを消し、保存した中身とその状態を忘れる。消せなかったときは、次の保存で今の中身を書き直す扱いにしてから失敗する。 */
  clear: () => Promise<void>;
};

const sameFiles = (a: Record<string, string>, b: Record<string, string> | undefined) =>
  b !== undefined &&
  Object.keys(a).length === Object.keys(b).length &&
  Object.entries(a).every(([path, text]) => Object.hasOwn(b, path) && b[path] === text);

export function createRecordSaver({
  storage,
  record,
  needsRewrite,
  canSave,
  projectVersion,
  now,
}: RecordSaverOptions): RecordSaver {
  const hasSaved = createStore(record !== undefined);
  const saveFailed = createStore(false);
  const overLimit = createStore(false);
  // 保存してあったバージョンを引き継ぐ。初期ファイルのバージョンと違ったことを、保存しても消さない
  let version = record?.version ?? projectVersion;
  let lastSaved = record?.files;
  // 保存しないパスを落としたレコードのうち、まだ書けていないもの。書けるまで、上限を超えていても書き直す (ADR-0070)
  let pendingRewrite = needsRewrite ? record : undefined;
  // 最後に保存を頼んだレコード。中身が同じ保存が後から待ちに入っても、失敗した保存と見分ける
  let lastQueued: NodeRecord | undefined;
  // キューにあるか書いている書き直しのうち、後の通常の保存に置き換えられていないもの。終わるまで、通知のたびに書き直しを重ねない
  let rewriting: NodeRecord | undefined;
  // 書き直しのレコード。後の通常の保存で rewriting が外れた後も、結果が返ったときに書き直しと見分ける
  const rewrites = new WeakSet<NodeRecord>();
  // 訪問者の変更の保存の失敗。書き直しが通っても、この失敗で出た案内は消さない (ADR-0070)
  let visitorSaveFailed = false;
  // 保存が通ったときだけ、保存したファイルがある扱いにする。失敗したときは、次の変更で同じ中身も書き直す
  const saver = createSaver<NodeRecord>({
    ...storage,
    save: (next) =>
      storage.save(next).then(
        () => {
          if (next === rewriting) rewriting = undefined;
          if (!rewrites.has(next)) visitorSaveFailed = false;
          if (!visitorSaveFailed) saveFailed.set(false);
          // 保存するレコードは、どれも保存しないパスを持たないので、どれが通っても書き直しは済む
          pendingRewrite = undefined;
          hasSaved.set(canSave);
        },
        (error: unknown) => {
          if (next === rewriting) rewriting = undefined;
          if (!rewrites.has(next)) visitorSaveFailed = true;
          saveFailed.set(true);
          // 後から待ちに入った新しい保存があれば、その中身を保存済みの扱いのまま残す
          if (next === lastQueued) lastSaved = undefined;
          throw error;
        },
      ),
  });
  const queue = (next: NodeRecord) => {
    lastQueued = next;
    rewriting = rewrites.has(next) ? next : undefined;
    saver.save(next);
  };
  // シークレットのファイルを IndexedDB に残さないため、開いたときに書き直す
  const rewrite = () => {
    if (!pendingRewrite || rewriting) return;
    const next = { ...pendingRewrite, savedAt: now() };
    rewrites.add(next);
    queue(next);
  };
  rewrite();
  // 新しい保存がキューにあるか成功したときは、古いレコードで置き換えない。失敗すれば lastSaved が undefined に戻る (ADR-0070)
  const rewriteIfUnsaved = () => {
    if (lastSaved === undefined) rewrite();
  };

  return {
    hasSaved,
    saveFailed,
    overLimit,
    rewriteIfUnsaved,
    // 上限を超えたときは、前に保存したレコードを残す。保存しないパスを落としたレコードだけは書き直す (ADR-0070)
    persist: (read) => {
      const saving = read.kind === "over-limit" ? read : filesToSave(read.entries);
      overLimit.set(saving.kind === "over-limit");
      if (saving.kind === "over-limit") {
        rewriteIfUnsaved();
        return;
      }
      const { files } = saving;
      if (sameFiles(files, lastSaved)) return;
      lastSaved = files;
      queue({ files, version, savedAt: now() });
    },
    clear: async () => {
      // 消すと待ちの書き直しも捨てるので、書き直しの印も外す
      rewriting = undefined;
      try {
        await saver.clear();
      } catch (error) {
        // 待っていた保存は捨てたので、次の保存で今の中身を書き直す
        lastSaved = undefined;
        throw error;
      }
      pendingRewrite = undefined;
      visitorSaveFailed = false;
      saveFailed.set(false);
      version = projectVersion;
      lastSaved = undefined;
      hasSaved.set(false);
      overLimit.set(false);
    },
  };
}
