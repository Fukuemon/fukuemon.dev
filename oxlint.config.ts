import { existsSync, readdirSync } from "node:fs";
import { defineConfig, type OxlintOverride } from "oxlint";

const FEATURES_DIR = "apps/web/src/features";
const ISLAND_EXT = ["tsx", "jsx"];

type Restriction = { name?: string; group?: string[]; regex?: string; message: string };

const RULE_1 = "コンテンツの参照は lib/content/ の公開関数を通す (context/codebase.md 規約 1)";
const RULE_3 =
  "island は Astro を import しない。素の props だけを受ける (context/codebase.md 規約 3)";

const noAstroContent: Restriction[] = [{ name: "astro:content", message: RULE_1 }];
const noAstroInIsland: Restriction[] = [
  "astro",
  "astro:assets",
  "astro:transitions",
  "astro:middleware",
].map((name) => ({ name, message: RULE_3 }));
const noAstroFileInIsland: Restriction[] = [{ group: ["*.astro", "**/*.astro"], message: RULE_3 }];
const noPagesLayouts: Restriction[] = [
  {
    group: ["**/pages/**", "~/pages/**", "**/layouts/**", "~/layouts/**"],
    message: "features / components は pages / layouts を参照しない (context/codebase.md 規約 5)",
  },
];

function restrict(paths: Restriction[], patterns: Restriction[]): OxlintOverride["rules"] {
  return { "no-restricted-imports": ["error", { paths, patterns }] };
}

function islandFiles(dir: string): string[] {
  return ISLAND_EXT.map((ext) => `${dir}/**/*.${ext}`);
}

// overrides は同じ規則を後勝ちで上書きし、前の entry と合流しない。
// そのため entry ごとに、そのファイル群に要る禁止を全て書く (context/conventions.md)
function featureOverrides(): OxlintOverride[] {
  // features/ が無い間も、設定の読み込みを失敗させない
  const features = existsSync(FEATURES_DIR)
    ? readdirSync(FEATURES_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
    : [];
  return features.flatMap((feature) => {
    const others = features.filter((f) => f !== feature);
    // Oxlint の regex は先読みを持たないので、自分以外の feature を 1 つずつ並べる
    const otherFeatures: Restriction[] = others.map((other) => ({
      regex: `^(~/features/|(\\.\\./)+(features/)?)${other}(/|$)`,
      message:
        "feature どうしは参照しない。2 つ以上の feature が使うものは components/ へ移す (context/codebase.md 規約 5)",
    }));
    const dir = `${FEATURES_DIR}/${feature}`;
    return [
      {
        files: [`${dir}/**`],
        rules: restrict(noAstroContent, [...noPagesLayouts, ...otherFeatures]),
      },
      {
        files: islandFiles(dir),
        rules: restrict(
          [...noAstroContent, ...noAstroInIsland],
          [...noAstroFileInIsland, ...noPagesLayouts, ...otherFeatures],
        ),
      },
    ];
  });
}

const noFeaturesFromComponents: Restriction[] = [
  {
    group: ["**/features/**", "~/features/**"],
    message:
      "components はセクションをまたぐ素の部品。features を参照しない (context/codebase.md 規約 5)",
  },
];

export default defineConfig({
  plugins: ["eslint", "typescript", "unicorn", "oxc", "react", "jsx-a11y", "import"],
  ignorePatterns: ["docs/design/prototypes/**/vendor/"],
  rules: {
    "import/no-cycle": "error",
    "react/rules-of-hooks": "error",
    "react/exhaustive-deps": "error",
    "react/jsx-key": "error",
    "react/no-array-index-key": "error",
    "react/no-unstable-nested-components": "error",
    "react/set-state-in-effect": "error",
    "react/static-components": "error",
    "react/purity": "error",
    "react/immutability": "error",
    "react/refs": "error",
  },
  overrides: [
    {
      files: ["apps/web/src/pages/**", "apps/web/src/layouts/**"],
      rules: restrict(noAstroContent, []),
    },
    {
      files: ["apps/web/src/lib/**"],
      rules: restrict(
        [],
        [
          {
            group: ["**/features/**", "~/features/**", "**/components/**", "~/components/**"],
            message:
              "lib は features / components を知らない。必要なら引数で受ける (context/codebase.md 規約 5)",
          },
        ],
      ),
    },
    {
      files: ["apps/web/src/components/**"],
      rules: restrict(noAstroContent, [...noFeaturesFromComponents, ...noPagesLayouts]),
    },
    {
      files: islandFiles("apps/web/src/components"),
      rules: restrict(
        [...noAstroContent, ...noAstroInIsland],
        [...noAstroFileInIsland, ...noFeaturesFromComponents, ...noPagesLayouts],
      ),
    },
    ...featureOverrides(),
    {
      files: ["packages/**"],
      rules: restrict(
        [],
        [
          {
            group: ["**/apps/**", "@fukuemon/web*"],
            message: "packages から apps への逆依存は禁止 (context/codebase.md 規約 4)",
          },
        ],
      ),
    },
    {
      // decorator の useEffect は Storybook の hook で、React の hook の規則が当たらない (context/conventions.md)
      files: ["packages/ui/.storybook/**"],
      rules: { "react/rules-of-hooks": "off", "react/exhaustive-deps": "off" },
    },
    {
      files: ["packages/ui/src/**/*.tsx", "packages/ui/src/**/*.ts"],
      rules: {
        "better-tailwindcss/no-unknown-classes": "error",
        "better-tailwindcss/no-restricted-classes": [
          "error",
          {
            restrict: [
              {
                pattern: "[\\[(]",
                message:
                  "任意の値のクラスを書かない。テーマ変数のユーティリティを使う（docs/adr/0020-design-tokens-from-dads.md）",
              },
            ],
          },
        ],
      },
    },
  ],
  jsPlugins: ["eslint-plugin-better-tailwindcss"],
  settings: {
    "better-tailwindcss": {
      entryPoint: "packages/ui/.storybook/preview.css",
    },
  },
});
