import type { APIRoute } from "astro";
import type { PlaygroundProject } from "@fukuemon/playground-project";
import { getPlaygroundProjectPaths } from "../../../lib/content/articles";

export const getStaticPaths = getPlaygroundProjectPaths;

export const GET: APIRoute<{ project: PlaygroundProject }> = ({ props }) =>
  Response.json(props.project);
