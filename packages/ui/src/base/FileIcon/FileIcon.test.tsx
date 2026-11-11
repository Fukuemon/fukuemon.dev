import { render } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";

import { FileIcon, fileKindOf } from "./FileIcon";

describe("fileKindOf", () => {
  it("拡張子から系統を決め、大文字と拡張子なしも扱う", () => {
    expect(fileKindOf("main.ts")).toBe("code");
    expect(fileKindOf("README.MD")).toBe("document");
    expect(fileKindOf("package.json")).toBe("data");
    expect(fileKindOf("LICENSE")).toBe("other");
    expect(fileKindOf(".env")).toBe("data");
    expect(fileKindOf("archive.tar.gz")).toBe("other");
  });
});

describe("FileIcon", () => {
  it("ディレクトリは開閉で形を替え、読み上げから外す", () => {
    const { container, rerender } = render(<FileIcon kind="directory" />);
    const svg = () => container.querySelector("svg");
    expect(svg()).toHaveAttribute("aria-hidden", "true");
    const closed = svg()?.innerHTML;
    expect(svg()).toHaveAttribute("data-icon", "directory");
    rerender(<FileIcon isOpen kind="directory" />);
    expect(svg()).toHaveAttribute("data-icon", "directory-open");
    expect(svg()?.innerHTML).not.toBe(closed);
  });

  it("系統ごとに線の形を替える", () => {
    const shapes = ["main.ts", "README.md", "package.json", "LICENSE"].map((name) => {
      const { container } = render(<FileIcon kind="file" name={name} />);
      return container.innerHTML;
    });
    expect(new Set(shapes).size).toBe(4);
  });
});
