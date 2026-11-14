import type { ProcessInfo } from "@fukuemon/node-runtime";
import { describe, expect, it } from "vitest";

import {
  SUPPORTED_BROWSERS,
  bootFailureMessage,
  httpTabLabel,
  overLimitMessage,
  processLabel,
  shellName,
} from "./messages";

describe("overLimitMessage", () => {
  it.each([
    [
      true,
      "作業ディレクトリのファイルが 1000 個か 10 MB を超えました。ページを閉じると、前に保存したときのファイルに戻ります。ファイルを減らすと、また保存します。",
    ],
    [
      false,
      "作業ディレクトリのファイルが 1000 個か 10 MB を超えました。ページを閉じると、変えたファイルが消えます。ファイルを減らすと、また保存します。",
    ],
  ])("保存したファイルがあるかが %s のときの本文", (hasSaved, message) => {
    expect(overLimitMessage(hasSaved)).toBe(message);
  });
});

const info = (
  name: string,
  status: ProcessInfo["status"] = { kind: "running" },
  kind: ProcessInfo["kind"] = "command",
): ProcessInfo => ({
  id: name,
  kind,
  name,
  status,
});

describe("bootFailureMessage", () => {
  it.each(["not-isolated", "timeout", "failed"] as const)(
    "%s のときも、対応するブラウザを添える",
    (reason) => {
      expect(bootFailureMessage(reason).endsWith(SUPPORTED_BROWSERS)).toBe(true);
    },
  );
});

describe("processLabel", () => {
  it.each([
    [
      "終了したプロセスは、終了コードを添える",
      info("npm install", { kind: "exited", code: 1 }),
      "npm install（終了 1）",
    ],
    ["動いているプロセスは、名前だけにする", info("サーバー"), "サーバー"],
  ])("%s", (_, process, expected) => {
    expect(processLabel(process)).toBe(expected);
  });
});

const shell = (name: string) => info(name, { kind: "running" }, "shell");

describe("shellName", () => {
  it.each([
    ["シェルが無いときは、番号を付けない", [info("npm install")], "シェル"],
    ["2 つ目のシェルは、2 を付ける", [shell("シェル"), info("サーバー")], "シェル 2"],
    ["名前で見分けず、シェルとして起動したプロセスを数える", [info("シェル")], "シェル"],
    ["3 つ目のシェルは、3 を付ける", [shell("シェル"), shell("シェル 2")], "シェル 3"],
  ])("%s", (_, processes, expected) => {
    expect(shellName(processes)).toBe(expected);
  });
});

describe("httpTabLabel", () => {
  it.each([
    ["記録が無いときは、件数を添えない", 0, "HTTP の流れ"],
    ["記録があるときは、件数を添える", 8, "HTTP の流れ（8）"],
  ])("%s", (_, count, expected) => {
    expect(httpTabLabel(count)).toBe(expected);
  });
});
