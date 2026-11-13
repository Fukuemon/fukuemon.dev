import { z } from "zod";

const startCommandSchema = z.object({
  command: z.string().min(1),
  args: z.array(z.string()),
  name: z.string().min(1),
});

const common = {
  version: z.string().min(1),
  files: z.record(z.string(), z.string()),
  open: z.string().min(1),
};

/**
 * `apps/web` のビルドが `/playground-projects/<埋め込みの ID>.json` に出力し、ツールのページが読むプロジェクト。
 * キーと使うツールは apps/playground/DesignDoc.md の「プロジェクト」にある。
 */
export const playgroundProjectSchema = z
  .discriminatedUnion("tool", [
    z.object({
      tool: z.literal("node"),
      ...common,
      start: z.array(startCommandSchema),
      database: z.boolean().optional(),
      initialSql: z.string().optional(),
    }),
    z.object({ tool: z.literal("sql"), ...common, initialSql: z.string().optional() }),
    z.object({ tool: z.literal("go"), ...common }),
  ])
  .refine((project) => Object.hasOwn(project.files, project.open), {
    message: "open は files のどれかのパスにする",
    path: ["open"],
  });

/** 運営者が、プロジェクトのディレクトリに置く設定のファイル。`initialSql` はファイルのパスで、ビルドが中身に置き換える。 */
export const playgroundConfigSchema = z.discriminatedUnion("tool", [
  z.object({
    tool: z.literal("node"),
    open: z.string().min(1),
    start: z.array(startCommandSchema),
    database: z.boolean().optional(),
    initialSql: z.string().optional(),
  }),
  z.object({ tool: z.literal("sql"), open: z.string().min(1), initialSql: z.string().optional() }),
  z.object({ tool: z.literal("go"), open: z.string().min(1) }),
]);

export type PlaygroundProject = z.infer<typeof playgroundProjectSchema>;
export type PlaygroundTool = PlaygroundProject["tool"];
export type PlaygroundConfig = z.infer<typeof playgroundConfigSchema>;
export type StartCommand = z.infer<typeof startCommandSchema>;
