import type { Meta, StoryObj } from "@storybook/react-vite";

import { ArtBand, type ArtMotif } from "./ArtBand";

const meta = {
  title: "コンポーネント/Base/ArtBand",
  component: ArtBand,
  args: { motif: "kasumi" },
} satisfies Meta<typeof ArtBand>;

export default meta;

type Story = StoryObj<typeof meta>;

// 版画風の挿絵は、記事の一覧の冒頭だけに置く（adr/0026-sumi-gate-and-garden-on-top.md）
function ListHead({ motif, title }: { motif: ArtMotif; title: string }) {
  return (
    <div className="flex flex-col gap-2 bg-surface p-4">
      <h1 className="font-heading text-heading-lg font-semibold text-text">{title}</h1>
      <ArtBand layout="band" motif={motif} />
      <ul className="list-disc pl-6 text-body text-text">
        <li>記事の題 1</li>
        <li>記事の題 2</li>
      </ul>
    </div>
  );
}

export const Seigaiha: Story = {
  name: "青海波（記事の一覧の冒頭）",
  args: { motif: "seigaiha", layout: "band" },
  render: () => <ListHead motif="seigaiha" title="記事" />,
};

export const Kasumi: Story = {
  name: "霞の山並み（記事の一覧の冒頭）",
  args: { motif: "kasumi", layout: "band" },
  render: () => <ListHead motif="kasumi" title="記事" />,
};

export const MoonPine: Story = {
  name: "月と松（記事の一覧の冒頭）",
  args: { motif: "moonPine", layout: "band" },
  render: () => <ListHead motif="moonPine" title="記事" />,
};
