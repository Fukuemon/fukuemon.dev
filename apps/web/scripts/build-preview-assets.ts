import { join } from "node:path";
import { buildPreviewAssets } from "./preview-assets.ts";

const app = join(import.meta.dirname, "..");
buildPreviewAssets(join(app, "dist"), join(app, "dist-preview"));
