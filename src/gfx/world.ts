// 程序化地形瓦片、场景装饰、道具图标
import { makeCanvas, P, outline, Canvas, Ctx, shade } from './pixel';
import { seeded } from '../core/utils';

export type Theme = 'town' | 'meadow' | 'forest' | 'tower';

// ======================== 地面瓦片 ========================
interface GroundTiles { top: Canvas; fill: Canvas; plat: { l: Canvas; m: Canvas; r: Canvas } }
const groundCache = new Map<Theme, GroundTiles>();

export function groundTiles(theme: Theme): GroundTiles {
  let t = groundCache.get(theme);
  if (t) return t;
  const rnd = seeded(theme.length * 977 + 13);
  const [top, gt] = makeCanvas(32, 16);
  const [fill, gf] = makeCanvas(32, 32);
  const pt = new P(gt), pf = new P(gf);
  if (theme === 'tower') {
    // 暗色石砖
    const drawBricks = (p: P, h: number, off: number) => {
      p.rect(0, 0, 32, h, '#3a2c4e');
      for (let row = 0; row < h; row += 8) {
        const o = ((row / 8) % 2) * 8 + off;
        p.rect(0, row, 32, 1, '#241a34');
        for (let x = o; x < 32 + 16; x += 16) p.rect((x % 32), row, 1, 8, '#241a34');
        p.rect(0, row + 1, 32, 1, '#4a3a62');
      }
    };
    drawBricks(pf, 32, 0);
    drawBricks(pt, 16, 0);
    pt.rect(0, 0, 32, 3, '#6a4a9a');
    pt.rect(0, 3, 32, 1, '#2a1a40');
    for (let x = 2; x < 32; x += 8) pt.px(x, 1, '#c080ff');
    for (let i = 0; i < 10; i++) pf.px(Math.floor(rnd() * 32), Math.floor(rnd() * 32), '#2e2240');
  } else {
    const dirt = theme === 'forest' ? '#4a3a32' : '#a0663a';
    const dirtS = theme === 'forest' ? '#3a2c26' : '#7e4c2a';
    const dirtL = theme === 'forest' ? '#5e4a3e' : '#b87a48';
    const grass = theme === 'forest' ? '#2f8a6a' : theme === 'town' ? '#62d25a' : '#5fd35a';
    const grassS = theme === 'forest' ? '#1f6a50' : '#3fae46';
    const grassL = theme === 'forest' ? '#5fd8a8' : '#a8f08a';
    pf.rect(0, 0, 32, 32, dirt);
    for (let i = 0; i < 26; i++) {
      const x = Math.floor(rnd() * 31), y = Math.floor(rnd() * 31);
      pf.rect(x, y, 2, 1, i % 3 === 0 ? dirtL : dirtS);
    }
    for (let i = 0; i < 3; i++) {
      const x = Math.floor(rnd() * 28), y = Math.floor(rnd() * 28);
      pf.rect(x, y, 4, 3, '#8a8a96');
      pf.rect(x, y, 4, 1, '#b0b0bc');
      pf.rect(x, y + 2, 4, 1, '#62626e');
    }
    pt.rect(0, 0, 32, 16, dirt);
    for (let i = 0; i < 10; i++) pt.rect(Math.floor(rnd() * 31), 8 + Math.floor(rnd() * 7), 2, 1, dirtS);
    pt.rect(0, 0, 32, 5, grass);
    pt.rect(0, 0, 32, 1, grassL);
    for (let x = 0; x < 32; x++) {
      const d = (x * 5 + 3) % 4;
      pt.rect(x, 5, 1, d > 1 ? 2 : 1, grassS);
      if (d === 0) pt.px(x, 7, grass);
    }
    for (let i = 0; i < 6; i++) pt.px(Math.floor(rnd() * 32), 1 + Math.floor(rnd() * 3), grassL);
    if (theme === 'town') {
      // 小镇石板路
      for (let x = 0; x < 32; x += 8) {
        pt.rect(x + 1, 9, 6, 4, '#c8b89a');
        pt.rect(x + 1, 12, 6, 1, '#9a8a70');
      }
    }
  }
  // 薄平台
  const mk = (w: number, cap: -1 | 0 | 1) => {
    const [c, g] = makeCanvas(w, 14);
    const p = new P(g);
    if (theme === 'town' || theme === 'meadow') {
      p.rect(0, 0, w, 6, '#c8884a');
      p.rect(0, 0, w, 1, '#ecb078');
      p.rect(0, 5, w, 1, '#8a5a2a');
      for (let x = 0; x < w; x += 8) p.rect(x, 1, 1, 4, '#9a6430');
      p.rect(0, 6, w, 2, '#6a4020');
      if (theme === 'meadow') {
        for (let x = 0; x < w; x += 3) p.px(x, 0, (x % 6) ? '#7fe06a' : '#4fb048');
        p.px(3, 6, '#4fb048');
        p.px(4, 7, '#4fb048');
        p.px(11, 6, '#4fb048');
      }
      if (cap !== 0) {
        const x = cap < 0 ? 1 : w - 4;
        p.rect(x, 6, 3, 8, '#7a4a22');
        p.rect(x, 6, 1, 8, '#5a3414');
      }
    } else if (theme === 'forest') {
      p.rect(0, 0, w, 8, '#6a7a8a');
      p.rect(0, 0, w, 2, '#3fb88a');
      p.rect(0, 2, w, 1, '#2a8a6a');
      p.rect(0, 7, w, 1, '#4a5666');
      for (let x = 4; x < w; x += 10) p.rect(x, 3, 1, 4, '#56626e');
      for (let x = 2; x < w; x += 7) p.rect(x, 8, 1, 2 + (x % 4), '#2a8a6a');
      p.px(7, 4, '#7ff8e0');
      if (cap !== 0) p.rect(cap < 0 ? 0 : w - 1, 0, 1, 8, '#4a5666');
    } else {
      p.rect(0, 0, w, 8, '#4a3a62');
      p.rect(0, 0, w, 2, '#8a5ad0');
      p.rect(0, 7, w, 1, '#241a34');
      for (let x = 3; x < w; x += 8) p.px(x, 4, '#c080ff');
      if (cap !== 0) p.rect(cap < 0 ? 0 : w - 1, 0, 1, 8, '#241a34');
    }
    return c;
  };
  t = { top, fill, plat: { l: mk(8, -1), m: mk(16, 0), r: mk(8, 1) } };
  groundCache.set(theme, t);
  return t;
}

