import { z } from "zod";

const SEGMENT = "[a-z0-9][a-z0-9-]*";

/** 埋め込みの名前（記事の中で埋め込みを区別する名前）。記事の contentId と同じ形にする */
export const embedNameSchema = z.string().regex(new RegExp(`^${SEGMENT}$`));

/** 埋め込みの ID（`<contentId>/<埋め込みの名前>`）。`..` や `?` で、JSON の置き場の外を指せないようにする */
export const embedIdSchema = z.string().regex(new RegExp(`^${SEGMENT}/${SEGMENT}$`));

export const isEmbedName = (value: string) => embedNameSchema.safeParse(value).success;

export const isEmbedId = (value: string) => embedIdSchema.safeParse(value).success;

const startCommandSchema = z.object({
  command: z.string().min(1),
  args: z.array(z.string()),
  name: z.string().min(1),
});

const UNSAFE_SEGMENTS = new Set(["", ".", "..", "__proto__"]);

/** 作業ディレクトリからの相対のパスとして書けるキーか。作業ディレクトリの外と、オブジェクトの prototype を指せないようにする。 */
const isSafeFilePath = (path: string) =>
  !/[\\\0]/.test(path) && path.split("/").every((segment) => !UNSAFE_SEGMENTS.has(segment));

// z.record は __proto__ のキーを検証の前に落とすので、生の入力のキーで確かめる
const filesSchema = z
  .unknown()
  .refine(
    (files) =>
      typeof files !== "object" || files === null || Object.keys(files).every(isSafeFilePath),
    "files のキーは、空、.、..、__proto__ の区切りと、\\ と NUL を含まないパスにする",
  )
  .pipe(z.record(z.string(), z.string()));

const common = {
  version: z.string().min(1),
  files: filesSchema,
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
