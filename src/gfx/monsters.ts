// 程序化怪物 / Boss 精灵
import { makeCanvas, P, mkFrame, Frame } from './pixel';

const EYE = '#20142a';

export type EnemyKind = 'slime' | 'mushroom' | 'knight' | 'sorcerer' | 'imp' | 'boss';
export interface SpriteSet {
  w: number;
  h: number;
  feet: number; // 图像中脚底所在 y
  cx: number; // 图像中身体中心 x
  anims: Record<string, Frame[]>;
}

// ---------------- 青苔史莱姆 ----------------
function slime(rx: number, ry: number, hurt = false) {
  const [c, g] = makeCanvas(30, 26);
  const p = new P(g);
  const cx = 15, cy = 25 - ry;
  p.ellipseShaded(cx, cy, rx, ry, '#7ee05a', '#3fa83a', '#e0ffc0');
  // 苔藓帽
  for (let y = Math.floor(cy - ry); y <= cy; y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy > 1) continue;
      const edge = cy - ry * 0.3 + ((x * 7 + 3) % 3) - 1;
      if (y < edge) p.px(x, y, (x + y) % 3 === 0 ? '#4fb048' : '#2f8a3a');
    }
  }
  // 小花
  const fy = Math.round(cy - ry) - 1;
  p.px(cx - 3, fy, '#ff8ac0');
  p.px(cx - 5, fy, '#ff8ac0');
  p.px(cx - 4, fy - 1, '#ff8ac0');
  p.px(cx - 4, fy + 1, '#ff8ac0');
  p.px(cx - 4, fy, '#fff27a');
  p.px(cx + 1, fy + 1, '#a8ff7a');
  p.px(cx + 2, fy, '#a8ff7a');
  // 眼睛
  const ey = Math.round(cy) - 1;
  if (hurt) {
    p.line(cx + 2, ey, cx + 4, ey + 2, EYE);
    p.line(cx + 4, ey, cx + 2, ey + 2, EYE);
    p.line(cx + 6, ey, cx + 8, ey + 2, EYE);
    p.line(cx + 8, ey, cx + 6, ey + 2, EYE);
  } else {
    p.rect(cx + 2, ey, 2, 3, EYE);
    p.rect(cx + 6, ey, 2, 3, EYE);
    p.px(cx + 2, ey, '#ffffff');
    p.px(cx + 6, ey, '#ffffff');
    p.px(cx + 4, ey + 3, '#2a6a2a');
    p.px(cx + 5, ey + 3, '#2a6a2a');
  }
  p.px(cx + 1, ey + 3, '#ff9fae');
  p.px(cx + 9, ey + 3, '#ff9fae');
  return mkFrame(c, true, '#173a17');
}

// ---------------- 红伞蘑菇怪 ----------------
function mushroom(f: number, hurt = false) {
  const [c, g] = makeCanvas(30, 32);
  const p = new P(g);
  const cx = 15;
  const by = f === 1 || f === 3 ? 1 : 0;
  const lf = f === 0 ? -2 : f === 2 ? 2 : 0;
  p.rect(cx - 7 + lf, 29, 5, 2, '#6a3a1a');
  p.rect(cx + 2 - lf, 29, 5, 2, '#8a4a22');
  p.rect(cx - 6, 18 + by, 12, 11 - by, '#f7e3c0');
  p.rect(cx - 6, 18 + by, 2, 11 - by, '#d9b98c');
  p.rect(cx - 5, 28, 10, 1, '#d9b98c');
  const fy = 21 + by;
  if (hurt) {
    p.line(cx + 1, fy, cx + 2, fy + 1, EYE);
    p.line(cx + 2, fy + 1, cx + 1, fy + 2, EYE);
    p.line(cx + 6, fy, cx + 5, fy + 1, EYE);
    p.line(cx + 5, fy + 1, cx + 6, fy + 2, EYE);
    p.rect(cx + 2, fy + 4, 3, 2, '#8a3a2a');
  } else {
    p.rect(cx + 1, fy, 2, 3, EYE);
    p.rect(cx + 5, fy, 2, 3, EYE);
    p.px(cx + 1, fy, '#ffffff');
    p.px(cx + 5, fy, '#ffffff');
    p.line(cx, fy - 2, cx + 2, fy - 1, '#5a2a1a');
    p.line(cx + 7, fy - 2, cx + 5, fy - 1, '#5a2a1a');
    p.rect(cx + 3, fy + 4, 2, 1, '#8a3a2a');
  }
  const ccy = 19 + by;
  for (let y = ccy - 12; y <= ccy; y++) {
    for (let x = cx - 14; x <= cx + 14; x++) {
      const dx = (x + 0.5 - cx) / 13.5, dy = (y + 0.5 - ccy) / 12;
      if (dx * dx + dy * dy > 1) continue;
      let col = '#e8423a';
      if (y >= ccy - 1) col = '#a82a28';
      else if (dx < -0.55 || dy > -0.25) col = '#c8302c';
      const lx = dx + 0.35, ly = dy + 0.6;
      if (lx * lx + ly * ly < 0.06) col = '#ff9a8a';
      p.px(x, y, col);
    }
  }
  p.ellipse(cx - 7, ccy - 5, 2.2, 1.8, '#ffffff');
  p.ellipse(cx + 1, ccy - 9, 2.6, 2, '#ffffff');
  p.ellipse(cx + 8, ccy - 4, 1.8, 1.6, '#ffffff');
  p.ellipse(cx - 2, ccy - 3, 1.5, 1.2, '#fff0e8');
  return mkFrame(c, true, '#3a0e0e');
}

