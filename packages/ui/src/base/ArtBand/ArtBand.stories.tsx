import type { Meta, StoryObj } from "@storybook/react-vite";

import { ArtBand, type ArtMotif } from "./ArtBand";

const meta = {
  title: "コンポーネント/Base/ArtBand",
  component: ArtBand,
  args: { motif: "kasumi" },
} satisfies Meta<typeof ArtBand>;

export default meta;

type Story = StoryObj<typeof meta>;

// 文字は帯の外に置き、霞で無地にした面の上に載せる
function Hero({ motif, title, lead }: { motif: ArtMotif; title: string; lead: string }) {
  return (
    <div className="relative h-80 overflow-hidden bg-surface">
      <ArtBand layout="fill" motif={motif} />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-linear-96 from-surface from-30% to-transparent to-70%"
      />
      <div className="relative flex flex-col gap-4 p-6">
        <h1 className="font-heading text-heading-lg font-semibold text-text">{title}</h1>
        <p className="text-body text-text">{lead}</p>
      </div>
    </div>
  );
}

export const Kasumi: Story = {
  name: "霞の山並み（トップ）",
  args: { motif: "kasumi", layout: "fill" },
  render: () => (
    <Hero lead="読んで理解し、手を動かして確かめる" motif="kasumi" title="fukuemon.dev" />
  ),
};

export const Seigaiha: Story = {
  name: "青海波（記事の一覧の冒頭）",
  args: { motif: "seigaiha", layout: "band" },
  render: (args) => (
    <div className="flex flex-col gap-2 bg-surface p-4">
      <h1 className="font-heading text-heading-lg font-semibold text-text">記事</h1>
      <ArtBand {...args} />
      <ul className="list-disc pl-6 text-body text-text">
        <li>記事の題 1</li>
        <li>記事の題 2</li>
      </ul>
    </div>
  ),
};

export const MoonPine: Story = {
  name: "月と松（about）",
  args: { motif: "moonPine", layout: "fill" },
  render: () => <Hero lead="技術記事とハンズオンを書いている。" motif="moonPine" title="about" />,
};
