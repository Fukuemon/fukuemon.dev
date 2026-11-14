// 場面を描いた絵に全画面のパスを 1 枚かけ、墨の輪郭線、淡彩、紙の質感、端の余白を重ねる。
import {
  Color,
  type FramebufferTexture,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
} from "three";

const vertexShader =
  "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";

// uTint が 0 のときは墨だけの絵、1 のときは淡彩の絵になる。0 から 1 へ動かすのは、最初の訪問のイントロである。
const fragmentShader = `
uniform sampler2D tScene; uniform vec2 uPx; uniform float uAspect, uTint, uSky, uVig; uniform vec3 uPaper, uInkCol, uLine, uEdge;
varying vec2 vUv;
float L(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { return n(p) * 0.5 + n(p * 2.03) * 0.3 + n(p * 4.1) * 0.2; }
float S(vec2 o) { return L(texture2D(tScene, vUv + o * uPx).rgb); }
void main() {
  vec2 q = vec2(vUv.x * uAspect, vUv.y);
  vec2 wob = (vec2(fbm(q * 9.0), fbm(q * 9.0 + 5.0)) - 0.5) * uPx * 5.0;
  vec3 c = texture2D(tScene, vUv + wob).rgb;
  float e = length(vec2(S(vec2(1.6, 0)) - S(vec2(-1.6, 0)), S(vec2(0, 1.6)) - S(vec2(0, -1.6))));
  float dry = 0.55 + 0.45 * n(q * vec2(50.0, 300.0));
  float line = smoothstep(0.05, 0.17, e) * dry;
  float wash = smoothstep(0.04, 0.7, abs(L(c) - uSky) / max(uSky, 1.0 - uSky));
  wash = mix(wash, floor(wash * 3.0 + 0.5) / 3.0, 0.6);
  vec3 inkImg = mix(uPaper, uInkCol, clamp(max(line * 0.8, wash * 0.8 * (0.8 + 0.2 * fbm(q * 30.0))), 0.0, 1.0));
  float pool = fbm(q * 5.0 + 3.0);
  vec3 col = mix(mix(c, vec3(L(c)), 0.22), uPaper, 0.16 + 0.18 * pool);
  col = mix(col, uLine, line * 0.62);
  col *= 1.0 - 0.07 * (fbm(q * 120.0) - 0.5);
  float edge = smoothstep(0.5, 1.0, length((vUv - vec2(0.5, 0.52)) * vec2(1.2, 1.55)) + (fbm(q * 2.6) - 0.5) * 0.4);
  col = mix(col, uEdge, edge * uVig);
  float o2 = fbm(q * 3.0 + 7.0) * 0.7 + 0.3 * distance(vUv, vec2(0.5, 0.5));
  gl_FragColor = vec4(mix(inkImg, col, smoothstep(o2, o2 + 0.3, uTint * 2.2)), 1.0);
}`;

export interface InkPassColors {
  /** テーマの紙の色（`--fd-color-surface`） */
  readonly paper: string;
  /** テーマの墨の色（`--fd-color-text`） */
  readonly ink: string;
  /** 端の余白の色 */
  readonly edge: string;
  /** 場面の空の地平の近くの色。淡彩の濃さを、空との明るさの差で決める */
  readonly sky: string;
}

export interface InkPass {
  readonly scene: Scene;
  readonly camera: OrthographicCamera;
  /** 場面を描いた絵を受け取るテクスチャと、画面の大きさを渡す */
  setTarget(texture: FramebufferTexture, pixelRatio: number, w: number, h: number): void;
  /** 紙、墨、端の余白、空の色を替える。次に描くときから使う */
  setColors(colors: InkPassColors): void;
  /** 淡彩の濃さ（0〜1）を替える。0 は墨だけの絵、1 は淡彩の絵。次に描くときから使う */
  setTint(tint: number): void;
}

const srgb = (c: string) => new Color(c).convertLinearToSRGB(); // design-system-allow: three の Color のコンストラクタで、色の値ではない
const luminance = (c: Color) => c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722;

const colorUniforms = (colors: InkPassColors) => ({
  uPaper: srgb(colors.paper),
  uInkCol: srgb(colors.ink),
  // 輪郭線は暗い色で引く。ダークのテーマは墨が明るいので、紙の色で引く。
  uLine: srgb(luminance(srgb(colors.ink)) < 0.5 ? colors.ink : colors.paper),
  uEdge: srgb(colors.edge),
  uSky: luminance(srgb(colors.sky)),
});

/** 全画面のパスを作る。淡彩の絵（uTint が 1）を出す */
export function createInkPass(colors: InkPassColors): InkPass {
  const C = colorUniforms(colors);
  const U = {
    tScene: { value: null as FramebufferTexture | null },
    uPx: { value: new Vector2() },
    uAspect: { value: 1 },
    uTint: { value: 1 },
    uVig: { value: 0.8 },
    uPaper: { value: C.uPaper },
    uInkCol: { value: C.uInkCol },
    uLine: { value: C.uLine },
    uEdge: { value: C.uEdge },
    uSky: { value: C.uSky },
  };
  const mesh = new Mesh(
    new PlaneGeometry(2, 2),
    new ShaderMaterial({
      uniforms: U,
      depthTest: false,
      depthWrite: false,
      vertexShader,
      fragmentShader,
    }),
  );
  mesh.frustumCulled = false;
  const scene = new Scene();
  scene.add(mesh);
  return {
    scene,
    camera: new OrthographicCamera(-1, 1, 1, -1, 0, 1),
    setTarget(texture, pixelRatio, w, h) {
      U.tScene.value?.dispose();
      U.tScene.value = texture;
      U.uPx.value.set(pixelRatio / texture.image.width, pixelRatio / texture.image.height);
      U.uAspect.value = w / h;
    },
    setColors(next) {
      const c = colorUniforms(next);
      U.uPaper.value = c.uPaper;
      U.uInkCol.value = c.uInkCol;
      U.uLine.value = c.uLine;
      U.uEdge.value = c.uEdge;
      U.uSky.value = c.uSky;
    },
    setTint(tint) {
      U.uTint.value = tint;
    },
  };
}
