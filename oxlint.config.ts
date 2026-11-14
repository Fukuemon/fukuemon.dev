import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { defineConfig, type OxlintOverride } from "oxlint";

const FEATURES_DIR = "apps/web/src/features";
const ISLAND_EXT = ["tsx", "jsx"];

type Restriction = {
  name?: string;
  group?: string[];
  regex?: string;
  allowTypeImports?: boolean;
  message: string;
};

type SubdirRestriction = { name: string; patterns: Restriction[] };

const RULE_1 = "コンテンツの参照は lib/content/ の公開関数を通す (context/codebase.md 規約 1)";
const RULE_3 =
  "island は Astro を import しない。素の props だけを受ける (context/codebase.md 規約 3)";

const noAstroContent: Restriction[] = [{ name: "astro:content", message: RULE_1 }];
const noAstroInIsland: Restriction[] = [{ name: "astro", message: RULE_3 }];
const noAstroFileInIsland: Restriction[] = [
  { group: ["*.astro", "**/*.astro", "astro:*", "astro:*/**", "astro/**"], message: RULE_3 },
];
const noPagesLayouts: Restriction[] = [
  {
    group: ["**/pages/**", "~/pages/**", "**/layouts/**", "~/layouts/**"],
    message: "features / components は pages / layouts を参照しない (context/codebase.md 規約 5)",
  },
];

const noWebcontainer: Restriction[] = [
  {
    name: "@webcontainer/api",
    message:
      "@webcontainer/api は packages/node-runtime/src/webcontainer/ だけが import する (apps/playground/DesignDoc.md)",
  },
];

// override は規則を置き換えるので、どの entry にも @webcontainer/api の禁止を足す
function restrict(paths: Restriction[], patterns: Restriction[]): OxlintOverride["rules"] {
  return { "no-restricted-imports": ["error", { paths: [...paths, ...noWebcontainer], patterns }] };
}

const PLAYGROUND_DIR = "apps/playground";

// ツールは、エントリーポイントの HTML を持つディレクトリから読む。ツールを足したときに、設定を直さなくてよい
function playgroundTools(): string[] {
  const root = join(import.meta.dirname, PLAYGROUND_DIR);
  if (!existsSync(root)) throw new Error(`${PLAYGROUND_DIR} が無い。PLAYGROUND_DIR を直す`);
  const tools = readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(root, d.name, "index.html")))
    .map((d) => d.name);
  if (tools.length === 0) throw new Error(`${PLAYGROUND_DIR} にツールのエントリーポイントが無い`);
  // HTML と src/ のディレクトリの名前がずれると、禁止が掛からないまま通る
  const missing = tools.filter((tool) => !existsSync(join(root, "src", tool)));
  if (missing.length > 0) throw new Error(`${PLAYGROUND_DIR}/src/ に ${missing.join("、")} が無い`);
  return tools;
}