/** 绘制实心地面（仅绘制视口内部分） */
export function drawGround(g: Ctx, theme: Theme, x: number, y: number, w: number, h: number, viewX: number, viewW: number) {
  const t = groundTiles(theme);
  const x0 = Math.max(x, Math.floor(viewX / 32) * 32);
  const x1 = Math.min(x + w, viewX + viewW + 32);
  for (let tx = x0; tx < x1; tx += 32) {
    const cw = Math.min(32, x + w - tx);
    g.drawImage(t.top, 0, 0, cw, 16, tx, y, cw, 16);
    for (let ty = y + 16; ty < y + h; ty += 32) g.drawImage(t.fill, 0, 0, cw, 32, tx, ty, cw, 32);
  }
}

export function drawPlatform(g: Ctx, theme: Theme, x: number, y: number, w: number) {
  const t = groundTiles(theme).plat;
  g.drawImage(t.l, x, y);
  let cx = x + 8;
  while (cx < x + w - 8) {
    const cw = Math.min(16, x + w - 8 - cx);
    g.drawImage(t.m, 0, 0, cw, 14, cx, y, cw, 14);
    cx += 16;
  }
  g.drawImage(t.r, x + w - 8, y);
}

export function drawRope(g: Ctx, x: number, top: number, bottom: number, ladder: boolean) {
  if (ladder) {
    g.fillStyle = '#8a5a2a';
    g.fillRect(x - 6, top, 2, bottom - top);
    g.fillRect(x + 4, top, 2, bottom - top);
    g.fillStyle = '#c08a4a';
    for (let y = top + 3; y < bottom; y += 7) g.fillRect(x - 5, y, 10, 2);
    g.fillStyle = '#5a3414';
    for (let y = top + 5; y < bottom; y += 7) g.fillRect(x - 5, y, 10, 1);
  } else {
    g.fillStyle = '#b08850';
    g.fillRect(x - 1, top, 3, bottom - top);
    g.fillStyle = '#7a5a30';
    for (let y = top; y < bottom; y += 4) g.fillRect(x - 1, y, 1, 2), g.fillRect(x + 1, y + 2, 1, 2);
    g.fillStyle = '#d8b878';
    for (let y = top + 1; y < bottom; y += 4) g.fillRect(x, y, 1, 1);
    // 绳结
    g.fillStyle = '#8a6a3a';
    g.fillRect(x - 2, top - 2, 5, 4);
  }
}

// ======================== 场景装饰 ========================
export interface DecoSprite { c: Canvas; ax: number; ay: number; glow?: { x: number; y: number; r: number; color: string }[] }
const decoCache = new Map<string, DecoSprite>();

export function decoSprite(kind: string): DecoSprite {
  let d = decoCache.get(kind);
  if (d) return d;
  d = buildDeco(kind);
  decoCache.set(kind, d);
  return d;
}

