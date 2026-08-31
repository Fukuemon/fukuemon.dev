import type { Root, Code, Paragraph, Text, RootContent } from "mdast";
import type { Step } from "@fukuemon/content-model";

const DURATION = /^Duration:\s*(\d{1,2}):(\d{2})\s*$/;

/**
 * フェンスの言語から部品を引く。engine を足すときはここへ 1 行足す。
 * 相対パスはサブディレクトリのコンテンツで解決できないので `~/` を使う。
 */
type Runner = { name: string; path: string; engine: string; kind: string };

const RUNNERS: Record<string, Runner> = {
  sql: {
    name: "SqlRunner",
    path: "~/features/lab/panel/SqlRunner",
    engine: "Postgres",
    kind: "pglite",
  },
};

/** frontmatter の runtime から表示名を引く。フェンスの言語より優先する */
const ENGINE: Record<string, string> = {
  pglite: "Postgres",
  sqlite: "SQLite",
  duckdb: "DuckDB",
  pyodide: "Python",
};

const runnerFor = (lang: string | null | undefined): Runner | undefined =>
  lang ? RUNNERS[lang] : undefined;

type JsxAttr = {
  type: "mdxJsxAttribute";
  name: string;
  value: string | { type: "mdxJsxAttributeValueExpression"; value: string; data?: unknown } | null;
};

const attr = (name: string, value: string): JsxAttr => ({ type: "mdxJsxAttribute", name, value });
/** mdx は attribute の式に estree を要求する */
const expr = (name: string, literalValue: string | number): JsxAttr => {
  const raw = typeof literalValue === "string" ? literal(literalValue) : String(literalValue);
  return {
    type: "mdxJsxAttribute",
    name,
    value: {
      type: "mdxJsxAttributeValueExpression",
      value: raw,
      data: {
        estree: {
          type: "Program",
          sourceType: "module",
          comments: [],
          body: [
            {
              type: "ExpressionStatement",
              expression: { type: "Literal", value: literalValue, raw },
            },
          ],
        },
      },
    },
  };
};

const literal = (s: string) => JSON.stringify(s);

/** 配列や object を属性として渡す。estree は JSON をそのまま式にする */
const json = (name: string, value: unknown): JsxAttr => {
  const raw = JSON.stringify(value);
  return {
    type: "mdxJsxAttribute",
    name,
    value: {
      type: "mdxJsxAttributeValueExpression",
      value: raw,
      data: {
        estree: {
          type: "Program",
          sourceType: "module",
          comments: [],
          body: [
            {
              type: "ExpressionStatement",
              expression: jsonToEstree(value),
            },
          ],
        },
      },
    },
  };
};

function jsonToEstree(v: unknown): Record<string, unknown> {
  if (Array.isArray(v)) {
    return { type: "ArrayExpression", elements: v.map(jsonToEstree) };
  }
  if (v !== null && typeof v === "object") {
    return {
      type: "ObjectExpression",
      properties: Object.entries(v).map(([k, x]) => ({
        type: "Property",
        kind: "init",
        method: false,
        shorthand: false,
        computed: false,
        key: { type: "Literal", value: k, raw: JSON.stringify(k) },
        value: jsonToEstree(x),
      })),
    };
  }
  return { type: "Literal", value: v, raw: JSON.stringify(v) };
}

/**
 * ```` ```sql run ```` のフェンスを実行パネルの JSX に差し替える。
 * 手順の番号・題・総数は h2 から数え、frontmatter にも JSX にも書かせない。
 */