function playgroundToolOverrides(): OxlintOverride[] {
  const tools = playgroundTools();
  return tools.map((tool) => ({
    files: [`${PLAYGROUND_DIR}/src/${tool}/**`],
    rules: restrict(
      [],
      tools
        .filter((t) => t !== tool)
        .map((other) => ({
          regex: `^(\\.\\./)+${escapeRegex(other)}(/|$)`,
          message:
            "ツールのページどうしは参照しない。2 つ以上のツールが使うものは、関心ごとのディレクトリへ移す (apps/playground/DesignDoc.md)",
        })),
    ),
  }));
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const TOP_GARDEN_README = `${FEATURES_DIR}/top-garden/README.md`;
// alias、../ の連続、./../ の形で書いた top-garden 内の兄弟ディレクトリを当てる
const GARDEN_PREFIX =
  "^(~/features/top-garden/|(\\.\\./)+(features/)?(top-garden/)?|\\./(\\.\\./)+)";

// stage/ の関数は文字列にして head の inline script に埋め込むので、scene/ のコードを import できない。
// 例外は、TopStageScript.astro が読む場面のバンドルの URL (?worker&url) だけ
const topGardenSubdirs: SubdirRestriction[] = [
  {
    name: "ink",
    patterns: [
      {
        regex: `${GARDEN_PREFIX}scene(/|$)`,
        message: `ink/ と scene/ は互いを import しない (${TOP_GARDEN_README})`,
      },
    ],
  },
  {
    name: "scene",
    patterns: [
      {
        regex: `${GARDEN_PREFIX}ink(/|$)`,
        message: `ink/ と scene/ は互いを import しない (${TOP_GARDEN_README})`,
      },
      {
        regex: `${GARDEN_PREFIX}stage(/|$)`,
        allowTypeImports: true,
        message: `scene/ から stage/ へは型だけを import する (${TOP_GARDEN_README})`,
      },
    ],
  },
  {
    name: "stage",
    patterns: [
      {
        // 先読みが無いので、接尾辞の無い import と、?worker&url 以外の接尾辞を止める
        regex: `${GARDEN_PREFIX}scene(/[^?]*)?$|${GARDEN_PREFIX}scene(/.*)?\\?(?:$|[^w]|w(?:$|[^o])|wo(?:$|[^r])|wor(?:$|[^k])|work(?:$|[^e])|worke(?:$|[^r])|worker(?:$|[^&])|worker&(?:$|[^u])|worker&u(?:$|[^r])|worker&ur(?:$|[^l])|worker&url.)`,
        message: `stage/ から scene/ へは場面のバンドルの URL (?worker&url) だけを import する (${TOP_GARDEN_README})`,
      },
    ],
  },
];

const featureSubdirs: Record<string, SubdirRestriction[]> = {
  "top-garden": topGardenSubdirs,
};

function islandFiles(dir: string): string[] {
  return ISLAND_EXT.map((ext) => `${dir}/**/*.${ext}`);
}

// overrides は同じ規則を後勝ちで上書きし、前の entry と合流しない。
// そのため entry ごとに、そのファイル群に要る禁止を全て書く (context/conventions.md)
function featureOverrides(): OxlintOverride[] {
  // 実行したディレクトリによらず、設定ファイルの隣から読む。
  // features/ が無い間は、設定の読み込みを失敗させない。ただし subdirs に載せた feature があれば、下の確認で失敗する。
  // features/ の親が無いときは、パスがずれたとみなして失敗させ、禁止が消えたまま通らないようにする
  const root = join(import.meta.dirname, FEATURES_DIR);
  if (!existsSync(dirname(root)))
    throw new Error(`${dirname(FEATURES_DIR)} が無い。FEATURES_DIR を直す`);
  const features = existsSync(root)
    ? readdirSync(root, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
    : [];
  // 名前がずれたまま禁止が消えて通らないよう、サブディレクトリの実在を確かめる
  for (const [feature, entries] of Object.entries(featureSubdirs)) {
    for (const { name } of entries) {
      if (!existsSync(join(root, feature, name)))
        throw new Error(`${FEATURES_DIR}/${feature}/${name} が無い。featureSubdirs を直す`);
    }
  }
  return features.flatMap((feature) => {
    const others = features.filter((f) => f !== feature);
    // Oxlint の regex は先読みを持たないので、自分以外の feature を 1 つずつ並べる
    const otherFeatures: Restriction[] = others.map((other) => ({
      regex: `^(~/features/|(\\.\\./)+(features/)?)${escapeRegex(other)}(/|$)`,
      message:
        "feature どうしは参照しない。2 つ以上の feature が使うものは components/ へ移す (context/codebase.md 規約 5)",
    }));
    const dir = `${FEATURES_DIR}/${feature}`;
    const base = [...noPagesLayouts, ...otherFeatures];
    const island = [...noAstroFileInIsland, ...base];
    const dirOverrides: OxlintOverride[] = [
      {
        files: [`${dir}/**`],
        rules: restrict(noAstroContent, base),
      },
      {
        files: islandFiles(dir),
        rules: restrict([...noAstroContent, ...noAstroInIsland], island),
      },
    ];
    // サブディレクトリの override は、同じ規則を置き換えるので、親の禁止も全て書く
    const subOverrides = (featureSubdirs[feature] ?? []).flatMap(({ name, patterns }) => [
      {
        files: [`${dir}/${name}/**`],
        rules: restrict(noAstroContent, [...base, ...patterns]),
      },
      {
        files: islandFiles(`${dir}/${name}`),
        rules: restrict([...noAstroContent, ...noAstroInIsland], [...island, ...patterns]),
      },
    ]);
    return [...dirOverrides, ...subOverrides];
  });
}

const noFeaturesFromComponents: Restriction[] = [
  {
    group: ["**/features/**", "~/features/**"],
    message:
      "components はセクションをまたぐ素の部品。features を参照しない (context/codebase.md 規約 5)",
  },
];

const noPackagesToApps: Restriction[] = [
  {
    group: ["**/apps/**", "@fukuemon/web*", "@fukuemon/playground", "@fukuemon/playground/**"],
    message: "packages から apps への逆依存は禁止 (context/codebase.md 規約 4)",
  },
];

// jsx-a11y の規則は、既定では警告で、lint を失敗させない。全てエラーにする (context/conventions.md の Check Exclusions)
const JSX_A11Y_RULES = [
  "jsx-a11y/alt-text",
  "jsx-a11y/anchor-ambiguous-text",
  "jsx-a11y/anchor-has-content",
  "jsx-a11y/anchor-is-valid",
  "jsx-a11y/aria-activedescendant-has-tabindex",
  "jsx-a11y/aria-props",
  "jsx-a11y/aria-proptypes",
  "jsx-a11y/aria-role",
  "jsx-a11y/aria-unsupported-elements",
  "jsx-a11y/autocomplete-valid",
  "jsx-a11y/click-events-have-key-events",
  "jsx-a11y/control-has-associated-label",
  "jsx-a11y/heading-has-content",
  "jsx-a11y/html-has-lang",
  "jsx-a11y/iframe-has-title",
  "jsx-a11y/img-redundant-alt",
  "jsx-a11y/interactive-supports-focus",
  "jsx-a11y/label-has-associated-control",
  "jsx-a11y/lang",
  "jsx-a11y/media-has-caption",
  "jsx-a11y/mouse-events-have-key-events",
  "jsx-a11y/no-access-key",
  "jsx-a11y/no-aria-hidden-on-focusable",
  "jsx-a11y/no-autofocus",
  "jsx-a11y/no-distracting-elements",
  "jsx-a11y/no-interactive-element-to-noninteractive-role",
  "jsx-a11y/no-noninteractive-element-interactions",
  "jsx-a11y/no-noninteractive-element-to-interactive-role",
  "jsx-a11y/no-redundant-roles",
  "jsx-a11y/no-static-element-interactions",
  "jsx-a11y/prefer-tag-over-role",
  "jsx-a11y/role-has-required-aria-props",
  "jsx-a11y/role-supports-aria-props",
  "jsx-a11y/scope",
  "jsx-a11y/tabindex-no-positive",
];

export default defineConfig({
  plugins: ["eslint", "typescript", "unicorn", "oxc", "react", "jsx-a11y", "import"],
  ignorePatterns: [
    "docs/design/prototypes/**/vendor/",
    "packages/go-runtime/src/worker/vendor/wasm_exec.js",
  ],
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
    "no-restricted-imports": ["error", { paths: noWebcontainer }],
    ...Object.fromEntries(JSX_A11Y_RULES.map((rule) => [rule, "error"])),
    // 横に送る領域と縦に送る領域は、キーボードで送れるよう tabIndex={0} を付ける (WCAG 2.1.1)。role="region" か role="log" を書いた要素だけを許す。section の region は行ごとに抑制する
    "jsx-a11y/no-noninteractive-tabindex": ["error", { roles: ["tabpanel", "region", "log"] }],
  },
  overrides: [
    {
      files: ["apps/web/src/pages/**"],
      rules: restrict(noAstroContent, []),
    },
    {
      files: ["apps/web/src/layouts/**"],
      rules: restrict(noAstroContent, [
        {
          group: ["**/pages/**", "~/pages/**"],
          message: "layouts は pages を参照しない (context/codebase.md 規約 5)",
        },
      ]),
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
    // feature のディレクトリの外にある features/ の直下のファイルにも、規約 1、3、5 を当てる
    {
      files: [`${FEATURES_DIR}/**`],
      rules: restrict(noAstroContent, noPagesLayouts),
    },
    {
      files: islandFiles(FEATURES_DIR),
      rules: restrict(
        [...noAstroContent, ...noAstroInIsland],
        [...noAstroFileInIsland, ...noPagesLayouts],
      ),
    },
    ...featureOverrides(),
    ...playgroundToolOverrides(),
    {
      files: ["packages/**"],
      rules: restrict([], noPackagesToApps),
    },
    {
      files: ["packages/node-runtime/src/webcontainer/**"],
      rules: { "no-restricted-imports": ["error", { patterns: noPackagesToApps }] },
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
