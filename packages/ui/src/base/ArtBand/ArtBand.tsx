import { clsx } from "clsx";

import kasumi from "../../art/kasumi.svg?raw";
import kasumiMotion from "../../art/kasumi-motion.svg?raw";
import moonPine from "../../art/moon-pine.svg?raw";
import moonPineMotion from "../../art/moon-pine-motion.svg?raw";
import seigaiha from "../../art/seigaiha.svg?raw";

export type ArtMotif = "kasumi" | "seigaiha" | "moonPine";

export type ArtBandLayout = "fill" | "band";

export type ArtBandProps = {
  /** 図柄。記事の一覧の冒頭は `seigaiha` を置く。トップは水墨の門の絵と立体の庭で、ArtBand を使わない（ADR-0026）。 */
  motif: ArtMotif;
  /**
   * `fill` は、`relative` を持つ親の全体に広げる。
   * `band` は 120 px の帯にし、上端を地の色へなじませる。
   */
  layout?: ArtBandLayout;
};

// 動きの層は、読み込んだ直後の 1 回だけ濃度を上げて出る。位置は動かさず、WCAG 2.2.2 の 5 秒より短くする
const MOTIFS: Record<ArtMotif, { plate: string; motion?: { svg: string; className: string } }> = {
  kasumi: {
    plate: kasumi,
    motion: {
      svg: kasumiMotion,
      className: "transition-opacity duration-4000 ease-out starting:opacity-0",
    },
  },
  seigaiha: { plate: seigaiha },
  moonPine: {
    plate: moonPine,
    motion: {
      svg: moonPineMotion,
      className: "transition-opacity duration-3000 ease-out starting:opacity-0",
    },
  },
};

/**
 * 版画風の挿絵の帯。挿絵は装飾なので、読み上げに渡さない。
 * 子の要素を受け取らない。文字を重ねるときは、帯の外に霞と文字を重ねる。
 * 記事の本文とコードを動かす画面には置かない。
 */
export function ArtBand({ motif, layout = "band" }: ArtBandProps) {
  const { plate, motion } = MOTIFS[motif];
  return (
    <div
      aria-hidden="true"
      className={clsx(
        "overflow-hidden",
        layout === "fill" ? "absolute inset-0" : "relative h-30 mask-t-from-50%",
      )}
      data-motif={motif}
    >
      {/* SVG は生成器が書いたリポジトリの中のファイルで、外から渡る値を含まない */}
      <div className="absolute inset-0" dangerouslySetInnerHTML={{ __html: plate }} />
      {motion && (
        <div
          className={clsx("absolute inset-0", motion.className)}
          dangerouslySetInnerHTML={{ __html: motion.svg }}
        />
      )}
    </div>
  );
}