// ---------------- 发条铁皮骑士 ----------------
function knight(f: number, mode: 'walk' | 'atk0' | 'atk1' | 'hurt') {
  const [c, g] = makeCanvas(48, 38);
  const p = new P(g);
  const cx = 20;
  const by = mode === 'walk' && f === 1 ? 1 : 0;
  const lean = mode === 'atk1' ? 3 : mode === 'atk0' ? -1 : 0;
  // 背后发条钥匙
  p.rect(cx - 11 + lean, 20 + by, 4, 2, '#c8962a');
  if (f % 2 === 0) {
    p.rect(cx - 14 + lean, 16 + by, 3, 10, '#ffd447');
    p.rect(cx - 14 + lean, 16 + by, 1, 10, '#c8962a');
  } else {
    p.rect(cx - 16 + lean, 19 + by, 6, 4, '#ffd447');
    p.rect(cx - 16 + lean, 22 + by, 6, 1, '#c8962a');
  }
  const lf = mode === 'walk' ? (f === 0 ? 2 : -2) : mode === 'atk1' ? 3 : 1;
  p.rect(cx - 6 - lf, 28, 5, 6, '#5c6676');
  p.rect(cx - 7 - lf, 34, 6, 2, '#3a4250');
  p.rect(cx + 1 + lf, 28, 5, 6, '#9aa4b4');
  p.rect(cx + 1 + lf, 34, 7, 2, '#4a5260');
  p.px(cx + 2 + lf, 30, '#ffd447');
  p.rect(cx - 8 + lean, 16 + by, 16, 12, '#9aa4b4');
  p.rect(cx - 8 + lean, 16 + by, 4, 12, '#6c7686');
  p.rect(cx + 2 + lean, 17 + by, 4, 1, '#e0e8f4');
  p.rect(cx - 8 + lean, 25 + by, 16, 2, '#5a3a20');
  p.px(cx + 1 + lean, 25 + by, '#ffd447');
  p.px(cx - 6 + lean, 18 + by, '#ffd447');
  p.px(cx + 6 + lean, 18 + by, '#ffd447');
  p.px(cx + 6 + lean, 23 + by, '#ffd447');
  p.ellipseShaded(cx + 1 + lean, 10 + by, 8, 8, '#a8b2c2', '#6c7686', '#f4f8ff');
  p.rect(cx + 1 + lean, 8 + by, 8, 4, '#2a2a3a');
  p.rect(cx + 3 + lean, 9 + by, 5, 1, mode === 'hurt' ? '#ffffff' : '#ff4a4a');
  p.px(cx + 8 + lean, 9 + by, '#ff9a9a');
  p.rect(cx - 2 + lean, 0 + by, 3, 4, '#e8484a');
  p.rect(cx - 5 + lean, 1 + by, 3, 3, '#e8484a');
  p.rect(cx - 7 + lean, 3 + by, 2, 2, '#a82a3a');
  p.ellipse(cx - 3 + lean, 22 + by, 4.5, 6, '#3a6ad8');
  p.rect(cx - 4 + lean, 17 + by, 2, 10, '#ffd447');
  p.rect(cx - 7 + lean, 21 + by, 8, 2, '#ffd447');
  const sa = mode === 'atk0' ? -2.1 : mode === 'atk1' ? 0 : 0.7;
  const hx = cx + 8 + lean + (mode === 'atk1' ? 4 : 0);
  const hy = mode === 'atk0' ? 14 + by : 21 + by;
  p.line(cx + 5 + lean, 19 + by, hx, hy, '#7c8696', 3);
  const nx = -Math.sin(sa), ny = Math.cos(sa);
  p.line(hx - nx * 3, hy - ny * 3, hx + nx * 3, hy + ny * 3, '#c8962a', 2);
  p.ray(hx + Math.cos(sa) * 2, hy + Math.sin(sa) * 2, sa, 15, '#9aa4b4', 3);
  p.ray(hx + Math.cos(sa) * 2, hy + Math.sin(sa) * 2, sa, 15, '#eef4ff', 1);
  return mkFrame(c, true, '#1a1a2a');
}

