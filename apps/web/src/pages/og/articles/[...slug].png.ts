import type { APIRoute, GetStaticPaths } from "astro";
import { ogImageResponse } from "../../../features/og-image/render";
import { getArticlePaths, type ArticlePageProps } from "../../../lib/content/articles";

export const getStaticPaths = (() => getArticlePaths()) satisfies GetStaticPaths;

export const GET: APIRoute<ArticlePageProps> = ({ props }) => ogImageResponse(props.title);
