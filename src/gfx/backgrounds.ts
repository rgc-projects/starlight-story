// 多层视差滚动背景（每张地图 4+ 层 + 前景层），全部程序化生成并可无缝平铺
import { makeCanvas, P, Canvas, Ctx } from './pixel';
import { seeded } from '../core/utils';
import type { Theme } from './world';

export const VIEW_W = 640;
export const VIEW_H = 360;
const W = 640;
const H = 360;

export interface Layer { c: Canvas; factor: number; auto: number }
export interface BgSet {
  sky: string[];
  layers: Layer[];
  fg: Layer[];
  particle: 'petal' | 'firefly' | 'ember' | 'leaf';
  celestial: 'sun' | 'moon' | 'eclipse';
}

type Wave = [number, number, number]; // [周期数k, 振幅, 相位]
function ridgeY(x: number, base: number, waves: Wave[]) {
  let y = base;
  for (const [k, a, ph] of waves) y += Math.sin((x / W) * Math.PI * 2 * k + ph) * a;
  return y;
}
function fillRidge(p: P, base: number, waves: Wave[], col: string, top?: string) {
  for (let x = 0; x < W; x++) {
    const y = Math.round(ridgeY(x, base, waves));
    p.rect(x, y, 1, H - y, col);
    if (top) p.rect(x, y, 1, 2, top);
  }
}
/** 在可平铺画布上绘制（自动处理左右边界环绕） */
function wrap(x: number, w: number, fn: (x: number) => void) {
  fn(x);
  if (x - w < 0) fn(x + W);
  if (x + w > W) fn(x - W);
}

function cloudLayer(seed: number, col: string, shadeCol: string, count: number, yMin: number, yMax: number, scale = 1) {
  const [c, g] = makeCanvas(W, H);
  const p = new P(g);
  const r = seeded(seed);
  for (let i = 0; i < count; i++) {
    const cx = (i / count) * W + r() * 60;
    const cy = yMin + r() * (yMax - yMin);
    const s = (0.7 + r() * 0.8) * scale;
    wrap(cx, 70 * s, (x) => {
      p.ellipse(x, cy + 6 * s, 34 * s, 9 * s, shadeCol);
      p.ellipse(x - 18 * s, cy + 2 * s, 16 * s, 10 * s, col);
      p.ellipse(x + 2 * s, cy - 4 * s, 20 * s, 14 * s, col);
      p.ellipse(x + 22 * s, cy + 2 * s, 14 * s, 9 * s, col);
      p.rect(x - 32 * s, cy + 4 * s, 64 * s, 5 * s, col);
    });
  }
  return c;
}

function treeRow(p: P, seed: number, base: number, count: number, col: string, light: string, sizeMin: number, sizeMax: number, pointy = false) {
  const r = seeded(seed);
  for (let i = 0; i < count; i++) {
    const x = r() * W;
    const s = sizeMin + r() * (sizeMax - sizeMin);
    wrap(x, s * 1.2, (xx) => {
      if (pointy) {
        for (let y = 0; y < s * 2.2; y++) {
          const half = (y / (s * 2.2)) * s * 0.7;
          p.rect(xx - half, base - s * 2.2 + y, half * 2, 1, col);
        }
        p.rect(xx - 1, base - 2, 3, 6, col);
      } else {
        p.rect(xx - 1, base - s * 0.6, 3, s, col);
        p.ellipse(xx, base - s * 1.1, s * 0.75, s * 0.7, col);
        p.ellipse(xx - s * 0.2, base - s * 1.3, s * 0.35, s * 0.3, light);
      }
    });
  }
}

const cache = new Map<Theme, BgSet>();
export function background(theme: Theme): BgSet {
  let b = cache.get(theme);
  if (b) return b;
  b = build(theme);
  cache.set(theme, b);
  return b;
}

