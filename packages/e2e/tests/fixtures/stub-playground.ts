import type { Page } from "@playwright/test";

/** play.fukuemon.dev への通信に空のページを返す。E2E は手元で流すので、配信した先のツールの画面には行かない */
export const stubPlayground = (page: Page) =>
  page.route("https://play.fukuemon.dev/**", (route) =>
    route.fulfill({ contentType: "text/html", body: "<!doctype html><title>stub</title>" }),
  );
