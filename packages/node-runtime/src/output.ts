import type { OutputLog } from "./types";

/** 1 つのプロセスが持つ出力の上限。超えたときは、古い側から捨てる。 */
const MAX_OUTPUT_CHARS = 1024 * 1024;

export type WritableOutputLog = OutputLog & { append: (chunk: string) => void };

export function createOutputLog(maxChars = MAX_OUTPUT_CHARS): WritableOutputLog {
  let text = "";
  const listeners = new Set<(chunk: string) => void>();
  return {
    read: () => text,
    subscribe: (onChunk) => {
      listeners.add(onChunk);
      return () => listeners.delete(onChunk);
    },
    append: (chunk) => {
      text += chunk;
      if (text.length > maxChars) text = text.slice(text.length - maxChars);
      for (const listener of listeners) listener(chunk);
    },
  };
}