function house(roof: string, wall = '#f4e4c4'): DecoSprite {
  const W = 84, H = 92;
  const [c, g] = makeCanvas(W, H);
  const p = new P(g);
  const bx = 8, bw = 68, wallTop = 44;
  // 烟囱
  p.rect(58, 12, 8, 22, '#9a5a4a');
  p.rect(56, 10, 12, 4, '#7a3a2a');
  // 墙
  p.rect(bx, wallTop, bw, H - wallTop - 1, wall);
  p.rect(bx, wallTop, 4, H - wallTop - 1, shade(wall, -0.15));
  // 木框架
  const beam = '#7a4a2a';
  p.rect(bx, wallTop, bw, 3, beam);
  p.rect(bx, H - 6, bw, 5, '#8a8a96');
  p.rect(bx, H - 6, bw, 1, '#b0b0bc');
  for (const x of [bx, bx + 22, bx + 44, bx + bw - 3]) p.rect(x, wallTop, 3, H - wallTop - 6, beam);
  p.line(bx + 3, wallTop + 3, bx + 21, H - 7, beam, 2);
  p.line(bx + bw - 4, wallTop + 3, bx + 47, H - 7, beam, 2);
  // 门
  p.rect(bx + 27, H - 30, 14, 24, '#6a3a1a');
  p.rect(bx + 27, H - 30, 14, 2, '#4a2410');
  p.rect(bx + 34, H - 30, 1, 24, '#4a2410');
  p.px(bx + 38, H - 18, '#ffd447');
  p.rect(bx + 25, H - 32, 18, 2, beam);
  // 窗（暖光）
  const win = (x: number, y: number) => {
    p.rect(x, y, 12, 12, '#5a3414');
    p.rect(x + 1, y + 1, 10, 10, '#ffe08a');
    p.rect(x + 1, y + 1, 10, 3, '#fff4c0');
    p.rect(x + 5, y + 1, 1, 10, '#5a3414');
    p.rect(x + 1, y + 6, 10, 1, '#5a3414');
    p.rect(x - 1, y + 12, 14, 2, '#8a5a2a');
    p.px(x + 1, y + 14, '#ff6a8a');
    p.px(x + 4, y + 14, '#ffd447');
    p.px(x + 8, y + 14, '#ff6a8a');
  };
  win(bx + 7, wallTop + 12);
  win(bx + 50, wallTop + 12);
  // 屋顶
  for (let y = 0; y < 34; y++) {
    const half = 8 + y * 1.25;
    const col = y % 4 === 3 ? shade(roof, -0.25) : y < 4 ? shade(roof, 0.2) : roof;
    p.rect(W / 2 - half, 12 + y, half * 2, 1, col);
    p.rect(W / 2 - half, 12 + y, 3, 1, shade(roof, -0.3));
  }
  p.rect(2, 45, W - 4, 2, shade(roof, -0.4));
  // 屋顶小窗
  p.rect(W / 2 - 5, 24, 10, 9, wall);
  p.rect(W / 2 - 3, 26, 6, 6, '#ffe08a');
  p.rect(W / 2 - 1, 26, 1, 6, '#5a3414');
  outline(c, '#2a1a1a');
  return { c, ax: W / 2, ay: H, glow: [{ x: bx + 13 - W / 2, y: wallTop + 18 - H, r: 14, color: '#ffd070' }, { x: bx + 56 - W / 2, y: wallTop + 18 - H, r: 14, color: '#ffd070' }] };
}

function tree(seed: number, dark = false): DecoSprite {
  const W = 64, H = 84;
  const [c, g] = makeCanvas(W, H);
  const p = new P(g);
  const r = seeded(seed);
  p.rect(28, 46, 8, 37, dark ? '#4a3020' : '#7a4a2a');
  p.rect(28, 46, 3, 37, dark ? '#38241a' : '#5a3418');
  p.line(31, 60, 22, 50, '#7a4a2a', 3);
  p.rect(24, 80, 16, 3, '#5a3418');
  const base = dark ? '#2a7a5a' : '#4cbf4c', sh = dark ? '#1a5a42' : '#2f8f3a', li = dark ? '#5ad8a0' : '#9aef6a';
  const blobs: [number, number, number][] = [[32, 30, 20], [18, 40, 13], [46, 40, 13], [24, 20, 12], [42, 22, 12], [32, 46, 12]];
  for (const [x, y, rad] of blobs) p.ellipseShaded(x + (r() - 0.5) * 3, y, rad, rad * 0.85, base, sh, li);
  for (let i = 0; i < 6; i++) p.px(14 + r() * 36, 14 + r() * 30, li);
  if (!dark) {
    for (let i = 0; i < 4; i++) p.px(14 + r() * 36, 18 + r() * 26, '#ff6a6a');
  }
  outline(c, dark ? '#0a2018' : '#173a17');
  return { c, ax: W / 2, ay: H - 1 };
}