// ---------------- 幽光术士 ----------------
function sorcerer(f: number, mode: 'float' | 'cast' | 'hurt') {
  const [c, g] = makeCanvas(32, 40);
  const p = new P(g);
  const cx = 15;
  const by = f;
  for (let i = 0; i < 8; i++) {
    const w = 12 - i * 1.4;
    const ox = Math.round(Math.sin((i + f * 2) * 0.9) * 1.5) - i * 0.5;
    p.rect(cx - w / 2 + ox, 30 + i + by, w, 1, i < 3 ? '#3a2a6a' : i < 6 ? '#2a1f52' : '#1c1440');
  }
  for (let y = 14; y <= 30; y++) {
    const half = Math.round(4 + (y - 14) * 0.25);
    p.rect(cx - half, y + by, half * 2, 1, '#4b3a8a');
    p.rect(cx - half, y + by, 2, 1, '#33265e');
  }
  p.rect(cx - 8, 30 + by, 16, 1, '#7ff8ff');
  p.rect(cx + 1, 15 + by, 1, 15, '#6a5ab0');
  p.line(cx - 4, 5 + by, cx - 8, 1 + by, '#5a46a0', 3);
  p.ellipseShaded(cx + 1, 10 + by, 7, 7.5, '#5a46a0', '#3a2a7a', '#8a7ad0');
  p.ellipse(cx + 3, 11 + by, 4, 4.2, '#0e0818');
  const eyeC = mode === 'hurt' ? '#ffffff' : '#7ff8ff';
  p.px(cx + 2, 11 + by, eyeC);
  p.px(cx + 5, 11 + by, eyeC);
  p.px(cx + 2, 12 + by, '#3ab8c8');
  p.px(cx + 5, 12 + by, '#3ab8c8');
  if (mode === 'cast') {
    p.line(cx + 3, 17 + by, cx + 9, 8 + by, '#4b3a8a', 3);
    p.circle(cx + 10, 5 + by, 3.4, '#7ff8ff');
    p.circle(cx + 10, 5 + by, 1.6, '#ffffff');
  } else {
    p.line(cx + 3, 17 + by, cx + 8, 21 + by, '#4b3a8a', 3);
    p.circle(cx + 10, 21 + by, 3, '#5ce0f0');
    p.px(cx + 9, 20 + by, '#ffffff');
  }
  return mkFrame(c, true, '#0c0820');
}

// ---------------- 暗影小鬼 ----------------
function imp(f: number) {
  const [c, g] = makeCanvas(26, 22);
  const p = new P(g);
  const cx = 13;
  const wy = f === 0 ? -5 : 4;
  p.poly([[cx - 2, 9], [cx - 12, 9 + wy], [cx - 9, 14]], '#2a1440');
  p.poly([[cx + 1, 9], [cx + 11, 9 + wy], [cx + 8, 14]], '#3a1f5c');
  p.line(cx - 5, 15, cx - 10, 19, '#2a1450', 2);
  p.px(cx - 11, 20, '#ff3a6a');
  p.ellipseShaded(cx, 12, 6.5, 6.5, '#4a2a7a', '#2a1450', '#9a6ae8');
  p.line(cx - 3, 6, cx - 6, 1, '#e0d0ff');
  p.line(cx + 3, 6, cx + 6, 1, '#e0d0ff');
  p.rect(cx + 1, 10, 2, 2, '#ff3a3a');
  p.rect(cx + 4, 10, 2, 2, '#ff3a3a');
  p.px(cx + 1, 10, '#ffd0d0');
  p.px(cx + 4, 10, '#ffd0d0');
  p.px(cx + 2, 15, '#ffffff');
  p.px(cx + 4, 15, '#ffffff');
  return mkFrame(c, true, '#0e0618');
}

