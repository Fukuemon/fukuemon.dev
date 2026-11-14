import type { NodeRuntime } from "@fukuemon/node-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { nodeDefaultProject } from "../project/defaults";
import { RuntimeContext, SelectionContext, useRuntime, useSelection } from "./context";
import { initialSelection } from "./selection";
import type { RuntimeResult } from "./session";

// React の use は、status が fulfilled の Promise を、待たずに読む
const settled = (result: RuntimeResult) =>
  Object.assign(Promise.resolve(result), { status: "fulfilled", value: result });

function RuntimeProbe() {
  const { runtime, reason } = useRuntime();
  return <p>{runtime ? "running" : reason}</p>;
}

function SelectionProbe() {
  return <p>{useSelection().selection.activeFile}</p>;
}

const renderRuntime = (result: RuntimeResult) =>
  renderToStaticMarkup(
    <RuntimeContext
      value={{
        project: nodeDefaultProject,
        runtime: settled(result),
        restart: async () => undefined,
      }}
    >
      <RuntimeProbe />
    </RuntimeContext>,
  );

describe("useRuntime", () => {
  it("起動した実行環境を返す", () => {
    expect(renderRuntime({ kind: "running", runtime: {} as NodeRuntime })).toBe("<p>running</p>");
  });

  it("起動できなかったときは、理由を返す", () => {
    expect(renderRuntime({ kind: "unavailable", reason: "timeout" })).toBe("<p>timeout</p>");
  });

  it("provider の外では、誤りにする", () => {
    expect(() => renderToStaticMarkup(<RuntimeProbe />)).toThrow("RuntimeContext");
  });
});

describe("useSelection", () => {
  it("選択の状態を返す", () => {
    const html = renderToStaticMarkup(
      <SelectionContext
        value={{ selection: initialSelection("index.js"), dispatch: () => undefined }}
      >
        <SelectionProbe />
      </SelectionContext>,
    );
    expect(html).toBe("<p>index.js</p>");
  });

  it("provider の外では、誤りにする", () => {
    expect(() => renderToStaticMarkup(<SelectionProbe />)).toThrow("SelectionContext");
  });
});