function buildDeco(kind: string): DecoSprite {
  switch (kind) {
    case 'house_red': return house('#e05a4a');
    case 'house_blue': return house('#4a7ae0', '#eef0f8');
    case 'house_green': return house('#3fae6a', '#f8ecd0');
    case 'house_purple': return house('#9a5ad8', '#f4e8f8');
    case 'tree': return tree(7);
    case 'tree2': return tree(23);
    case 'darktree': return tree(41, true);
    case 'smithy': {
      const W = 96, H = 84;
      const [c, g] = makeCanvas(W, H);
      const p = new P(g);
      p.rect(70, 4, 12, 34, '#6a6a76');
      p.rect(68, 2, 16, 4, '#4a4a56');
      p.rect(8, 36, 80, 47, '#8a8a96');
      for (let y = 36; y < 83; y += 6) {
        p.rect(8, y, 80, 1, '#62626e');
        for (let x = 8 + ((y / 6) % 2) * 6; x < 88; x += 12) p.rect(x, y, 1, 6, '#62626e');
      }
      p.rect(8, 36, 80, 2, '#b0b0bc');
      // 熔炉口
      p.rect(56, 58, 24, 25, '#3a2a2a');
      p.ellipse(68, 72, 9, 8, '#ff8a2a');
      p.ellipse(68, 74, 6, 5, '#ffd447');
      p.rect(54, 56, 28, 3, '#4a4a56');
      // 门
      p.rect(18, 54, 22, 29, '#5a3414');
      p.rect(28, 54, 2, 29, '#3a2010');
      // 屋顶
      for (let y = 0; y < 22; y++) {
        const half = 26 + y * 1.1;
        p.rect(48 - half, 16 + y, half * 2, 1, y % 4 === 3 ? '#3a3a4a' : '#5a5a6e');
      }
      // 招牌（铁砧）
      p.rect(36, 40, 26, 12, '#7a4a2a');
      p.rect(37, 41, 24, 10, '#c8884a');
      p.rect(42, 44, 14, 3, '#3a3a4a');
      p.rect(46, 47, 6, 2, '#3a3a4a');
      p.rect(44, 49, 10, 1, '#3a3a4a');
      outline(c, '#1a1a22');
      return { c, ax: W / 2, ay: H - 1, glow: [{ x: 20, y: -12, r: 20, color: '#ff8a2a' }] };
    }
    case 'windmill': {
      const W = 64, H = 128;
      const [c, g] = makeCanvas(W, H);
      const p = new P(g);
      for (let y = 30; y < H - 1; y++) {
        const half = 14 + (y - 30) * 0.12;
        p.rect(32 - half, y, half * 2, 1, (y >> 3) % 2 ? '#f0e0c0' : '#e4d0aa');
        p.rect(32 - half, y, 4, 1, '#c8b088');
      }
      p.rect(25, H - 26, 14, 25, '#6a3a1a');
      p.rect(31, H - 26, 1, 25, '#4a2410');
      p.rect(27, 64, 10, 10, '#5a3414');
      p.rect(28, 65, 8, 8, '#ffe08a');
      p.rect(31, 65, 1, 8, '#5a3414');
      for (let y = 0; y < 22; y++) {
        const half = 4 + y * 0.8;
        p.rect(32 - half, 12 + y, half * 2, 1, y % 4 === 3 ? '#a83a2a' : '#d84a3a');
      }
      outline(c, '#2a1a1a');
      return { c, ax: W / 2, ay: H - 1 };
    }
    case 'pine': {
      const [c, g] = makeCanvas(40, 72);
      const p = new P(g);
      p.rect(18, 56, 5, 15, '#6a3a1a');
      for (let layer = 0; layer < 4; layer++) {
        const top = 4 + layer * 13, h = 22;
        for (let y = 0; y < h; y++) {
          const half = 2 + y * (0.55 + layer * 0.08);
          p.rect(20 - half, top + y, half * 2, 1, y > h - 4 ? '#1f7a3a' : '#2f9a4a');
          p.rect(20 - half, top + y, Math.max(1, half * 0.6), 1, '#1f7a3a');
        }
      }
      outline(c, '#0f2a17');
      return { c, ax: 20, ay: 71 };
    }
    case 'bush': {
      const [c, g] = makeCanvas(40, 20);
      const p = new P(g);
      p.ellipseShaded(12, 12, 10, 7, '#4cbf4c', '#2f8f3a', '#9aef6a');
      p.ellipseShaded(26, 11, 11, 8, '#4cbf4c', '#2f8f3a', '#9aef6a');
      p.ellipseShaded(19, 8, 8, 6, '#5ccf5c', '#2f8f3a', '#aaff7a');
      p.px(16, 10, '#ff6a8a');
      p.px(28, 8, '#ffffff');
      outline(c, '#173a17');
      return { c, ax: 20, ay: 19 };
    }
    case 'flowers': {
      const [c, g] = makeCanvas(32, 10);
      const p = new P(g);
      const cols = ['#ff6a8a', '#ffd447', '#ffffff', '#8ab8ff', '#ff9a4a'];
      for (let i = 0; i < 7; i++) {
        const x = 2 + i * 4 + (i % 2);
        const h = 3 + (i * 3) % 4;
        p.rect(x, 10 - h, 1, h, '#3fae46');
        const col = cols[i % cols.length];
        p.px(x, 9 - h, col);
        p.px(x - 1, 10 - h, col);
        p.px(x + 1, 10 - h, col);
        p.px(x, 11 - h, '#fff27a');
      }
      return { c, ax: 16, ay: 10 };
    }
    case 'fence': {
      const [c, g] = makeCanvas(48, 18);
      const p = new P(g);
      for (let x = 2; x < 48; x += 11) {
        p.rect(x, 2, 4, 16, '#e8d0a0');
        p.px(x + 1, 1, '#e8d0a0');
        p.px(x + 2, 1, '#e8d0a0');
        p.rect(x, 2, 1, 16, '#b89a70');
      }
      p.rect(0, 6, 48, 3, '#d8bc88');
      p.rect(0, 12, 48, 3, '#d8bc88');
      outline(c, '#4a3020');
      return { c, ax: 24, ay: 18 };
    }
    case 'lamp': {
      const [c, g] = makeCanvas(16, 48);
      const p = new P(g);
      p.rect(7, 12, 2, 35, '#3a3a4a');
      p.rect(5, 44, 6, 3, '#3a3a4a');
      p.rect(4, 4, 8, 9, '#3a3a4a');
      p.rect(5, 6, 6, 6, '#ffe08a');
      p.rect(3, 3, 10, 2, '#2a2a3a');
      p.px(7, 1, '#2a2a3a');
      p.px(8, 2, '#2a2a3a');
      outline(c, '#14141e');
      return { c, ax: 8, ay: 47, glow: [{ x: 0, y: -38, r: 22, color: '#ffd070' }] };
    }
    case 'well': {
      const [c, g] = makeCanvas(40, 44);
      const p = new P(g);
      p.rect(6, 10, 2, 22, '#7a4a2a');
      p.rect(32, 10, 2, 22, '#7a4a2a');
      p.poly([[2, 12], [20, 2], [38, 12]], '#c84a3a');
      p.rect(8, 16, 24, 2, '#7a4a2a');
      p.line(20, 17, 20, 26, '#d8c8a0');
      p.rect(18, 26, 5, 4, '#8a5a2a');
      p.rect(4, 30, 32, 13, '#9a9aa6');
      for (let x = 4; x < 36; x += 6) p.rect(x, 30, 1, 13, '#6a6a76');
      p.rect(4, 36, 32, 1, '#6a6a76');
      p.rect(4, 30, 32, 2, '#c0c0cc');
      outline(c, '#1a1a22');
      return { c, ax: 20, ay: 43 };
    }
    case 'rock': {
      const [c, g] = makeCanvas(24, 14);
      const p = new P(g);
      p.ellipseShaded(12, 9, 10, 6, '#9a9aa6', '#6a6a76', '#d0d0dc');
      p.px(6, 4, '#4fb048');
      p.px(7, 4, '#4fb048');
      outline(c, '#22222a');
      return { c, ax: 12, ay: 14 };
    }
    case 'crate': {
      const [c, g] = makeCanvas(18, 18);
      const p = new P(g);
      p.rect(1, 1, 16, 16, '#c8884a');
      p.rect(1, 1, 16, 2, '#8a5a2a');
      p.rect(1, 15, 16, 2, '#8a5a2a');
      p.line(2, 3, 15, 14, '#8a5a2a', 2);
      outline(c, '#3a2010');
      return { c, ax: 9, ay: 18 };
    }
    case 'anvil': {
      const [c, g] = makeCanvas(24, 16);
      const p = new P(g);
      p.rect(2, 2, 20, 5, '#5a5a6e');
      p.rect(0, 2, 4, 3, '#5a5a6e');
      p.rect(8, 7, 8, 5, '#4a4a5a');
      p.rect(5, 12, 14, 3, '#3a3a4a');
      p.rect(2, 2, 20, 1, '#9a9aae');
      outline(c, '#14141e');
      return { c, ax: 12, ay: 16 };
    }
    case 'signpost': {
      const [c, g] = makeCanvas(34, 36);
      const p = new P(g);
      p.rect(15, 6, 4, 30, '#7a4a2a');
      p.poly([[4, 6], [26, 6], [32, 11], [26, 16], [4, 16]], '#c8884a');
      p.rect(8, 10, 14, 1, '#7a4a2a');
      p.rect(8, 12, 10, 1, '#7a4a2a');
      outline(c, '#3a2010');
      return { c, ax: 17, ay: 36 };
    }
    case 'sign': {
      const [c, g] = makeCanvas(34, 34);
      const p = new P(g);
      p.rect(6, 16, 3, 18, '#7a4a2a');
      p.rect(25, 16, 3, 18, '#7a4a2a');
      p.rect(2, 4, 30, 18, '#c8884a');
      p.rect(2, 4, 30, 2, '#ecb078');
      p.rect(2, 20, 30, 2, '#8a5a2a');
      p.rect(6, 9, 22, 1, '#6a3a1a');
      p.rect(6, 12, 18, 1, '#6a3a1a');
      p.rect(6, 15, 20, 1, '#6a3a1a');
      p.rect(15, 0, 4, 5, '#ffd447');
      outline(c, '#3a2010');
      return { c, ax: 17, ay: 34 };
    }
    case 'column':
    case 'column_broken': {
      const broken = kind === 'column_broken';
      const H = broken ? 60 : 110;
      const [c, g] = makeCanvas(30, H);
      const p = new P(g);
      p.rect(3, H - 8, 24, 8, '#7a8a96');
      p.rect(5, 8, 20, H - 16, '#9aaab4');
      p.rect(5, 8, 5, H - 16, '#6a7a86');
      for (let x = 12; x < 25; x += 5) p.rect(x, 8, 1, H - 16, '#7a8a96');
      if (!broken) {
        p.rect(2, 2, 26, 7, '#7a8a96');
        p.rect(2, 2, 26, 2, '#b0c0ca');
      } else {
        p.poly([[5, 8], [10, 2], [14, 7], [19, 0], [25, 8]], '#9aaab4');
      }
      for (let y = 20; y < H - 10; y += 22) {
        p.rect(13, y, 4, 1, '#7ff8e0');
        p.rect(14, y + 2, 2, 3, '#7ff8e0');
      }
      for (let i = 0; i < 9; i++) p.rect(5 + ((i * 7) % 18), 10 + ((i * 13) % (H - 20)), 3, 2, '#3fb88a');
      outline(c, '#1a2228');
      const glow = [] as { x: number; y: number; r: number; color: string }[];
      for (let y = 20; y < H - 10; y += 22) glow.push({ x: 0, y: y + 2 - H, r: 8, color: '#5ff8d0' });
      return { c, ax: 15, ay: H, glow };
    }
    case 'glowshroom': {
      const [c, g] = makeCanvas(26, 18);
      const p = new P(g);
      const m = (x: number, h: number, r: number, col: string) => {
        p.rect(x, 18 - h, 2, h, '#d8f0e8');
        p.ellipse(x + 1, 18 - h, r, r * 0.7, col);
        p.px(x, 18 - h - 1, '#ffffff');
      };
      m(4, 7, 4, '#4ad8ff');
      m(13, 12, 5, '#6af0d0');
      m(20, 5, 3, '#8a9aff');
      outline(c, '#0a2028');
      return { c, ax: 13, ay: 18, glow: [{ x: 0, y: -10, r: 16, color: '#4ae8ff' }] };
    }
    case 'bigtree': {
      const W = 140, H = 200;
      const [c, g] = makeCanvas(W, H);
      const p = new P(g);
      p.poly([[56, 199], [62, 90], [80, 90], [86, 199]], '#3a2a2a');
      p.poly([[56, 199], [62, 90], [68, 90], [64, 199]], '#2a1e1e');
      p.poly([[40, 199], [58, 180], [62, 199]], '#3a2a2a');
      p.poly([[82, 199], [86, 180], [104, 199]], '#3a2a2a');
      p.line(72, 120, 40, 90, '#3a2a2a', 5);
      p.line(72, 110, 104, 84, '#3a2a2a', 5);
      const blobs: [number, number, number][] = [[70, 60, 44], [32, 80, 26], [108, 78, 26], [50, 36, 26], [92, 38, 26], [70, 92, 22]];
      for (const [x, y, r] of blobs) p.ellipseShaded(x, y, r, r * 0.8, '#1f6a5a', '#154a40', '#3fa88a');
      const glow = [] as { x: number; y: number; r: number; color: string }[];
      const rr = seeded(99);
      for (let i = 0; i < 14; i++) {
        const x = 26 + rr() * 90, y = 20 + rr() * 80;
        p.px(x, y, '#c8ff8a');
        p.px(x + 1, y, '#8aff9a');
        if (i % 3 === 0) glow.push({ x: x - W / 2, y: y - H, r: 7, color: '#b8ff7a' });
      }
      p.ellipse(71, 150, 6, 8, '#120c0c');
      outline(c, '#081410');
      return { c, ax: W / 2, ay: H - 1, glow };
    }
    case 'fern': {
      const [c, g] = makeCanvas(28, 18);
      const p = new P(g);
      for (let i = -3; i <= 3; i++) p.line(14, 17, 14 + i * 4, 4 + Math.abs(i) * 2, i % 2 ? '#2f9a6a' : '#3fb88a', 2);
      return { c, ax: 14, ay: 18 };
    }
    case 'brazier': {
      const [c, g] = makeCanvas(22, 36);
      const p = new P(g);
      p.rect(9, 12, 4, 22, '#3a2c4e');
      p.rect(5, 32, 12, 3, '#3a2c4e');
      p.poly([[2, 6], [20, 6], [16, 13], [6, 13]], '#5a4a72');
      p.rect(2, 6, 18, 2, '#8a6ab0');
      outline(c, '#0e0818');
      return { c, ax: 11, ay: 35, glow: [{ x: 0, y: -32, r: 26, color: '#c060ff' }] };
    }
    case 'banner': {
      const [c, g] = makeCanvas(24, 70);
      const p = new P(g);
      p.rect(11, 0, 2, 70, '#3a2c4e');
      p.rect(3, 4, 18, 2, '#c8a040');
      p.poly([[4, 6], [20, 6], [20, 44], [12, 38], [4, 44]], '#8a1a40');
      p.poly([[4, 6], [8, 6], [8, 41], [4, 44]], '#5a1030');
      p.circle(12, 20, 4, '#c060ff');
      p.circle(12, 20, 2, '#2a0a20');
      outline(c, '#0e0818');
      return { c, ax: 12, ay: 70 };
    }
    case 'spire': {
      const [c, g] = makeCanvas(40, 120);
      const p = new P(g);
      p.rect(8, 30, 24, 90, '#3a2c4e');
      p.rect(8, 30, 6, 90, '#2a1e3a');
      p.poly([[4, 32], [20, 0], [36, 32]], '#4a3062');
      for (let y = 46; y < 116; y += 22) {
        p.rect(17, y, 6, 10, '#ff6a3a');
        p.rect(17, y, 6, 3, '#ffd070');
      }
      outline(c, '#0e0818');
      return { c, ax: 20, ay: 120 };
    }
    case 'cage': {
      const [c, g] = makeCanvas(48, 64);
      const p = new P(g);
      p.ellipse(24, 10, 18, 8, '#c8a040');
      p.ellipse(24, 10, 14, 5, 'rgba(0,0,0,0)');
      for (let x = 7; x <= 41; x += 6) p.rect(x, 10, 2, 50, '#d8b040');
      p.rect(5, 58, 38, 4, '#a07a20');
      p.rect(5, 14, 38, 2, '#a07a20');
      p.rect(22, 0, 4, 4, '#c8a040');
      outline(c, '#2a1a06');
      return { c, ax: 24, ay: 62 };
    }
    default: {
      const [c] = makeCanvas(2, 2);
      return { c, ax: 1, ay: 2 };
    }
  }
}

