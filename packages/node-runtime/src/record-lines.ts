import type { BackendProcess } from "./backend";
import type { ProcessInfo } from "./types";

/** 記録の行を出したプロセス。サーバーの名前に、起動のコマンドの名前を使う。 */
export type RecordSource = Pick<ProcessInfo, "kind" | "name">;

/** preload が記録の行の頭に付ける文字列。guest/http-trace.cjs と同じ値にする (apps/playground/DesignDoc.md の「記録を読む形」)。 */
export const HTTP_PREFIX = "@@fd:http ";

/** 出力の末尾が記録の行の頭の途中で切れたときに、続きを待つ時間。続きが来なければ、端末に出す。 */
const HOLD_MS = 50;

/** 記録の行の頭が見つかってから、改行を待つ文字数の上限。超えたら、記録の行ではないとみなして端末に出す。 */
const MAX_LINE_CHARS = 4 * 1024 * 1024;

/** text の末尾が、prefix の先頭の何文字と一致するか。prefix の全体と一致するときは数えない。 */
function partialPrefixLength(text: string, prefix: string): number {
  for (let length = Math.min(prefix.length - 1, text.length); length > 0; length--) {
    if (text.endsWith(prefix.slice(0, length))) return length;
  }
  return 0;
}

/**
 * プロセスの出力から、記録の行を抜き出す。onText には記録の行を除いた出力を、onLine には記録の行の頭を除いた中身を渡す。
 * 記録の行は、出力の途中で切れて届くので、頭か改行が届くまで手元に置く。頭の途中で切れたものは、HOLD_MS の後に端末に出す。
 */
export function createRecordLineFilter(
  onText: (text: string) => void,
  onLine: (line: string) => void,
) {
  const prefix = HTTP_PREFIX;
  let held = "";
  let timer: ReturnType<typeof setTimeout> | undefined;
  let discarded = false;

  const release = () => {
    timer = undefined;
    if (held === "" || discarded) return;
    const text = held;
    held = "";
    onText(text);
  };

  const push = (chunk: string) => {
    clearTimeout(timer);
    timer = undefined;
    let text = held + chunk;
    held = "";
    let out = "";
    for (;;) {
      const at = text.indexOf(prefix);
      if (at === -1) break;
      const end = text.indexOf("\n", at);
      if (end === -1) {
        if (text.length - at > MAX_LINE_CHARS) break;
        out += text.slice(0, at);
        held = text.slice(at);
        if (out !== "") onText(out);
        return;
      }
      out += text.slice(0, at);
      onLine(text.slice(at + prefix.length, end).replace(/\r$/, ""));
      text = text.slice(end + 1);
    }
    const keep = partialPrefixLength(text, prefix);
    out += text.slice(0, text.length - keep);
    held = text.slice(text.length - keep);
    if (out !== "") onText(out);
    if (held !== "") timer = setTimeout(release, HOLD_MS);
  };

  return {
    push,
    /** 手元に置いた出力を、記録の行でなかったものとして端末に出す。プロセスが終わったときに呼ぶ。 */
    flush: () => {
      clearTimeout(timer);
      release();
    },
    /** 手元に置いた出力を捨て、この後の flush でも渡さない。購読を外したときに呼ぶ。 */
    discard: () => {
      clearTimeout(timer);
      held = "";
      discarded = true;
    },
  };
}

/**
 * 端末に出さないプロセスの出力から、prefix の付いた行を抜き出し、頭を除いた中身を onLine に渡す。ほかの行は捨てる。
 * DB のプロセスの応答の行は 10 MB を超えることがあるので、createRecordLineFilter と違い長さの上限を置かず、
 * 届いた chunk だけで改行を探して、ためた分を毎回走査し直さない。
 */
export function createPrefixedLineReader(prefix: string, onLine: (line: string) => void) {
  let held: string[] = [];
  const emit = (raw: string) => {
    const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    if (line.startsWith(prefix)) onLine(line.slice(prefix.length));
  };
  return (chunk: string) => {
    let start = 0;
    for (let end = chunk.indexOf("\n"); end !== -1; end = chunk.indexOf("\n", start)) {
      held.push(chunk.slice(start, end));
      const line = held.join("");
      held = [];
      emit(line);
      start = end + 1;
    }
    if (start < chunk.length) held.push(chunk.slice(start));
  };
}

/**
 * process の出力から記録の行を除き、onLine に渡す。購読ごとに、行を抜き出す処理を 1 つ作るので、購読は 1 つだけにする。
 * プロセスが終わったときは、手元に置いた出力を、記録の行でなかったものとして購読した側に渡す。購読を外したときは捨てる。
 * 購読した側は、exit が解決した後に購読を外す。先に外すと、終わる直前の出力が捨てられる。
 */
export function withoutRecordLines(
  process: BackendProcess,
  onLine: (line: string) => void,
): BackendProcess {
  const subscribe = (onChunk: (chunk: string) => void) => {
    const filter = createRecordLineFilter(onChunk, onLine);
    void process.exit.then(filter.flush, filter.flush);
    const stop = process.output.subscribe(filter.push);
    return () => {
      filter.discard();
      stop();
    };
  };
  return { ...process, output: { subscribe } };
}
