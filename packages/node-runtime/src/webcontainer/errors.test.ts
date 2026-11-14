import { describe, expect, it } from "vitest";

import { PathNotFoundError } from "../backend";
import { toBackendError } from "./errors";

describe("toBackendError", () => {
  it("message が ENOENT: で始まる失敗は、元の失敗を cause に持つ PathNotFoundError にする", () => {
    const error = new Error("ENOENT: no such file or directory, open '/home/project/a'");
    const converted = toBackendError(error);
    expect(converted).toBeInstanceOf(PathNotFoundError);
    expect(converted).toMatchObject({ message: error.message, cause: error });
  });

  it("ほかの失敗は、同じ値のまま返す", () => {
    const error = new Error("EIO: i/o error");
    expect(toBackendError(error)).toBe(error);
  });

  it("Error でない値は、同じ値のまま返す", () => {
    expect(toBackendError("ENOENT: a")).toBe("ENOENT: a");
  });
});