function build(theme: Theme): BgSet {
  const layers: Layer[] = [];
  const fg: Layer[] = [];
  if (theme === 'town' || theme === 'meadow') {
    // 第 1 层：远景云海（自动漂移）
    layers.push({ c: cloudLayer(theme === 'town' ? 11 : 17, '#ffffff', '#dceeff', 6, 30, 130, 1.1), factor: 0.03, auto: 5 });
    // 第 2 层：城堡剪影 / 雪山
    {
      const [c, g] = makeCanvas(W, H);
      const p = new P(g);
      if (theme === 'town') {
        fillRidge(p, 238, [[1, 10, 0.5], [3, 6, 1.2], [5, 3, 2]], '#b4ccf0');
        // 星辉王城
        const cx = 420, base = 228;
        const tower = (x: number, w: number, h: number) => {
          p.rect(x - w / 2, base - h, w, h + 10, '#a0b8e8');
          for (let y = 0; y < w * 1.3; y++) {
            const half = (y / (w * 1.3)) * (w / 2 + 2);
            p.rect(x - half, base - h - w * 1.3 + y, half * 2, 1, '#8aa4dc');
          }
          p.rect(x - 1, base - h + 8, 2, 3, '#fff0b0');
        };
        p.rect(cx - 50, base - 30, 100, 40, '#a0b8e8');
        for (let x = cx - 50; x < cx + 50; x += 8) p.rect(x, base - 34, 5, 4, '#a0b8e8');
        tower(cx - 50, 14, 50);
        tower(cx + 50, 14, 50);
        tower(cx - 20, 12, 64);
        tower(cx + 20, 12, 64);
        tower(cx, 18, 84);
        p.rect(cx - 1, base - 84 - 40, 1, 14, '#8aa4dc');
        p.rect(cx, base - 84 - 40, 7, 4, '#ff8a9a');
      } else {
        const waves: Wave[] = [[2, 30, 0.3], [3, 18, 1.7], [7, 6, 0.4]];
        fillRidge(p, 210, waves, '#a4b8ec');
        for (let x = 0; x < W; x++) {
          const y = ridgeY(x, 210, waves);
          if (y < 196) p.rect(x, y, 1, Math.max(2, (196 - y) * 0.7), '#f4f8ff');
        }
      }
      layers.push({ c, factor: 0.07, auto: 0 });
    }
    // 第 3 层：远山丘陵
    {
      const [c, g] = makeCanvas(W, H);
      const p = new P(g);
      fillRidge(p, 262, [[2, 12, 1], [5, 6, 0.2]], theme === 'town' ? '#8fd49a' : '#9ae08a', '#b8f0b0');
      treeRow(p, 5, 262, 18, '#6cbf78', '#8fd49a', 6, 10);
      if (theme === 'town') {
        const r = seeded(77);
        for (let i = 0; i < 8; i++) {
          const x = r() * W;
          wrap(x, 8, (xx) => {
            p.rect(xx, 252, 8, 8, '#f4e4c4');
            p.poly([[xx - 2, 253], [xx + 4, 246], [xx + 10, 253]], '#e07a6a');
          });
        }
      }
      layers.push({ c, factor: 0.18, auto: 0 });
    }
    // 第 4 层：中景森林与风车
    {
      const [c, g] = makeCanvas(W, H);
      const p = new P(g);
      fillRidge(p, 292, [[1, 8, 2], [4, 7, 0.5]], '#5cbf6a', '#7fd88a');
      treeRow(p, 9, 296, 14, '#3fa250', '#6cd078', 12, 18);
      // 远处风车
      for (const wx of [140, 470]) {
        p.rect(wx - 5, 236, 10, 52, '#e8dcc0');
        p.rect(wx - 5, 236, 3, 52, '#c8b898');
        p.poly([[wx - 7, 238], [wx, 228], [wx + 7, 238]], '#d06050');
        for (let i = 0; i < 4; i++) {
          const a = i * (Math.PI / 2) + 0.4;
          p.line(wx, 236, wx + Math.cos(a) * 24, 236 + Math.sin(a) * 24, '#f8f0e0', 3);
        }
      }
      layers.push({ c, factor: 0.38, auto: 0 });
    }
    // 第 5 层：近景灌木
    {
      const [c, g] = makeCanvas(W, H);
      const p = new P(g);
      fillRidge(p, 322, [[3, 5, 0.7], [7, 3, 1.1]], '#3f9f4f');
      const r = seeded(31);
      for (let i = 0; i < 16; i++) {
        const x = r() * W, s = 8 + r() * 10;
        wrap(x, s * 2, (xx) => {
          p.ellipseShaded(xx, 318, s * 1.4, s * 0.8, '#3fae4f', '#2f8a3f', '#7fe06a');
          if (r() < 0.5) p.px(xx, 314, theme === 'town' ? '#ff8ac0' : '#ffd447');
        });
      }
      layers.push({ c, factor: 0.6, auto: 0 });
    }
    // 前景：草丛剪影
    {
      const [c, g] = makeCanvas(W, H);
      const p = new P(g);
      const r = seeded(51);
      for (let i = 0; i < 9; i++) {
        const x = r() * W;
        wrap(x, 30, (xx) => {
          for (let k = 0; k < 9; k++) {
            const bx = xx + k * 4 - 16;
            const h = 14 + ((k * 7) % 5) * 5;
            p.line(bx, 360, bx + (k % 2 ? 3 : -3), 360 - h, '#2a7a3a', 2);
          }
          p.circle(xx + 6, 348, 2, theme === 'town' ? '#ff9ac8' : '#fff27a');
        });
      }
      fg.push({ c, factor: 1.25, auto: 0 });
    }
    return {
      sky: theme === 'town' ? ['#78c4ff', '#bfe8ff', '#fff2d8'] : ['#5cb8ff', '#a8e0ff', '#e8fbff'],
      layers, fg,
      particle: theme === 'town' ? 'petal' : 'leaf',
      celestial: 'sun',
    };
  }
  if (theme === 'forest') {
    {
      const [c, g] = makeCanvas(W, H);
      const p = new P(g);
      fillRidge(p, 250, [[2, 10, 0], [5, 5, 1]], '#0f3038');
      treeRow(p, 3, 256, 30, '#0f3038', '#0f3038', 18, 30, true);
      layers.push({ c, factor: 0.06, auto: 0 });
    }
    {
      const [c, g] = makeCanvas(W, H);
      const p = new P(g);
      fillRidge(p, 275, [[3, 8, 2]], '#154446');
      treeRow(p, 8, 280, 20, '#154446', '#1c5a58', 18, 28);
      const r = seeded(13);
      for (let i = 0; i < 40; i++) p.px(r() * W, 160 + r() * 120, r() < 0.5 ? '#7ff8e0' : '#c8ff8a');
      layers.push({ c, factor: 0.16, auto: 0 });
    }
    {
      const [c, g] = makeCanvas(W, H);
      const p = new P(g);
      fillRidge(p, 300, [[2, 6, 1], [6, 3, 0]], '#1b5450');
      const r = seeded(21);
      for (let i = 0; i < 6; i++) {
        const x = r() * W, w = 14 + r() * 10;
        wrap(x, w, (xx) => {
          p.rect(xx - w / 2, 0, w, 310, '#1b4a46');
          p.rect(xx - w / 2, 0, 4, 310, '#143a38');
          p.ellipse(xx, 40 + r() * 40, w * 3, 30, '#1f5a52');
        });
      }
      for (let i = 0; i < 4; i++) {
        const x = r() * W;
        wrap(x, 12, (xx) => {
          p.rect(xx - 7, 230, 14, 75, '#4a6a70');
          p.rect(xx - 9, 226, 18, 6, '#5a7a80');
          p.rect(xx - 1, 250, 2, 6, '#7ff8e0');
        });
      }
      layers.push({ c, factor: 0.32, auto: 0 });
    }
    {
      const [c, g] = makeCanvas(W, H);
      const p = new P(g);
      const r = seeded(41);
      for (let i = 0; i < 14; i++) {
        const x = r() * W, len = 30 + r() * 80;
        wrap(x, 4, (xx) => {
          for (let y = 0; y < len; y++) p.px(xx + Math.sin(y * 0.15) * 2, y, y % 9 === 0 ? '#3fb88a' : '#2a6a55');
          p.circle(xx, len, 2, '#9affd0');
        });
      }
      fillRidge(p, 328, [[4, 4, 0], [9, 2, 1]], '#204a40');
      for (let i = 0; i < 14; i++) {
        const x = r() * W;
        wrap(x, 14, (xx) => {
          for (let k = -3; k <= 3; k++) p.line(xx, 330, xx + k * 4, 316 + Math.abs(k) * 2, '#2a6a55', 2);
        });
      }
      layers.push({ c, factor: 0.58, auto: 0 });
    }
    {
      const [c, g] = makeCanvas(W, H);
      const p = new P(g);
      const r = seeded(61);
      for (let i = 0; i < 7; i++) {
        const x = r() * W;
        wrap(x, 30, (xx) => {
          for (let k = -4; k <= 4; k++) p.line(xx, 362, xx + k * 6, 334 + Math.abs(k) * 3, '#0b241e', 3);
        });
      }
      fg.push({ c, factor: 1.3, auto: 0 });
    }
    return { sky: ['#071a26', '#0f3a44', '#1c6058'], layers, fg, particle: 'firefly', celestial: 'moon' };
  }
  // 蚀月高塔
  {
    const [c, g] = makeCanvas(W, H);
    const p = new P(g);
    fillRidge(p, 280, [[2, 10, 0.4]], '#24103a');
    const r = seeded(5);
    for (let i = 0; i < 9; i++) {
      const x = r() * W, w = 10 + r() * 14, h = 60 + r() * 120;
      wrap(x, w, (xx) => {
        p.rect(xx - w / 2, 290 - h, w, h + 70, '#2a1442');
        p.poly([[xx - w / 2 - 3, 290 - h], [xx, 290 - h - w * 1.8], [xx + w / 2 + 3, 290 - h]], '#2a1442');
        if (r() < 0.7) p.rect(xx - 1, 290 - h + 16, 2, 4, '#ff7a4a');
      });
    }
    layers.push({ c, factor: 0.05, auto: 0 });
  }
  layers.push({ c: cloudLayer(71, '#4a1f5e', '#38164a', 7, 120, 230, 1.3), factor: 0.1, auto: 12 });
  {
    const [c, g] = makeCanvas(W, H);
    const p = new P(g);
    p.rect(0, 270, W, 90, '#1e0c2a');
    for (let x = 0; x < W; x += 24) p.rect(x, 258, 14, 14, '#1e0c2a');
    for (let x = 60; x < W; x += 160) {
      p.rect(x, 200, 30, 80, '#1e0c2a');
      p.poly([[x - 4, 200], [x + 15, 170], [x + 34, 200]], '#1e0c2a');
      p.rect(x + 12, 220, 6, 10, '#ff5a3a');
    }
    layers.push({ c, factor: 0.25, auto: 0 });
  }
  layers.push({ c: cloudLayer(91, '#5a2048', '#40163a', 5, 250, 320, 1.6), factor: 0.4, auto: 22 });
  {
    const [c, g] = makeCanvas(W, H);
    const p = new P(g);
    for (let x = 30; x < W; x += 210) {
      p.rect(x, 0, 26, H, '#140818');
      p.rect(x, 0, 6, H, '#0c040e');
      for (let y = 0; y < H; y += 30) p.rect(x - 2, y, 30, 3, '#1e0c24');
      for (let y = 0; y < 120; y += 6) p.rect(x + 40 + Math.sin(y * 0.1) * 2, y, 3, 4, '#2a1a30');
    }
    layers.push({ c, factor: 0.62, auto: 0 });
  }
  {
    const [c, g] = makeCanvas(W, H);
    const p = new P(g);
    const r = seeded(83);
    for (let i = 0; i < 6; i++) {
      const x = r() * W;
      wrap(x, 30, (xx) => {
        p.poly([[xx - 26, 362], [xx - 10, 340], [xx + 6, 346], [xx + 24, 362]], '#0a0410');
      });
    }
    fg.push({ c, factor: 1.3, auto: 0 });
  }
  return { sky: ['#12061f', '#3e1240', '#b03a50'], layers, fg, particle: 'ember', celestial: 'eclipse' };
}

