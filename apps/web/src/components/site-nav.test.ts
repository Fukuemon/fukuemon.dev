import { describe, expect, it } from "vitest";
import { currentNavHref } from "./site-nav";

describe("currentNavHref", () => {
  it.each([
    ["/articles", "/articles"],
    ["/articles/", "/articles"],
    ["/articles/oauth/pkce", "/articles"],
    ["/playground", "/playground"],
    ["/playground/", "/playground"],
  ])("%s は %s の項目に属する", (pathname, href) => {
    expect(currentNavHref(pathname)).toBe(href);
  });

  it.each(["/", "/404", "/series/oauth", "/articlesx", "/ink/"])(
    "%s はどの項目にも属さない",
    (pathname) => {
      expect(currentNavHref(pathname)).toBeUndefined();
    },
  );
});
