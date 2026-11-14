// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { usePaneFocus } from "./usePaneFocus";

// React の act を、テストの外の環境で使えるようにする
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let focus: Omit<ReturnType<typeof usePaneFocus>, "rootRef">;

/** タブの帯、隠したエディタのペイン、見えたままのボタンを持つ、狭い配置の模型。 */
function Layout({ isEditorHidden }: { isEditorHidden: boolean }) {
  const { rootRef, ...actions } = usePaneFocus();
  focus = actions;
  return (
    <div ref={rootRef}>
      <button aria-selected="true" role="tab" type="button">
        出力
      </button>
      <div hidden={isEditorHidden}>
        <textarea aria-label="コード" className="cm-content" data-testid="editor" />
      </div>
      <button type="button">実行する</button>
    </div>
  );
}

describe("usePaneFocus", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = (isEditorHidden: boolean) =>
    act(() => root.render(<Layout isEditorHidden={isEditorHidden} />));
  const byTestId = (id: string) => container.querySelector<HTMLElement>(`[data-testid="${id}"]`);

  it("エディタへ移すと、CodeMirror の入力の領域にフォーカスする", () => {
    render(false);
    act(() => focus.focusEditor());
    expect(document.activeElement).toBe(byTestId("editor"));
  });

  it("フォーカスがあったペインを隠すと、選んだタブへ移す", () => {
    render(false);
    byTestId("editor")?.focus();
    render(true);
    act(() => focus.focusSelectedTab());
    expect(document.activeElement).toBe(container.querySelector('[role="tab"]'));
  });

  it("見えたままのボタンにあるフォーカスは、タブへ移さない", () => {
    render(true);
    const button = container.querySelector<HTMLButtonElement>("button:not([role])");
    button?.focus();
    act(() => focus.focusSelectedTab());
    expect(document.activeElement).toBe(button);
  });
});
