import { join } from "node:path";
import { checkProductionDist } from "./production-dist.ts";

const app = join(import.meta.dirname, "..");
const found = checkProductionDist(join(app, "src/content/articles"), join(app, "dist"));
if (found.length > 0) {
  console.error(`本番の dist に、検証用の記事の出力がある: ${found.join(", ")}`);
  process.exit(1);
}