const skyCache = new Map<string, CanvasGradient>();
export function drawBackground(g: Ctx, bg: BgSet, camX: number, camY: number, maxCamY: number, t: number) {
  const key = bg.sky.join();
  let grad = skyCache.get(key);
  if (!grad) {
    grad = g.createLinearGradient(0, 0, 0, VIEW_H);
    grad.addColorStop(0, bg.sky[0]);
    grad.addColorStop(0.6, bg.sky[1]);
    grad.addColorStop(1, bg.sky[2]);
    skyCache.set(key, grad);
  }
  g.fillStyle = grad;
  g.fillRect(0, 0, VIEW_W, VIEW_H);
  const lift = maxCamY - camY;
  // 天体
  if (bg.celestial === 'sun') {
    const sx = 520 - camX * 0.01, sy = 60 + lift * 0.02;
    radial(g, sx, sy, 70, 'rgba(255,250,200,0.55)');
    g.fillStyle = '#fff8d0';
    g.beginPath();
    g.arc(sx, sy, 18, 0, Math.PI * 2);
    g.fill();
  } else if (bg.celestial === 'moon') {
    const sx = 470 - camX * 0.01, sy = 70 + lift * 0.02;
    radial(g, sx, sy, 90, 'rgba(160,255,230,0.25)');
    g.fillStyle = '#e8fff4';
    g.beginPath();
    g.arc(sx, sy, 24, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#c8eee0';
    g.fillRect(Math.round(sx - 8), Math.round(sy - 6), 6, 5);
    g.fillRect(Math.round(sx + 6), Math.round(sy + 6), 5, 4);
  } else {
    const sx = 320 - camX * 0.01, sy = 90;
    const pulse = 1 + Math.sin(t * 1.5) * 0.05;
    radial(g, sx, sy, 120 * pulse, 'rgba(255,120,80,0.35)');
    g.fillStyle = '#ffcf7a';
    g.beginPath();
    g.arc(sx, sy, 40, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#12061a';
    g.beginPath();
    g.arc(sx + 3, sy + 1, 37, 0, Math.PI * 2);
    g.fill();
  }
  for (const L of bg.layers) drawLayer(g, L, camX, lift, t);
}

export function drawForeground(g: Ctx, bg: BgSet, camX: number, camY: number, maxCamY: number, t: number, yOffset = 0) {
  const lift = maxCamY - camY;
  for (const L of bg.fg) drawLayer(g, L, camX, -lift * 0.3, t, yOffset);
}

function drawLayer(g: Ctx, L: Layer, camX: number, lift: number, t: number, yOffset = 0) {
  let ox = -((camX * L.factor + t * L.auto) % W);
  if (ox > 0) ox -= W;
  const y = Math.round(lift * L.factor * 0.6 + yOffset);
  for (let x = ox; x < VIEW_W; x += W) g.drawImage(L.c, Math.round(x), y);
}

export function radial(g: Ctx, x: number, y: number, r: number, color: string) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, color);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(x - r, y - r, r * 2, r * 2);
}
