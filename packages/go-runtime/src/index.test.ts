import { describe, expect, it } from "vitest";

import { DEFAULT_MODULE, moduleName, testPackages } from "./index";

describe("moduleName", () => {
  it.each([
    ["module の行", "module example.com/hello\n\ngo 1.22\n", "example.com/hello"],
    ["引用符と行末のコメント", 'module "example.com/q" // 名前\n', "example.com/q"],
    ["module の行が無い", "go 1.22\n", DEFAULT_MODULE],
  ])("%s", (_, goMod, expected) => {
    expect(moduleName({ "go.mod": goMod })).toBe(expected);
  });

  it("go.mod が無いときは play にする", () => {
    expect(moduleName({ "main.go": "package main" })).toBe("play");
  });
});

describe("testPackages", () => {
  it("テストのファイルを持つディレクトリだけを、名前の順で返す", () => {
    const files = {
      "main.go": "",
      "main_test.go": "",
      "greet/greet.go": "",
      "greet/greet_test.go": "",
      "greet/more_test.go": "",
      "internal/a/a_test.go": "",
      "util/util.go": "",
    };
    expect(testPackages(files, "play")).toEqual(["play", "play/greet", "play/internal/a"]);
  });
});
