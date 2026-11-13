import type { NodeRuntime } from "@fukuemon/node-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { nodeDefaultProject } from "../project/defaults";
import { RuntimeContext, SelectionContext, useRuntime, useSelection } from "./context";
import { initialSelection } from "./selection";
import type { RuntimeResult } from "./session";
import { colorScheme } from "./terminal-theme";

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

describe("useRuntime", () => {
  it("起動した実行環境を返す", () => {
    const html = renderToStaticMarkup(
      <RuntimeContext
        value={{
          project: nodeDefaultProject,
          runtime: settled({ kind: "running", runtime: {} as NodeRuntime }),
        }}
      >
        <RuntimeProbe />
      </RuntimeContext>,
    );
    expect(html).toBe("<p>running</p>");
  });

  it("起動できなかったときは、理由を返す", () => {
    const html = renderToStaticMarkup(
      <RuntimeContext
        value={{
          project: nodeDefaultProject,
          runtime: settled({ kind: "unavailable", reason: "timeout" }),
        }}
      >
        <RuntimeProbe />
      </RuntimeContext>,
    );
    expect(html).toBe("<p>timeout</p>");
  });

  it("provider の外では、誤りにする", () => {
    expect(() => renderToStaticMarkup(<RuntimeProbe />)).toThrow("RuntimeContext");
  });
});

describe("useSelection", () => {
  it("選択の状態を返し、provider の外では誤りにする", () => {
    const html = renderToStaticMarkup(
      <SelectionContext
        value={{ selection: initialSelection("index.js"), dispatch: () => undefined }}
      >
        <SelectionProbe />
      </SelectionContext>,
    );
    expect(html).toBe("<p>index.js</p>");
    expect(() => renderToStaticMarkup(<SelectionProbe />)).toThrow("SelectionContext");
  });
});

describe("colorScheme", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("OS の設定に合わせて、light か dark を返し、変化を購読する", () => {
    const query = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    vi.stubGlobal("matchMedia", () => query);
    expect(colorScheme.getSnapshot()).toBe("dark");
    const onChange = () => undefined;
    const unsubscribe = colorScheme.subscribe(onChange);
    unsubscribe();
    expect(query.addEventListener).toHaveBeenCalledWith("change", onChange);
    expect(query.removeEventListener).toHaveBeenCalledWith("change", onChange);
    query.matches = false;
    expect(colorScheme.getSnapshot()).toBe("light");
  });

  it("matchMedia が無いときは、light にする", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(colorScheme.getSnapshot()).toBe("light");
    colorScheme.subscribe(() => undefined)();
  });
});
