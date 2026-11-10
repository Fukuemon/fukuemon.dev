import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { type TabItem, Tabs } from "./Tabs";

const FILES: TabItem[] = [
  { id: "index", label: "index.ts", content: "index.ts の中身", closable: true },
  { id: "server", label: "server.ts", content: "server.ts の中身", closable: true },
  { id: "client", label: "client.ts", content: "client.ts の中身", closable: true },
];

/** 選んだタブと開いているタブを state で持つ例。 */
function TabsExample({ items }: { items: TabItem[] }) {
  const [open, setOpen] = useState(items);
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? "");
  return (
    <Tabs
      items={open}
      label="開いているファイル"
      onClose={(id) => {
        const rest = open.filter((item) => item.id !== id);
        setOpen(rest);
        if (id === selectedId) setSelectedId(rest[0]?.id ?? "");
      }}
      onSelect={setSelectedId}
      selectedId={selectedId}
    />
  );
}

const meta = {
  title: "コンポーネント/Base/Tabs",
  component: TabsExample,
  args: { items: FILES },
} satisfies Meta<typeof TabsExample>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Closable: Story = {};
export const Fixed: Story = {
  args: {
    items: [
      { id: "headers", label: "ヘッダ", content: "ヘッダの一覧" },
      { id: "body", label: "本文", content: "本文" },
      { id: "cookies", label: "Cookie", content: "Cookie の一覧" },
    ],
  },
};
