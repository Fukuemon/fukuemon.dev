import type { APIRoute } from "astro";
import { ogImageResponse } from "../../features/og-image/render";

export const GET: APIRoute = () => ogImageResponse();
