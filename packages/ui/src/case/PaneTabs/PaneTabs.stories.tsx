import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { PaneTabs, type PaneTabsPlacement } from "./PaneTabs";

const icon = (d: string) => (
  <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 20 20" width="20">
    <path d={d} stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

/** 選んだペインを保つ組。タブを替えても、隠したペインの入力が残ることを確かめるのに使う。 */
function PaneTabsExample({ placement }: { placement: PaneTabsPlacement }) {
  const [selected, setSelected] = useState("editor");
  return (
    <div className="h-96 w-full max-w-sm border border-border">
      <PaneTabs
        items={[
          {
            id: "editor",
            label: "エディタ",
            icon: icon("M7.5 6L3.5 10l4 4M12.5 6l4 4-4 4"),
            content: (
              <label className="flex flex-col gap-1 p-3 text-compact">
                エディタの中身
                <input className="border border-border-field px-1" defaultValue="" />
              </label>
            ),
          },
          {
            id: "terminal",
            label: "端末",
            icon: icon("M3.5 6l4 4-4 4M9.5 14.5h7"),
            content: <p className="p-3 text-compact">~/project</p>,
          },
          {
            id: "preview",
            label: "プレビュー",
            icon: icon("M2.75 3.75h14.5v12.5H2.75zM2.75 7.25h14.5"),
            content: <p className="p-3 text-compact">Hello from Node</p>,
          },
        ]}
        label="ペイン"
        leading={
          <button
            aria-label="ファイル"
            className="inline-grid size-11 place-items-center focus-visible:focus-ring-inset"
            type="button"
          >
            {icon("M2.75 4.75h5l1.5 1.5h8v9h-14.5z")}
          </button>
        }
        onSelect={setSelected}
        placement={placement}
        selectedId={selected}
      />
    </div>
  );
}

const meta = {
  title: "コンポーネント/Case/PaneTabs",
  component: PaneTabsExample,
} satisfies Meta<typeof PaneTabsExample>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Bottom: Story = { args: { placement: "bottom" } };
export const Start: Story = { args: { placement: "start" } };
export const Top: Story = { args: { placement: "top" } };