/** 风车叶片（运行时旋转绘制） */
export function drawWindmillBlades(g: Ctx, x: number, y: number, ang: number) {
  for (let i = 0; i < 4; i++) {
    const a = ang + (i * Math.PI) / 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    const nx = -sa, ny = ca;
    g.fillStyle = '#5a3414';
    for (let r = 0; r < 44; r += 1) g.fillRect(Math.round(x + ca * r), Math.round(y + sa * r), 2, 2);
    g.fillStyle = '#f8f0e0';
    for (let r = 12; r < 44; r += 1) {
      for (let w = 1; w < 9; w++) g.fillRect(Math.round(x + ca * r + nx * w), Math.round(y + sa * r + ny * w), 1, 1);
    }
    g.fillStyle = '#c8b088';
    for (let r = 12; r < 44; r += 6) {
      for (let w = 1; w < 9; w++) g.fillRect(Math.round(x + ca * r + nx * w), Math.round(y + sa * r + ny * w), 1, 1);
    }
  }
  g.fillStyle = '#3a2010';
  g.fillRect(Math.round(x) - 3, Math.round(y) - 3, 6, 6);
  g.fillStyle = '#ffd447';
  g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
}

// ======================== 道具图标 ========================
export const RARITY_COLORS = ['#e8ecf4', '#5cb8ff', '#c77dff', '#ffcc33'];
const RARITY_ICON: [string, string][] = [['#e0e6f0', '#8a94a6'], ['#7ccaff', '#2a7ad0'], ['#d89aff', '#7a3ad0'], ['#ffe066', '#d8900a']];
export type IconKind = 'weapon' | 'armor' | 'badge' | 'hp' | 'mp' | 'shard' | 'gold' | 'chest';
const iconCache = new Map<string, Canvas>();

