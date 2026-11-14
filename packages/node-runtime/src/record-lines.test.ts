import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BackendProcess } from "./backend";
import {
  CONSOLE_PREFIX,
  HTTP_PREFIX,
  type RecordKind,
  createRecordLineFilter,
  withoutRecordLines,
} from "./record-lines";

/** 抜き出す処理に chunks を順に渡し、端末に渡した出力と記録の行を返す。 */
const filtered = (...chunks: string[]) => {
  const text: string[] = [];
  const lines: string[] = [];
  const kinds: RecordKind[] = [];
  const filter = createRecordLineFilter(
    (chunk) => text.push(chunk),
    (line, kind) => {
      lines.push(line);
      kinds.push(kind);
    },
  );
  for (const chunk of chunks) filter.push(chunk);
  return { filter, text, lines, kinds };
};

describe("createRecordLineFilter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("記録の行を除いた出力を端末に渡す", () => {
    const { text } = filtered(`listening\r\n${HTTP_PREFIX}{"a":1}\r\nnext\r\n`);
    expect(text.join("")).toBe("listening\r\nnext\r\n");
  });

  it("HTTP とコンソールの記録の行を、出た順に種類と一緒に渡す", () => {
    const { text, lines, kinds } = filtered(
      `a\n${CONSOLE_PREFIX}{"c":1}\n${HTTP_PREFIX}{"h":1}\nb ${CONSOLE_PREFIX}{"c":2}\n`,
    );
    expect({ text: text.join(""), lines, kinds }).toStrictEqual({
      text: "a\nb ",
      lines: ['{"c":1}', '{"h":1}', '{"c":2}'],
      kinds: ["console", "http", "console"],
    });
  });

  it("コンソールの記録の頭の途中で切れた出力は、続きが届いたら記録の行にする", () => {
    const { lines, kinds } = filtered("$ @@fd:con", 'sole {"c":1}\n');
    expect({ lines, kinds }).toStrictEqual({ lines: ['{"c":1}'], kinds: ["console"] });
  });

  it("記録の行の中身を、端末の改行の \\r を外して渡す", () => {
    const { lines } = filtered(`listening\r\n${HTTP_PREFIX}{"a":1}\r\nnext\r\n`);
    expect(lines).toStrictEqual(['{"a":1}']);
  });

  it("行の途中で切れた記録の行は、改行が届くまで端末に渡さない", () => {
    const { text } = filtered(`ok ${HTTP_PREFIX}{"a"`);
    vi.advanceTimersByTime(1000);
    expect(text.join("")).toBe("ok ");
  });

  it("行の途中で切れた記録の行は、続きが届いたら 1 行にする", () => {
    const { lines } = filtered(`ok ${HTTP_PREFIX}{"a"`, ":2}\nafter");
    expect(lines).toStrictEqual(['{"a":2}']);
  });

  it("頭の途中で切れた出力は、続きが届いたら記録の行にする", () => {
    const { lines } = filtered("prompt $ @@fd", ":http {}\n");
    expect(lines).toStrictEqual(["{}"]);
  });

  it("頭の途中で切れた出力は、続きが来なければ 50 ms の後に端末に渡す", () => {
    const { text } = filtered("user typed @");
    vi.advanceTimersByTime(50);
    expect(text).toStrictEqual(["user typed ", "@"]);
  });

  it("flush は、手元の出力を端末に渡す", () => {
    const { filter, text } = filtered(`${HTTP_PREFIX}{"cut"`);
    filter.flush();
    expect(text).toStrictEqual([`${HTTP_PREFIX}{"cut"`]);
  });

  it("discard は、手元の出力を捨て、50 ms の後にも渡さない", () => {
    const { filter, text } = filtered("user typed @");
    filter.discard();
    vi.advanceTimersByTime(50);
    expect(text).toStrictEqual(["user typed "]);
  });

  it("改行の無いまま上限を超えた行は、記録の行とみなさず端末に出す", () => {
    const long = "x".repeat(4 * 1024 * 1024 + 1);
    const { text } = filtered(`${HTTP_PREFIX}${long}`);
    expect(text.join("")).toBe(`${HTTP_PREFIX}${long}`);
  });
});

/** テストから出力を流し、終わらせるプロセス。 */
function fakeProcess() {
  const listeners = new Set<(chunk: string) => void>();
  let finish: (code: number) => void = () => undefined;
  let fail: (error: unknown) => void = () => undefined;
  const exit = new Promise<number>((resolve, reject) => {
    finish = resolve;
    fail = reject;
  });
  const process: BackendProcess = {
    output: {
      subscribe: (onChunk) => {
        listeners.add(onChunk);
        return () => listeners.delete(onChunk);
      },
    },
    write: () => undefined,
    resize: () => undefined,
    kill: () => undefined,
    exit,
  };
  const emit = (chunk: string) => {
    for (const listener of listeners) listener(chunk);
  };
  return { process, emit, finish, fail, listeners };
}

describe("withoutRecordLines", () => {
  it.each([
    ["終了コードで終わった", (p: ReturnType<typeof fakeProcess>) => p.finish(0)],
    ["exit が失敗した", (p: ReturnType<typeof fakeProcess>) => p.fail(new Error("x"))],
  ])("プロセスが%sときは、手元の出力を購読した側に渡す", async (_, end) => {
    const fake = fakeProcess();
    const chunks: string[] = [];
    withoutRecordLines(fake.process, () => undefined).output.subscribe((c) => chunks.push(c));
    fake.emit(`${HTTP_PREFIX}{`);
    end(fake);
    await fake.process.exit.catch(() => undefined);
    expect(chunks).toStrictEqual([`${HTTP_PREFIX}{`]);
  });

  it("購読を外した後は、プロセスが終わっても、手元の出力を渡さない", async () => {
    const fake = fakeProcess();
    const chunks: string[] = [];
    const stop = withoutRecordLines(fake.process, () => undefined).output.subscribe((c) =>
      chunks.push(c),
    );
    fake.emit(`${HTTP_PREFIX}{`);
    stop();
    fake.finish(0);
    await fake.process.exit;
    expect(chunks).toStrictEqual([]);
  });
});
