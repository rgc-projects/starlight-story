// 5x7 程序化像素位图字体（伤害数字、LEVEL UP 等特效字）
import { makeCanvas, Canvas, Ctx } from './pixel';

const G: Record<string, string[]> = {
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  '%': ['##..#', '##..#', '...#.', '..#..', '.#...', '#..##', '#..##'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
};

export interface FontStyle {
  top: string; // 字形上半渐变色
  bottom: string; // 字形下半渐变色
  outline: string;
  shadow?: string;
}

export const FS: Record<string, FontStyle> = {
  dmg: { top: '#fff4c2', bottom: '#ff9a2e', outline: '#4a1c06' },
  crit: { top: '#fff36b', bottom: '#ff2e2e', outline: '#3a0610', shadow: '#ffd23a' },
  player: { top: '#ffd0f0', bottom: '#b03aff', outline: '#24062e' },
  heal: { top: '#d8ffd0', bottom: '#2ecc4a', outline: '#063a10' },
  mp: { top: '#d0f0ff', bottom: '#2e8aff', outline: '#061a3a' },
  exp: { top: '#fffbe0', bottom: '#ffd84a', outline: '#3a2a06' },
  gold: { top: '#fff7a8', bottom: '#ffb000', outline: '#4a2a00', shadow: '#fff0a0' },
  white: { top: '#ffffff', bottom: '#cfd8ff', outline: '#1a1030' },
  miss: { top: '#e0e0ff', bottom: '#8a8ab0', outline: '#20203a' },
  red: { top: '#ffb0b0', bottom: '#ff3030', outline: '#300808' },
};

const glyphCache = new Map<string, Canvas>();

function glyph(ch: string, st: FontStyle, key: string): Canvas {
  const k = key + ch;
  let c = glyphCache.get(k);
  if (c) return c;
  const rows = G[ch] ?? G[' '];
  const [cv, g] = makeCanvas(7, 10);
  // 阴影
  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 5; x++) {
      if (rows[y][x] !== '#') continue;
      g.fillStyle = y < 3 ? st.top : y < 5 ? mix(st.top, st.bottom) : st.bottom;
      g.fillRect(x + 1, y + 1, 1, 1);
    }
  }
  // 描边（含右下加厚，营造立体感）
  const img = g.getImageData(0, 0, 7, 10);
  const d = img.data;
  const src = new Uint8ClampedArray(d);
  const A = (x: number, y: number) => (x < 0 || y < 0 || x >= 7 || y >= 10 ? 0 : src[(y * 7 + x) * 4 + 3]);
  const oc = hex(st.outline);
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 7; x++) {
      const i = (y * 7 + x) * 4;
      if (src[i + 3]) continue;
      if (A(x - 1, y) || A(x + 1, y) || A(x, y - 1) || A(x, y + 1) || A(x - 1, y - 1)) {
        d[i] = oc[0]; d[i + 1] = oc[1]; d[i + 2] = oc[2]; d[i + 3] = 255;
      }
    }
  }
  g.putImageData(img, 0, 0);
  glyphCache.set(k, cv);
  return cv;
}

function hex(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a: string, b: string) {
  const x = hex(a), y = hex(b);
  return `rgb(${(x[0] + y[0]) >> 1},${(x[1] + y[1]) >> 1},${(x[2] + y[2]) >> 1})`;
}

/** 绘制位图文字。scale 为放大倍数（可为小数实现弹跳缩放），align: 0 左 0.5 中 1 右 */
export function bitmapText(g: Ctx, text: string, x: number, y: number, scale: number, style: keyof typeof FS | FontStyle, align = 0.5, spacing = -1) {
  const st = typeof style === 'string' ? FS[style] : style;
  const key = typeof style === 'string' ? style : `${st.top}${st.bottom}${st.outline}`;
  const t = text.toUpperCase();
  const adv = (6 + spacing) * scale;
  const w = t.length * adv + scale;
  let cx = x - w * align;
  const prev = g.imageSmoothingEnabled;
  g.imageSmoothingEnabled = false;
  for (const ch of t) {
    const gl = glyph(ch, st, key);
    g.drawImage(gl, Math.round(cx), Math.round(y - 5 * scale), 7 * scale, 10 * scale);
    cx += adv;
  }
  g.imageSmoothingEnabled = prev;
  return w;
}

export function bitmapWidth(text: string, scale: number, spacing = -1) {
  return text.length * (6 + spacing) * scale + scale;
}
