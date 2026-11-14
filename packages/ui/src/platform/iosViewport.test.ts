import { describe, expect, it } from "vite-plus/test";

import { isAppleTouchDevice, limitIosInputZoom } from "./iosViewport";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1";
const MAC_SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const APPLE = "Apple Computer, Inc.";
const GOOGLE = "Google Inc.";

describe("isAppleTouchDevice", () => {
  it.each([
    ["iPhone の Safari を iOS とみなす", IPHONE_SAFARI, 5, APPLE, true],
    ["iPhone の Chrome を iOS とみなす", IPHONE_CHROME, 5, APPLE, true],
    ["Mac の UA を名乗る iPad の Safari を iPadOS とみなす", MAC_SAFARI, 5, APPLE, true],
    ["Mac の Safari を iOS とみなさない", MAC_SAFARI, 0, APPLE, false],
    ["Mac の UA で触る点が 1 つなら iPadOS とみなさない", MAC_SAFARI, 1, APPLE, false],
    [
      "Mac の UA を名乗る WebKit でないブラウザを iPadOS とみなさない",
      MAC_SAFARI,
      5,
      GOOGLE,
      false,
    ],
    ["Android の Chrome を iOS とみなさない", ANDROID_CHROME, 5, GOOGLE, false],
  ])("%s", (_, userAgent, maxTouchPoints, vendor, expected) => {
    expect(isAppleTouchDevice({ userAgent, maxTouchPoints, vendor })).toBe(expected);
  });
});

describe("limitIosInputZoom", () => {
  const setUp = () => {
    const doc = document.implementation.createHTMLDocument();
    const meta = doc.createElement("meta");
    meta.name = "viewport";
    meta.content = "width=device-width, initial-scale=1";
    doc.head.append(meta);
    return { doc, meta };
  };

  it("iOS では viewport の指定に maximum-scale=1 を足す", () => {
    const { doc, meta } = setUp();
    limitIosInputZoom(doc, { userAgent: IPHONE_SAFARI, maxTouchPoints: 5, vendor: APPLE });
    expect(meta.content).toBe("width=device-width, initial-scale=1, maximum-scale=1");
  });

  it("2 回呼んでも 1 回だけ足す", () => {
    const { doc, meta } = setUp();
    const device = { userAgent: IPHONE_SAFARI, maxTouchPoints: 5, vendor: APPLE };
    limitIosInputZoom(doc, device);
    limitIosInputZoom(doc, device);
    expect(meta.content).toBe("width=device-width, initial-scale=1, maximum-scale=1");
  });

  it("Android では viewport の指定を変えない", () => {
    const { doc, meta } = setUp();
    limitIosInputZoom(doc, { userAgent: ANDROID_CHROME, maxTouchPoints: 5, vendor: GOOGLE });
    expect(meta.content).toBe("width=device-width, initial-scale=1");
  });

  it("viewport の指定が無い文書では、何もせずに終わる", () => {
    const doc = document.implementation.createHTMLDocument();
    limitIosInputZoom(doc, { userAgent: IPHONE_SAFARI, maxTouchPoints: 5, vendor: APPLE });
    expect(doc.querySelector("meta")).toBeNull();
  });
});