export function itemIcon(kind: IconKind, rarity = 0): Canvas {
  const key = kind + rarity;
  let c = iconCache.get(key);
  if (c) return c;
  const [cv, g] = makeCanvas(16, 16);
  const p = new P(g);
  const [a, b] = RARITY_ICON[rarity] ?? RARITY_ICON[0];
  switch (kind) {
    case 'weapon':
      p.line(4, 11, 13, 2, b, 3);
      p.line(4, 11, 13, 2, a, 1);
      p.line(2, 9, 6, 13, '#e0b040', 2);
      p.line(2, 14, 4, 12, '#6b3f1f', 2);
      break;
    case 'armor':
      p.poly([[2, 3], [6, 2], [10, 2], [14, 3], [13, 8], [12, 14], [4, 14], [3, 8]], b);
      p.poly([[4, 4], [7, 3], [9, 3], [12, 4], [11, 12], [5, 12]], a);
      p.rect(7, 4, 2, 8, b);
      p.px(8, 7, '#ffffff');
      break;
    case 'badge':
      p.poly([[5, 1], [8, 7], [11, 1]], '#e84a5a');
      p.circle(8, 10, 5, b);
      p.circle(8, 10, 3.5, a);
      p.px(8, 8, '#ffffff');
      p.rect(7, 9, 3, 3, '#ffffff');
      p.px(8, 12, '#ffffff');
      p.px(6, 10, '#ffffff');
      p.px(10, 10, '#ffffff');
      break;
    case 'hp':
    case 'mp': {
      const col = kind === 'hp' ? '#ff3a4a' : '#3a7aff';
      const li = kind === 'hp' ? '#ff9aa0' : '#9ac0ff';
      p.rect(6, 1, 4, 2, '#c8884a');
      p.rect(7, 3, 2, 3, '#dde8f0');
      p.circle(8, 10, 5, '#dde8f0');
      p.circle(8, 10.5, 4, col);
      p.px(6, 8, li);
      p.px(6, 9, li);
      break;
    }
    case 'shard':
      p.poly([[8, 0], [13, 6], [8, 15], [3, 6]], '#7ff0ff');
      p.poly([[8, 0], [8, 15], [3, 6]], '#c8ffff');
      p.px(7, 5, '#ffffff');
      break;
    case 'gold':
      p.circle(8, 8, 6, '#ffcc33');
      p.circle(8, 8, 4, '#ffe680');
      p.rect(7, 5, 2, 6, '#d8900a');
      break;
    case 'chest':
      p.rect(2, 5, 12, 9, '#a0602a');
      p.rect(2, 5, 12, 3, '#c8884a');
      p.rect(7, 8, 2, 3, '#ffd447');
      break;
  }
  outline(cv, '#1a1022');
  iconCache.set(key, cv);
  return cv;
}