export function remarkLab() {
  return (
    tree: Root,
    file: {
      path?: string;
      data?: { astro?: { frontmatter?: Record<string, unknown> } };
    },
  ) => {
    const isLab = (file.path ?? "").includes("/content/labs/");
    const isMdx = (file.path ?? "").endsWith(".mdx");
    const fm = file.data?.astro?.frontmatter ?? {};
    const setup = typeof fm.setup === "string" ? fm.setup : undefined;
    const contentId = typeof fm.contentId === "string" ? fm.contentId : "";
    const runtime =
      typeof fm.interactive === "object" && fm.interactive !== null
        ? (fm.interactive as { runtime?: string }).runtime
        : undefined;
    const declared = ENGINE[runtime ?? ""];

    const labSteps: Step[] = [];
    for (const node of tree.children) {
      if (node.type === "heading" && node.depth === 2) {
        labSteps.push({ index: labSteps.length, title: plain(node) });
      }
    }
    const stepCount = labSteps.length;

    let stepIndex = -1;
    let stepTitle = "";
    let hasIntro = false;
    const out: RootContent[] = [];
    const runners: { node: Code; stepIndex: number; stepTitle: string }[] = [];
    const steps: { step: number; sql: string }[] = [];

    for (const node of tree.children) {
      if (node.type === "heading" && node.depth === 2) {
        stepIndex++;
        stepTitle = plain(node);
        out.push(node);
        continue;
      }

      const secs = durationOf(node);
      if (secs !== undefined) {
        const step = labSteps[stepIndex];
        if (step && step.duration === undefined) step.duration = secs;
        continue;
      }

      if (stepIndex < 0 && !isBlank(node)) hasIntro = true;

      if (!isMdx && node.type === "code" && isRunnable(node)) {
        throw new Error(
          `${file.path ?? "(不明)"}: \`\`\`sql run は .mdx でだけ使えます。` +
            "拡張子を .mdx に変えるか、run を外してください。",
        );
      }

      if (isMdx && node.type === "code" && isRunnable(node)) {
        runners.push({ node, stepIndex, stepTitle });
        out.push(node); // 後で差し替える
        if (stepIndex >= 0) steps.push({ step: stepIndex, sql: node.value });
        continue;
      }

      out.push(node);
    }

    for (const r of runners) {
      const i = out.indexOf(r.node);
      if (i < 0) continue;
      const runner = runnerFor(r.node.lang);
      if (!runner) continue;
      out[i] = runnerNode(r.node, {
        contentId,
        stepIndex: r.stepIndex,
        stepCount,
        stepTitle: r.stepTitle,
        setup,
        engine: declared ?? runner.engine,
        kind: runtime ?? runner.kind,
        runner,
        steps,
      });
    }

    const used = [
      ...new Set(runners.map((r) => runnerFor(r.node.lang)).filter(Boolean)),
    ] as Runner[];
    for (const r of used) {
      out.unshift({
        type: "mdxjsEsm",
        value: `import ${r.name} from ${literal(r.path)};`,
        data: { estree: importAst(r) },
      } as unknown as RootContent);
    }

    tree.children = out;

    if (isLab && file.data?.astro?.frontmatter) {
      file.data.astro.frontmatter.labSteps = labSteps;
      file.data.astro.frontmatter.labHasIntro = hasIntro;
    }
  };
}

/** `Duration: MM:SS` の段落なら秒を返す。違えば undefined */
function durationOf(node: RootContent): number | undefined {
  if (node.type !== "paragraph") return undefined;
  const p = node as Paragraph;
  if (p.children.length !== 1) return undefined;
  const only = p.children[0];
  if (only?.type !== "text") return undefined;
  const m = DURATION.exec((only as Text).value.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : undefined;
}

/** 空白だけのノードか。前置きの有無を数えるときに除く */
function isBlank(node: RootContent): boolean {
  return node.type === "text" && !node.value.trim();
}

/** `run` が付いていて、対応する部品がある言語だけを実行パネルにする */
function isRunnable(node: Code): boolean {
  if (!runnerFor(node.lang)) return false;
  return (node.meta ?? "").split(/\s+/).includes("run");
}

function plain(node: { children?: unknown[] }): string {
  const parts: string[] = [];
  const walk = (n: unknown) => {
    const x = n as { type?: string; value?: string; children?: unknown[] };
    if (x.type === "text" || x.type === "inlineCode") parts.push(x.value ?? "");
    x.children?.forEach(walk);
  };
  node.children?.forEach(walk);
  return parts.join("");
}

function runnerNode(
  node: Code,
  ctx: {
    contentId: string;
    stepIndex: number;
    stepCount: number;
    stepTitle: string;
    setup?: string;
    engine: string;
    kind: string;
    runner: Runner;
    steps: { step: number; sql: string }[];
  },
): RootContent {
  const inStep = ctx.stepIndex >= 0;
  const attributes: JsxAttr[] = [
    { type: "mdxJsxAttribute", name: "client:visible", value: null },
    attr("contentId", ctx.contentId),
    expr("stepIndex", ctx.stepIndex),
    expr("stepCount", ctx.stepCount),
    attr("stepTitle", inStep ? ctx.stepTitle : "前置き"),
    expr("sql", node.value),
  ];
  attributes.push(attr("engine", ctx.engine));
  if (ctx.kind) attributes.push(attr("kind", ctx.kind));
  if (ctx.steps.length > 0) attributes.push(json("steps", ctx.steps));
  if (ctx.setup) attributes.push(expr("setup", ctx.setup));

  return {
    type: "mdxJsxFlowElement",
    name: ctx.runner.name,
    attributes,
    children: [],
  } as unknown as RootContent;
}

/** import 1 本ぶんの estree を手で組む */
function importAst(r: Runner) {
  return {
    type: "Program",
    sourceType: "module",
    comments: [],
    body: [
      {
        type: "ImportDeclaration",
        specifiers: [
          {
            type: "ImportDefaultSpecifier",
            local: { type: "Identifier", name: r.name },
          },
        ],
        source: { type: "Literal", value: r.path, raw: literal(r.path) },
        attributes: [],
      },
    ],
  };
}
