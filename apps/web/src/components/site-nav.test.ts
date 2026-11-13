import { describe, expect, it } from "vitest";
import { ariaCurrent } from "./site-nav";

describe("ariaCurrent", () => {
  it.each([
    ["/articles", "/articles", "page"],
    ["/articles/", "/articles", "page"],
    ["/articles/oauth/pkce", "/articles", "true"],
    ["/playground", "/playground", "page"],
    ["/", "/", "page"],
  ])("%s で %s のリンクは %s", (pathname, href, expected) => {
    expect(ariaCurrent(pathname, href)).toBe(expected);
  });

  it.each([
    ["/", "/articles"],
    ["/series/oauth", "/articles"],
    ["/articlesx", "/articles"],
    ["/articles", "/"],
    ["/404", "/"],
  ])("%s で %s のリンクには付けない", (pathname, href) => {
    expect(ariaCurrent(pathname, href)).toBeUndefined();
  });
});