/** 旋转金币动画帧 */
const coinCache = new Map<number, Canvas[]>();
export function coinFrames(tier: number): Canvas[] {
  let f = coinCache.get(tier);
  if (f) return f;
  const cols = [['#e8a060', '#a0602a'], ['#e8ecf4', '#8a94a6'], ['#ffd447', '#d8900a']][tier];
  f = [5, 4, 2, 4].map((rx, i) => {
    const [c, g] = makeCanvas(14, 14);
    const p = new P(g);
    p.ellipse(7, 7, rx, 5, cols[1]);
    if (rx > 2) p.ellipse(7, 7, rx - 1.5, 3.6, cols[0]);
    if (i === 0) p.rect(6, 5, 2, 4, cols[1]);
    p.px(7 - Math.floor(rx / 2), 4, '#ffffff');
    outline(c, '#2a1a06');
    return c;
  });
  coinCache.set(tier, f);
  return f;
}

export function chestSprite(open: boolean): Canvas {
  const key = open ? 'chest_o' : 'chest_c';
  let c = iconCache.get(key);
  if (c) return c;
  const [cv, g] = makeCanvas(28, 24);
  const p = new P(g);
  p.rect(2, 11, 24, 12, '#a0602a');
  p.rect(2, 11, 24, 2, '#7a4420');
  p.rect(2, 20, 24, 3, '#7a4420');
  for (const x of [2, 12, 23]) p.rect(x, 11, 3, 12, '#ffd447');
  if (open) {
    p.rect(2, 1, 24, 6, '#c8884a');
    p.rect(4, 7, 20, 4, '#3a1a0a');
    p.rect(6, 8, 16, 3, '#ffe066');
    p.px(9, 8, '#ffffff');
    p.px(16, 9, '#ffffff');
  } else {
    p.rect(2, 4, 24, 8, '#c8884a');
    p.rect(2, 4, 24, 2, '#ecb078');
    for (const x of [2, 12, 23]) p.rect(x, 4, 3, 8, '#ffd447');
    p.rect(12, 10, 4, 5, '#8a6a10');
    p.px(13, 12, '#2a1a06');
  }
  outline(cv, '#2a1206');
  iconCache.set(key, cv);
  return cv;
}
