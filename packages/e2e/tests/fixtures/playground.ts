// プレイグラウンドの一覧に並ぶツール。apps/web/src/pages/playground/index.astro の並びと同じ順にする
export const PLAYGROUND_TOOLS = [
  { name: "Node", url: "https://play.fukuemon.dev/node/" },
  { name: "SQL", url: "https://play.fukuemon.dev/sql/" },
  { name: "Go", url: "https://play.fukuemon.dev/go/" },
] as const;