// ---------------- 暗影魔王·莫德雷德 ----------------
function boss(mode: 'idle0' | 'idle1' | 'cast' | 'charge') {
  const [c, g] = makeCanvas(120, 116);
  const p = new P(g);
  const cx = 46, oy = 18;
  const by = mode === 'idle1' ? 1 : 0;
  const lean = mode === 'charge' ? 6 : 0;
  const Y = (y: number) => y + oy + by;
  const flow = mode === 'charge' ? 16 : mode === 'idle1' ? 5 : 2;
  p.poly([[cx - 12 + lean, Y(32)], [cx + 8 + lean, Y(32)], [cx + 10, 92 + oy], [cx - 26 - flow, 94 + oy], [cx - 22 - flow * 0.6, Y(60)]], '#5a1030');
  p.poly([[cx - 8 + lean, Y(34)], [cx + 4 + lean, Y(34)], [cx + 4, 90 + oy], [cx - 16 - flow * 0.7, 92 + oy]], '#8a1a40');
  for (let i = 0; i < 6; i++) {
    const x = cx - 22 - flow + i * 6;
    p.poly([[x, 94 + oy], [x + 3, 88 + oy], [x + 6, 94 + oy]], '#3a0820');
  }
  p.rect(cx - 12, 70 + oy, 9, 22, '#2a2240');
  p.rect(cx + 3 + lean / 2, 70 + oy, 9, 22, '#3a3058');
  p.rect(cx - 12, 76 + oy, 9, 3, '#5a4a80');
  p.rect(cx + 3 + lean / 2, 76 + oy, 9, 3, '#6a5a90');
  p.rect(cx - 15, 90 + oy, 13, 5, '#1a1428');
  p.rect(cx + 2 + lean / 2, 90 + oy, 14, 5, '#1a1428');
  const bsh = { x: cx - 14 + lean, y: Y(42) };
  if (mode === 'cast') p.line(bsh.x, bsh.y, cx - 20 + lean, Y(14), '#2a2240', 6);
  else p.line(bsh.x, bsh.y, cx - 18 + lean, Y(62), '#2a2240', 6);
  p.poly([[cx - 14 + lean, Y(36)], [cx + 15 + lean, Y(36)], [cx + 11 + lean, Y(70)], [cx - 10 + lean, Y(70)]], '#3a3058');
  p.poly([[cx - 14 + lean, Y(36)], [cx - 6 + lean, Y(36)], [cx - 4 + lean, Y(70)], [cx - 10 + lean, Y(70)]], '#272040');
  p.line(cx - 8 + lean, Y(44), cx + 12 + lean, Y(44), '#7a4ad0');
  p.line(cx - 6 + lean, Y(58), cx + 10 + lean, Y(58), '#5a3aa0');
  p.circle(cx + 3 + lean, Y(51), 4.5, '#c060ff');
  p.circle(cx + 3 + lean, Y(51), 2.2, '#ffd0ff');
  p.rect(cx - 11 + lean, Y(64), 23, 4, '#1a1428');
  p.rect(cx + 1 + lean, Y(64), 5, 4, '#c8b8e0');
  for (const sx of [-14, 15]) {
    p.ellipseShaded(cx + sx + lean, Y(38), 9, 7, '#4a3a70', '#2a2040', '#9a8ac0');
    const d = sx < 0 ? -1 : 1;
    p.poly([[cx + sx + lean - 4 * d, Y(33)], [cx + sx + lean + 3 * d, Y(22)], [cx + sx + lean + 4 * d, Y(33)]], '#d8c8f0');
  }
  p.line(cx - 6 + lean, Y(18), cx - 12 + lean, Y(11), '#c8b8a0', 4);
  p.line(cx - 12 + lean, Y(11), cx - 16 + lean, Y(4), '#d8c8b0', 3);
  p.line(cx - 16 + lean, Y(4), cx - 14 + lean, Y(-2), '#f0e8d8', 2);
  p.line(cx + 10 + lean, Y(18), cx + 17 + lean, Y(11), '#c8b8a0', 4);
  p.line(cx + 17 + lean, Y(11), cx + 21 + lean, Y(4), '#d8c8b0', 3);
  p.line(cx + 21 + lean, Y(4), cx + 19 + lean, Y(-2), '#f0e8d8', 2);
  p.ellipseShaded(cx + 2 + lean, Y(24), 11, 12, '#3a3058', '#1e1830', '#7a6aa0');
  p.rect(cx - 2 + lean, Y(22), 14, 9, '#0a0612');
  p.rect(cx + 1 + lean, Y(24), 4, 2, '#ff3040');
  p.rect(cx + 8 + lean, Y(24), 4, 2, '#ff3040');
  p.px(cx + 2 + lean, Y(24), '#ffc0c0');
  p.px(cx + 9 + lean, Y(24), '#ffc0c0');
  p.rect(cx + 1 + lean, Y(14), 2, 3, '#c060ff');
  const fsh = { x: cx + 16 + lean, y: Y(42) };
  let hand: { x: number; y: number };
  let sa: number;
  if (mode === 'cast') {
    hand = { x: cx + 24 + lean, y: Y(16) };
    sa = -1.35;
  } else if (mode === 'charge') {
    hand = { x: cx + 30 + lean, y: Y(50) };
    sa = 0.12;
  } else {
    hand = { x: cx + 22 + lean, y: Y(60) };
    sa = 1.25;
  }
  p.line(fsh.x, fsh.y, hand.x, hand.y, '#3a3058', 6);
  p.circle(hand.x, hand.y, 3.5, '#2a2240');
  const dx = Math.cos(sa), dy = Math.sin(sa);
  const nx = -dy, ny = dx;
  p.line(hand.x - dx * 6, hand.y - dy * 6, hand.x, hand.y, '#5a1030', 3);
  p.line(hand.x + dx * 3 - nx * 6, hand.y + dy * 3 - ny * 6, hand.x + dx * 3 + nx * 6, hand.y + dy * 3 + ny * 6, '#7a4ad0', 3);
  const bs = { x: hand.x + dx * 5, y: hand.y + dy * 5 };
  const L = mode === 'charge' ? 36 : 32;
  p.line(bs.x, bs.y, bs.x + dx * L, bs.y + dy * L, '#241a3a', 6);
  p.line(bs.x, bs.y, bs.x + dx * L, bs.y + dy * L, '#6a4ab0', 3);
  p.line(bs.x + nx, bs.y + ny, bs.x + dx * (L + 1) + nx, bs.y + dy * (L + 1) + ny, '#e0b0ff', 1);
  if (mode === 'cast') {
    p.circle(cx + 2 + lean, Y(2), 6, '#5a1a8a');
    p.circle(cx + 2 + lean, Y(2), 3.5, '#c060ff');
    p.circle(cx + 2 + lean, Y(2), 1.5, '#ffffff');
  }
  return mkFrame(c, true, '#08040e');
}

