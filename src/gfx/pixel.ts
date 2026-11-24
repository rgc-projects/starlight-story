// 像素绘制基础工具：画布创建、像素级图元、自动描边、翻转、剪影
export type Canvas = HTMLCanvasElement;
export type Ctx = CanvasRenderingContext2D;

export function makeCanvas(w: number, h: number): [Canvas, Ctx] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  const x = c.getContext('2d')!;
  x.imageSmoothingEnabled = false;
  return [c, x];
}

/** 像素画笔：所有图元都对齐整像素，保证锐利的像素风 */
export class P {
  constructor(public g: Ctx) {}
  px(x: number, y: number, c: string) {
    this.g.fillStyle = c;
    this.g.fillRect(Math.round(x), Math.round(y), 1, 1);
  }
  rect(x: number, y: number, w: number, h: number, c: string) {
    if (w <= 0 || h <= 0) return;
    this.g.fillStyle = c;
    this.g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  /** Bresenham 直线，可设置粗细 */
  line(x0: number, y0: number, x1: number, y1: number, c: string, t = 1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    this.g.fillStyle = c;
    const o = Math.floor((t - 1) / 2);
    for (let i = 0; i < 400; i++) {
      this.g.fillRect(x0 - o, y0 - o, t, t);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  /** 按角度从某点画线，返回终点 */
  ray(x: number, y: number, ang: number, len: number, c: string, t = 1) {
    const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len;
    this.line(x, y, ex, ey, c, t);
    return { x: Math.round(ex), y: Math.round(ey) };
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, c: string) {
    this.g.fillStyle = c;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.g.fillRect(x, y, 1, 1);
      }
    }
  }
  /** 带明暗的椭圆：左上高光、右下阴影 */
  ellipseShaded(cx: number, cy: number, rx: number, ry: number, base: string, shade: string, light: string) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        const d = dx * dx + dy * dy;
        if (d > 1) continue;
        let col = base;
        if (dy > 0.45 || dx + dy > 0.9) col = shade;
        const lx = dx + 0.35, ly = dy + 0.45;
        if (lx * lx + ly * ly < 0.09) col = light;
        this.g.fillStyle = col;
        this.g.fillRect(x, y, 1, 1);
      }
    }
  }
  circle(cx: number, cy: number, r: number, c: string) {
    this.ellipse(cx, cy, r, r, c);
  }
  /** 填充凸多边形（扫描线），点为整数坐标 */
  poly(pts: [number, number][], c: string) {
    let minY = Infinity, maxY = -Infinity;
    for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
    this.g.fillStyle = c;
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        if ((a[1] <= y + 0.5 && b[1] > y + 0.5) || (b[1] <= y + 0.5 && a[1] > y + 0.5)) {
          xs.push(a[0] + ((y + 0.5 - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
        }
      }
      xs.sort((m, n) => m - n);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const x0 = Math.round(xs[i]), x1 = Math.round(xs[i + 1]);
        if (x1 > x0) this.g.fillRect(x0, y, x1 - x0, 1);
      }
    }
  }
}

/** 自动给不透明像素外圈加 1px 描边（经典像素风轮廓） */
export function outline(c: Canvas, color = '#22142e', inner = false) {
  const g = c.getContext('2d')!;
  const w = c.width, h = c.height;
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  const src = new Uint8ClampedArray(d);
  const rgb = hexToRgb(color);
  const A = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : src[(y * w + x) * 4 + 3]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (src[i + 3] > 100) continue;
      if (A(x - 1, y) > 100 || A(x + 1, y) > 100 || A(x, y - 1) > 100 || A(x, y + 1) > 100) {
        d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = 255;
      }
    }
  }
  if (inner) {
    // 可选：内描边（略暗化边缘）
  }
  g.putImageData(img, 0, 0);
  return c;
}

export function flipH(c: Canvas): Canvas {
  const [f, g] = makeCanvas(c.width, c.height);
  g.translate(c.width, 0);
  g.scale(-1, 1);
  g.drawImage(c, 0, 0);
  return f;
}

const silCache = new WeakMap<Canvas, Map<string, Canvas>>();
/** 生成纯色剪影（受击闪白、残影着色用），带缓存 */
export function silhouette(c: Canvas, color = '#ffffff'): Canvas {
  let m = silCache.get(c);
  if (!m) { m = new Map(); silCache.set(c, m); }
  let s = m.get(color);
  if (!s) {
    const [n, g] = makeCanvas(c.width, c.height);
    g.drawImage(c, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    s = n;
    m.set(color, s);
  }
  return s;
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((ch) => ch + ch).join('') : h;
  const n = parseInt(v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function shade(hex: string, amt: number) {
  const [r, g, b] = hexToRgb(hex);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
  return `#${[f(r), f(g), f(b)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

export function rgba(hex: string, a: number) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/** 带左右翻转版本的精灵帧 */
export interface Frame {
  r: Canvas; // 朝右
  l: Canvas; // 朝左
}
export function mkFrame(c: Canvas, doOutline = true, outlineColor?: string): Frame {
  if (doOutline) outline(c, outlineColor);
  return { r: c, l: flipH(c) };
}