// ---------------- 汇总 ----------------
const cache = new Map<EnemyKind, SpriteSet>();
export function enemySprites(kind: EnemyKind): SpriteSet {
  let s = cache.get(kind);
  if (s) return s;
  switch (kind) {
    case 'slime':
      s = { w: 30, h: 26, feet: 25, cx: 15, anims: { idle: [slime(11, 7), slime(12, 6)], move: [slime(9, 9), slime(13, 5)], hurt: [slime(12, 6, true)] } };
      break;
    case 'mushroom':
      s = { w: 30, h: 32, feet: 31, cx: 15, anims: { idle: [mushroom(1), mushroom(3)], move: [mushroom(0), mushroom(1), mushroom(2), mushroom(3)], hurt: [mushroom(1, true)] } };
      break;
    case 'knight':
      s = {
        w: 48, h: 38, feet: 36, cx: 20,
        anims: { idle: [knight(0, 'walk'), knight(1, 'walk')], move: [knight(0, 'walk'), knight(1, 'walk')], atk0: [knight(0, 'atk0')], atk1: [knight(1, 'atk1')], hurt: [knight(0, 'hurt')] },
      };
      break;
    case 'sorcerer':
      s = { w: 32, h: 40, feet: 39, cx: 15, anims: { idle: [sorcerer(0, 'float'), sorcerer(1, 'float')], move: [sorcerer(0, 'float'), sorcerer(1, 'float')], cast: [sorcerer(0, 'cast')], hurt: [sorcerer(0, 'hurt')] } };
      break;
    case 'imp':
      s = { w: 26, h: 22, feet: 21, cx: 13, anims: { idle: [imp(0), imp(1)], move: [imp(0), imp(1)], hurt: [imp(1)] } };
      break;
    default:
      s = { w: 120, h: 116, feet: 113, cx: 48, anims: { idle: [boss('idle0'), boss('idle1')], move: [boss('idle0'), boss('idle1')], cast: [boss('cast')], charge: [boss('charge')], hurt: [boss('idle0')] } };
      break;
  }
  cache.set(kind, s);
  return s;
}
