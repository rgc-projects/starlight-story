// 程序化 Q 版二头身角色精灵：王子（三职业）、NPC、公主
import { makeCanvas, P, mkFrame, Frame, Canvas } from './pixel';

export type JobId = 'sword' | 'mage' | 'ranger';
export type HeroAnim = 'idle' | 'run' | 'jump' | 'fall' | 'climb' | 'attack' | 'hurt' | 'cast';
export interface HeroFrame extends Frame {
  tip: { x: number; y: number };
}
export const HERO_SIZE = 48;
export const HERO_FEET = 45;

const SKIN = '#ffdcb8', SKIN_S = '#efb088';
const EYE = '#2b2140';

interface JobPal {
  main: string; mainS: string; trim: string; pants: string; pantsS: string; boot: string; cape: string; capeS: string;
}
const PAL: Record<JobId, JobPal> = {
  sword: { main: '#3d7bff', mainS: '#2a52c0', trim: '#eef2fa', pants: '#f4f0e8', pantsS: '#c8c0b0', boot: '#6b3f1f', cape: '#ec4a4e', capeS: '#a82a3a' },
  mage: { main: '#8a4dff', mainS: '#5e2fc4', trim: '#ffd447', pants: '#4a2a8a', pantsS: '#341c66', boot: '#4a2a1a', cape: '#3a2a7a', capeS: '#281c5a' },
  ranger: { main: '#3fbf5f', mainS: '#2a8a44', trim: '#8a5a2a', pants: '#7a5a3a', pantsS: '#5a3f26', boot: '#5a3a1a', cape: '#2f9a4a', capeS: '#1f6a34' },
};

/** 武器外观等级：0 无装备 1 白 2 蓝 3 紫 4 金 */
export const WEAPON_COLORS = [
  { a: '#c8ced8', b: '#7c8696', orb: '#7fc8ff', glow: '' },
  { a: '#f4f7fc', b: '#a6b0c2', orb: '#a8e8ff', glow: '' },
  { a: '#9fe6ff', b: '#3a92d8', orb: '#5cc8ff', glow: '#5cc8ff' },
  { a: '#e2b4ff', b: '#8a4ad8', orb: '#d080ff', glow: '#c77dff' },
  { a: '#fff08a', b: '#e09a20', orb: '#ffd23a', glow: '#ffd23a' },
];

export const JOB_COLORS: Record<JobId, string> = { sword: '#5c9bff', mage: '#b07dff', ranger: '#4fd86f' };

// ---------------- 通用头部 ----------------
interface HeadOpt {
  hair: string; hairS: string; hairL: string;
  style: 'prince' | 'long' | 'bald';
  eyes: 'open' | 'hurt' | 'closed';
  beard?: string;
  eyeColor?: string;
}
function headShape(p: P, hx: number, hy: number, c: string) {
  p.rect(hx + 3, hy, 8, 1, c);
  p.rect(hx + 1, hy + 1, 12, 1, c);
  p.rect(hx, hy + 2, 14, 9, c);
  p.rect(hx + 1, hy + 11, 12, 1, c);
  p.rect(hx + 3, hy + 12, 8, 1, c);
}
function drawHead(p: P, hx: number, hy: number, o: HeadOpt) {
  if (o.style === 'long') {
    // 长发披肩（在头后）
    p.rect(hx - 1, hy + 4, 6, 14, o.hair);
    p.rect(hx - 1, hy + 14, 2, 4, o.hairS);
    p.rect(hx + 1, hy + 17, 3, 2, o.hair);
  }
  headShape(p, hx, hy, SKIN);
  p.rect(hx + 3, hy + 12, 8, 1, SKIN_S);
  if (o.style === 'prince' || o.style === 'long') {
    p.rect(hx + 3, hy, 8, 1, o.hair);
    p.rect(hx + 1, hy + 1, 12, 1, o.hair);
    p.rect(hx, hy + 2, 14, 3, o.hair);
    p.rect(hx, hy + 5, 8, 1, o.hair);
    p.px(hx + 9, hy + 5, o.hair);
    p.px(hx + 10, hy + 5, o.hair);
    p.px(hx + 12, hy + 5, o.hair);
    p.px(hx + 13, hy + 5, o.hair);
    p.rect(hx, hy + 6, 5, 1, o.hair);
    p.px(hx + 7, hy + 6, o.hair);
    p.rect(hx, hy + 7, 4, 4, o.hair);
    p.rect(hx + 1, hy + 11, 2, 1, o.hair);
    p.rect(hx + 4, hy + 1, 4, 1, o.hairL);
    p.px(hx + 3, hy + 2, o.hairL);
    p.px(hx + 9, hy + 2, o.hairL);
    p.rect(hx, hy + 8, 1, 3, o.hairS);
    p.rect(hx + 1, hy + 4, 3, 1, o.hairS);
    p.px(hx + 5, hy + 5, o.hairS);
  } else {
    // 秃顶 + 两侧头发
    p.rect(hx + 4, hy + 1, 3, 1, '#fff0dc');
    p.rect(hx, hy + 4, 3, 6, o.hair);
    p.rect(hx + 1, hy + 3, 2, 1, o.hair);
    p.px(hx, hy + 9, o.hairS);
  }
  // 耳朵
  p.rect(hx + 5, hy + 7, 1, 2, SKIN_S);
  const ec = o.eyeColor ?? '#3d6bd8';
  if (o.eyes === 'open') {
    p.rect(hx + 8, hy + 6, 2, 3, EYE);
    p.rect(hx + 11, hy + 6, 2, 3, EYE);
    p.px(hx + 8, hy + 6, '#ffffff');
    p.px(hx + 11, hy + 6, '#ffffff');
    p.px(hx + 9, hy + 8, ec);
    p.px(hx + 12, hy + 8, ec);
  } else if (o.eyes === 'hurt') {
    p.line(hx + 8, hy + 6, hx + 9, hy + 7, EYE);
    p.line(hx + 9, hy + 7, hx + 8, hy + 8, EYE);
    p.line(hx + 12, hy + 6, hx + 11, hy + 7, EYE);
    p.line(hx + 11, hy + 7, hx + 12, hy + 8, EYE);
  } else {
    p.rect(hx + 8, hy + 8, 2, 1, EYE);
    p.rect(hx + 11, hy + 8, 2, 1, EYE);
  }
  p.px(hx + 7, hy + 9, '#ff9fae');
  p.px(hx + 13, hy + 9, '#ff9fae');
  if (o.beard) {
    p.rect(hx + 6, hy + 9, 8, 4, o.beard);
    p.rect(hx + 7, hy + 13, 7, 3, o.beard);
    p.rect(hx + 8, hy + 16, 5, 2, o.beard);
    p.px(hx + 10, hy + 18, o.beard);
    p.rect(hx + 9, hy + 10, 4, 1, '#d8d0c8');
  } else {
    p.px(hx + 11, hy + 10, o.eyes === 'hurt' ? '#8a2a3a' : '#c0505a');
  }
}

// ---------------- 王子 ----------------
interface Pose {
  bob: number;
  fl: [number, number];
  bl: [number, number];
  fa: number;
  ba: number;
  wa: number;
  hurt?: boolean;
  draw?: number;
  cape?: number;
  back?: boolean;
}

const PRINCE_HAIR: HeadOpt = { hair: '#ffd447', hairS: '#e09a1c', hairL: '#fff3a8', style: 'prince', eyes: 'open' };

function drawHero(job: JobId, tier: number, pose: Pose) {
  const [c, g] = makeCanvas(HERO_SIZE, HERO_SIZE);
  const p = new P(g);
  const pal = PAL[job];
  const W = WEAPON_COLORS[tier];
  const cx = 24;
  const by = pose.bob;
  const legTop = 40;
  const torsoTop = 32 + by;
  const headTop = 19 + by;
  const hx = cx - 6;
  let tip = { x: cx + 8, y: torsoTop };

  if (pose.back) {
    drawHeroBack(p, job, pose, cx, legTop, torsoTop, headTop, pal);
    return { c, tip };
  }

  // 披风 / 箭筒（身后）
  if (job !== 'mage') {
    const flow = pose.cape ?? 0.5;
    const len = job === 'sword' ? 11 : 8;
    for (let i = 0; i < len; i++) {
      const y = torsoTop + 1 + i;
      const x0 = cx - 5 - Math.round(i * flow * 0.55);
      p.rect(x0, y, cx + 1 - x0, 1, i > len - 3 ? pal.capeS : pal.cape);
      p.px(x0, y, pal.capeS);
    }
  }
  if (job === 'ranger') {
    p.rect(cx - 8, torsoTop - 4, 3, 9, '#8a5a2a');
    p.rect(cx - 8, torsoTop - 4, 1, 9, '#6a4020');
    p.px(cx - 8, torsoTop - 6, '#ffffff');
    p.px(cx - 6, torsoTop - 6, '#ffffff');
    p.px(cx - 7, torsoTop - 5, '#ff5a4a');
    p.px(cx - 8, torsoTop - 5, '#ff5a4a');
  }

  // 后手
  const sbx = cx - 3, sby = torsoTop + 2;
  const be = p.ray(sbx, sby, pose.ba, 5, pal.mainS, 2);
  p.rect(be.x, be.y, 2, 2, SKIN_S);

  // 腿
  const leg = (dx: number, dy: number, front: boolean) => {
    const x = cx + (front ? 0 : -4) + dx;
    const y = legTop + dy;
    p.rect(x, y, 3, 3, front ? pal.pants : pal.pantsS);
    p.rect(x, y + 3, 4, 2, front ? pal.boot : '#4a2a14');
  };
  leg(pose.bl[0], pose.bl[1], false);
  leg(pose.fl[0], pose.fl[1], true);

  // 躯干
  p.rect(cx - 5, torsoTop, 10, 8, pal.main);
  p.rect(cx - 5, torsoTop, 2, 8, pal.mainS);
  if (job === 'mage') {
    // 长袍下摆
    const top = torsoTop + 7;
    for (let y = top; y <= 42; y++) {
      const k = (y - top) / Math.max(1, 42 - top);
      const half = 5 + Math.round(k * 2);
      p.rect(cx - half, y, half * 2, 1, y === 42 ? pal.trim : pal.main);
      p.rect(cx - half, y, 2, 1, y === 42 ? '#c89a20' : pal.mainS);
    }
    p.rect(cx + 1, torsoTop + 1, 1, 42 - torsoTop - 1, pal.trim);
    p.rect(cx - 5, torsoTop + 5, 10, 1, pal.trim);
  } else {
    p.rect(cx - 5, torsoTop + 5, 10, 1, '#6b3f1f');
    p.px(cx + 1, torsoTop + 5, '#ffd447');
  }
  p.rect(cx - 2, torsoTop, 5, 1, pal.trim);
  if (job === 'sword') {
    p.rect(cx + 1, torsoTop, 4, 2, '#eef2fa');
    p.px(cx + 1, torsoTop + 1, '#a6b0c2');
    p.px(cx, torsoTop + 3, '#ffd447');
    p.px(cx - 1, torsoTop + 3, '#ffd447');
  } else if (job === 'ranger') {
    p.rect(cx - 1, torsoTop + 1, 4, 4, '#a8743a');
    p.px(cx - 1, torsoTop + 1, '#8a5a2a');
    p.line(cx - 4, torsoTop, cx + 3, torsoTop + 6, '#6a4020');
  }

  // 头部 & 头饰
  drawHead(p, hx, headTop, { ...PRINCE_HAIR, eyes: pose.hurt ? 'hurt' : 'open' });
  if (job === 'sword') {
    p.rect(hx + 4, headTop - 2, 6, 2, '#ffd447');
    p.rect(hx + 4, headTop - 1, 6, 1, '#e0a020');
    p.px(hx + 4, headTop - 3, '#ffd447');
    p.px(hx + 6, headTop - 3, '#ffd447');
    p.px(hx + 7, headTop - 3, '#ffd447');
    p.px(hx + 9, headTop - 3, '#ffd447');
    p.px(hx + 6, headTop - 1, '#ff4a6a');
    p.px(hx + 7, headTop - 1, '#ff4a6a');
  } else if (job === 'mage') {
    p.rect(hx - 2, headTop + 3, 18, 2, pal.main);
    p.rect(hx - 2, headTop + 4, 18, 1, pal.mainS);
    for (let i = 0; i < 12; i++) {
      const y = headTop + 2 - i;
      const w = Math.max(2, 12 - i);
      const center = hx + 7 - i * 0.3 - Math.max(0, i - 6) * 0.9;
      p.rect(Math.round(center - w / 2), y, w, 1, i < 2 ? pal.trim : pal.main);
      p.px(Math.round(center - w / 2), y, pal.mainS);
    }
    p.px(hx + 7, headTop - 2, '#fff7a0');
    p.px(hx + 6, headTop - 3, '#ffd447');
    p.px(hx + 8, headTop - 3, '#ffd447');
    p.px(hx + 7, headTop - 4, '#ffd447');
    p.px(hx + 7, headTop - 2, '#ffd447');
  } else {
    p.rect(hx + 1, headTop - 1, 12, 1, pal.main);
    p.rect(hx, headTop, 14, 3, pal.main);
    p.rect(hx, headTop + 3, 14, 1, pal.mainS);
    p.rect(hx + 10, headTop + 3, 6, 1, '#1f6a34');
    p.line(hx + 3, headTop - 1, hx - 2, headTop - 6, '#ff5a4a');
    p.line(hx + 4, headTop - 1, hx - 1, headTop - 6, '#ff9a6a');
  }

  // 前手
  const sfx = cx + 2, sfy = torsoTop + 2;
  const fe = p.ray(sfx, sfy, pose.fa, 5, pal.main, 2);
  const hand = { x: fe.x, y: fe.y };

  // 武器
  const dx = Math.cos(pose.wa), dy = Math.sin(pose.wa);
  if (job === 'sword') {
    p.line(hand.x - dx * 3, hand.y - dy * 3, hand.x, hand.y, '#6b3f1f', 2);
    const gx = hand.x + dx * 2, gy = hand.y + dy * 2;
    const nx = -dy, ny = dx;
    p.line(gx - nx * 3, gy - ny * 3, gx + nx * 3, gy + ny * 3, tier >= 3 ? W.a : '#e0b040', 2);
    const bs = { x: gx + dx * 2, y: gy + dy * 2 };
    const bl = tier >= 3 ? 15 : 13;
    const bend = { x: bs.x + dx * bl, y: bs.y + dy * bl };
    p.line(bs.x, bs.y, bend.x, bend.y, W.b, 3);
    p.line(bs.x, bs.y, bend.x, bend.y, W.a, 1);
    p.px(bend.x + dx, bend.y + dy, W.a);
    tip = { x: Math.round(bend.x), y: Math.round(bend.y) };
  } else if (job === 'mage') {
    p.line(hand.x - dx * 8, hand.y - dy * 8, hand.x + dx * 9, hand.y + dy * 9, tier >= 3 ? '#4a2a6a' : '#8a5a2a', 2);
    const ox = hand.x + dx * 12, oy = hand.y + dy * 12;
    const nx = -dy, ny = dx;
    p.line(hand.x + dx * 9 + nx * 3, hand.y + dy * 9 + ny * 3, ox + nx * 2, oy + ny * 2, '#e0b040');
    p.line(hand.x + dx * 9 - nx * 3, hand.y + dy * 9 - ny * 3, ox - nx * 2, oy - ny * 2, '#e0b040');
    p.circle(ox, oy, 2.6, W.orb);
    p.px(ox - 1, oy - 1, '#ffffff');
    tip = { x: Math.round(ox), y: Math.round(oy) };
  } else {
    const draw = pose.draw ?? 0;
    const C = { x: hand.x - dx * 5, y: hand.y - dy * 5 };
    const R = 9;
    let prev: { x: number; y: number } | null = null;
    const wood = tier >= 2 ? W.b : '#8a5a2a';
    const woodL = tier >= 2 ? W.a : '#c08a4a';
    for (let a = -1.05; a <= 1.051; a += 0.15) {
      const pt = { x: C.x + Math.cos(pose.wa + a) * R, y: C.y + Math.sin(pose.wa + a) * R };
      if (prev) p.line(prev.x, prev.y, pt.x, pt.y, wood, 2);
      prev = pt;
    }
    const e1 = { x: C.x + Math.cos(pose.wa - 1.05) * R, y: C.y + Math.sin(pose.wa - 1.05) * R };
    const e2 = { x: C.x + Math.cos(pose.wa + 1.05) * R, y: C.y + Math.sin(pose.wa + 1.05) * R };
    p.px(hand.x + dx * 4, hand.y + dy * 4, woodL);
    const pull = draw > 0 ? { x: hand.x - dx * (4 + draw * 5), y: hand.y - dy * (4 + draw * 5) } : { x: (e1.x + e2.x) / 2, y: (e1.y + e2.y) / 2 };
    p.line(e1.x, e1.y, pull.x, pull.y, '#f4f4f4');
    p.line(pull.x, pull.y, e2.x, e2.y, '#f4f4f4');
    if (draw > 0) {
      p.line(pull.x, pull.y, pull.x + dx * 15, pull.y + dy * 15, '#d8b070');
      p.px(pull.x + dx * 16, pull.y + dy * 16, W.a);
      p.px(pull.x - dx, pull.y - dy, '#ffffff');
    }
    tip = { x: Math.round(hand.x + dx * 7), y: Math.round(hand.y + dy * 7) };
  }
  p.rect(hand.x, hand.y, 2, 2, SKIN);
  return { c, tip };
}

function drawHeroBack(p: P, job: JobId, pose: Pose, cx: number, legTop: number, torsoTop: number, headTop: number, pal: JobPal) {
  // 腿
  p.rect(cx - 4, legTop + pose.bl[1], 3, 3, pal.pantsS);
  p.rect(cx - 4, legTop + 3 + pose.bl[1], 3, 2, pal.boot);
  p.rect(cx + 1, legTop + pose.fl[1], 3, 3, pal.pants);
  p.rect(cx + 1, legTop + 3 + pose.fl[1], 3, 2, pal.boot);
  // 躯干
  p.rect(cx - 5, torsoTop, 10, 8, pal.mainS);
  p.rect(cx - 5, torsoTop + 5, 10, 1, '#6b3f1f');
  if (job === 'mage') {
    for (let y = torsoTop + 7; y <= 42; y++) p.rect(cx - 6, y, 12, 1, y === 42 ? pal.trim : pal.mainS);
  } else {
    p.rect(cx - 5, torsoTop + 1, 10, job === 'sword' ? 10 : 7, pal.cape);
    p.rect(cx - 5, torsoTop + 1, 1, job === 'sword' ? 10 : 7, pal.capeS);
  }
  if (job === 'ranger') {
    p.rect(cx + 1, torsoTop - 3, 3, 9, '#8a5a2a');
    p.px(cx + 1, torsoTop - 4, '#ffffff');
    p.px(cx + 3, torsoTop - 4, '#ff5a4a');
  }
  // 手臂向上抓绳
  const a = pose.fa > 0.5 ? 2 : 0;
  p.rect(cx - 7, torsoTop - 5 + a, 2, 7, pal.main);
  p.rect(cx - 7, torsoTop - 7 + a, 2, 2, SKIN);
  p.rect(cx + 5, torsoTop - 5 + (2 - a), 2, 7, pal.main);
  p.rect(cx + 5, torsoTop - 7 + (2 - a), 2, 2, SKIN);
  // 后脑勺
  const hx = cx - 7;
  headShape(p, hx, headTop, '#ffd447');
  p.rect(hx + 2, headTop + 10, 10, 2, '#e09a1c');
  p.rect(hx + 4, headTop + 1, 5, 1, '#fff3a8');
  if (job === 'sword') {
    p.rect(hx + 4, headTop - 2, 6, 2, '#ffd447');
    p.px(hx + 4, headTop - 3, '#ffd447');
    p.px(hx + 7, headTop - 3, '#ffd447');
    p.px(hx + 9, headTop - 3, '#ffd447');
  } else if (job === 'mage') {
    p.rect(hx - 2, headTop + 3, 18, 2, pal.main);
    for (let i = 0; i < 11; i++) {
      const w = Math.max(2, 12 - i);
      p.rect(Math.round(hx + 7 - w / 2), headTop + 2 - i, w, 1, pal.main);
    }
  } else {
    p.rect(hx, headTop, 14, 4, pal.main);
    p.line(hx + 7, headTop - 1, hx + 9, headTop - 6, '#ff5a4a');
  }
}

type JobPoses = Record<HeroAnim, Pose[]>;
function posesFor(job: JobId): JobPoses {
  // 不同职业武器握持角度
  const W = {
    sword: { idle: -1.0, run: -0.75, jump: -0.4, fall: -0.9, atk: [-2.5, 0.2, 1.4], hurt: -2.2, cast: -1.57 },
    mage: { idle: -1.45, run: -1.25, jump: -1.0, fall: -1.3, atk: [-1.7, -0.15, -0.7], hurt: -2.0, cast: -1.57 },
    ranger: { idle: 1.0, run: 0.8, jump: 0.3, fall: 0.6, atk: [0, 0, 0], hurt: -2.0, cast: -1.2 },
  }[job];
  const atkArms =
    job === 'sword'
      ? [{ fa: -2.1, ba: 2.3 }, { fa: 0.0, ba: 2.6 }, { fa: 0.9, ba: 2.1 }]
      : job === 'mage'
        ? [{ fa: -1.5, ba: 2.0 }, { fa: -0.1, ba: 2.4 }, { fa: 0.4, ba: 2.0 }]
        : [{ fa: 0, ba: 0.1 }, { fa: 0, ba: 1.6 }, { fa: 0, ba: 1.8 }];
  return {
    idle: [
      { bob: 0, fl: [1, 0], bl: [-1, 0], fa: 1.2, ba: 1.9, wa: W.idle, cape: 0.3 },
      { bob: 1, fl: [1, 0], bl: [-1, 0], fa: 1.3, ba: 1.9, wa: W.idle + 0.05, cape: 0.45 },
    ],
    run: [
      { bob: 0, fl: [3, 0], bl: [-3, -1], fa: 0.7, ba: 2.4, wa: W.run, cape: 1.0 },
      { bob: 1, fl: [1, -1], bl: [-1, 0], fa: 1.1, ba: 2.0, wa: W.run - 0.05, cape: 1.3 },
      { bob: 0, fl: [-2, -1], bl: [2, 0], fa: 1.6, ba: 1.2, wa: W.run - 0.1, cape: 1.0 },
      { bob: 1, fl: [0, 0], bl: [0, -1], fa: 1.2, ba: 1.6, wa: W.run - 0.05, cape: 1.3 },
    ],
    jump: [{ bob: 0, fl: [2, -3], bl: [-2, -1], fa: -0.5, ba: -2.5, wa: W.jump, cape: 1.4 }],
    fall: [{ bob: 0, fl: [1, -1], bl: [-2, 0], fa: -1.0, ba: -2.1, wa: W.fall, cape: -0.3 }],
    climb: [
      { bob: 0, fl: [0, 0], bl: [0, -2], fa: 0, ba: 0, wa: 0, back: true },
      { bob: 0, fl: [0, -2], bl: [0, 0], fa: 1, ba: 0, wa: 0, back: true },
    ],
    attack: [0, 1, 2].map((i) => ({
      bob: i === 0 ? 0 : 1,
      fl: [i === 0 ? 2 : 3, 0] as [number, number],
      bl: [-3, 0] as [number, number],
      fa: atkArms[i].fa,
      ba: atkArms[i].ba,
      wa: W.atk[i],
      cape: 0.5 + i * 0.3,
      draw: job === 'ranger' && i === 0 ? 1 : 0,
    })),
    hurt: [{ bob: 0, fl: [-1, 0], bl: [-3, 0], fa: -2.3, ba: -2.8, wa: W.hurt, hurt: true, cape: 0.2 }],
    cast: [{ bob: 0, fl: [1, 0], bl: [-2, 0], fa: -1.5, ba: -1.7, wa: W.cast, cape: 0.7 }],
  };
}

const heroCache = new Map<string, Record<HeroAnim, HeroFrame[]>>();
export function heroSprites(job: JobId, tier: number): Record<HeroAnim, HeroFrame[]> {
  const key = `${job}_${tier}`;
  let s = heroCache.get(key);
  if (s) return s;
  const poses = posesFor(job);
  const out = {} as Record<HeroAnim, HeroFrame[]>;
  (Object.keys(poses) as HeroAnim[]).forEach((anim) => {
    out[anim] = poses[anim].map((pose) => {
      const { c, tip } = drawHero(job, tier, pose);
      const f = mkFrame(c);
      return { ...f, tip };
    });
  });
  heroCache.set(key, out);
  return out;
}

// ---------------- NPC ----------------
export type NpcKind = 'elder' | 'smith' | 'princess';
const npcCache = new Map<string, Frame[]>();

export function npcSprites(kind: NpcKind): Frame[] {
  let s = npcCache.get(kind);
  if (s) return s;
  s = [0, 1].map((f) => mkFrame(drawNpc(kind, f)));
  npcCache.set(kind, s);
  return s;
}

function drawNpc(kind: NpcKind, f: number): Canvas {
  const [c, g] = makeCanvas(48, 48);
  const p = new P(g);
  const cx = 24;
  const by = f;
  const torsoTop = 32 + by;
  const headTop = 19 + by;
  const hx = cx - 6;
  if (kind === 'elder') {
    // 法杖（身后）
    p.line(cx + 9, 18 + by, cx + 9, 45, '#8a5a2a', 2);
    p.circle(cx + 9.5, 16 + by, 3, '#7fe0ff');
    p.px(cx + 9, 15 + by, '#ffffff');
    // 长袍
    for (let y = torsoTop; y <= 44; y++) {
      const k = (y - torsoTop) / (44 - torsoTop);
      const half = 5 + Math.round(k * 3);
      p.rect(cx - half, y, half * 2, 1, y >= 43 ? '#ffd447' : '#3a6ad8');
      p.rect(cx - half, y, 2, 1, '#2a4aa0');
    }
    p.rect(cx, torsoTop, 1, 12, '#ffd447');
    drawHead(p, hx, headTop, { hair: '#f4f4f8', hairS: '#c8c8d8', hairL: '#ffffff', style: 'bald', eyes: f ? 'closed' : 'open', beard: '#f4f4f8' });
    // 眉毛
    p.rect(hx + 8, headTop + 5, 2, 1, '#e0e0e8');
    p.rect(hx + 11, headTop + 5, 2, 1, '#e0e0e8');
    // 手扶法杖
    p.rect(cx + 6, torsoTop + 3, 3, 2, '#3a6ad8');
    p.rect(cx + 8, torsoTop + 2, 2, 3, SKIN);
  } else if (kind === 'smith') {
    // 腿
    p.rect(cx - 5, 40, 4, 3, '#4a3a2a');
    p.rect(cx + 1, 40, 4, 3, '#4a3a2a');
    p.rect(cx - 6, 43, 5, 2, '#2a1a10');
    p.rect(cx + 1, 43, 5, 2, '#2a1a10');
    // 壮硕身体
    p.rect(cx - 7, torsoTop - 1, 14, 9, '#d8483a');
    p.rect(cx - 7, torsoTop - 1, 3, 9, '#a83028');
    p.rect(cx - 4, torsoTop + 1, 9, 9, '#8a5a2a');
    p.rect(cx - 4, torsoTop + 1, 9, 1, '#6a4020');
    p.px(cx, torsoTop + 4, '#c8c8c8');
    // 后手
    p.rect(cx - 9, torsoTop, 3, 6, '#efb088');
    drawHead(p, hx, headTop, { hair: '#6a3a1a', hairS: '#4a2410', hairL: '#8a5a2a', style: 'bald', eyes: 'open', beard: '#7a4422', eyeColor: '#5a3a1a' });
    p.rect(hx + 8, headTop + 5, 2, 1, '#4a2410');
    p.rect(hx + 11, headTop + 5, 2, 1, '#4a2410');
    // 锤子
    const ha = f ? -1.9 : -0.6;
    const sx = cx + 6, sy = torsoTop + 2;
    const h = p.ray(sx, sy, f ? -0.9 : 0.6, 5, '#efb088', 3);
    const hd = p.ray(h.x, h.y, ha, 9, '#8a5a2a', 2);
    const nx = -Math.sin(ha), ny = Math.cos(ha);
    p.line(hd.x - nx * 4, hd.y - ny * 4, hd.x + nx * 4, hd.y + ny * 4, '#8a94a6', 4);
    p.line(hd.x - nx * 4, hd.y - ny * 4, hd.x + nx * 4, hd.y + ny * 4, '#c8ced8', 1);
  } else {
    // 公主：粉色蓬蓬裙
    for (let y = torsoTop + 4; y <= 44; y++) {
      const k = (y - torsoTop - 4) / (44 - torsoTop - 4);
      const half = 5 + Math.round(k * 5);
      p.rect(cx - half, y, half * 2, 1, y % 3 === 0 ? '#ff9ac8' : '#ffb4d8');
      p.rect(cx - half, y, 2, 1, '#e86aa8');
    }
    p.rect(cx - 8, 43, 16, 2, '#ffffff');
    p.rect(cx - 4, torsoTop, 8, 5, '#ff8ac0');
    p.rect(cx - 1, torsoTop + 1, 2, 2, '#ffe0f0');
    drawHead(p, hx, headTop, { hair: '#ffd447', hairS: '#e09a1c', hairL: '#fff3a8', style: 'long', eyes: f ? 'closed' : 'open', eyeColor: '#2ab88a' });
    // 皇冠
    p.rect(hx + 5, headTop - 1, 5, 1, '#fff0a0');
    p.px(hx + 5, headTop - 2, '#ffd447');
    p.px(hx + 7, headTop - 3, '#ffd447');
    p.px(hx + 7, headTop - 2, '#5cc8ff');
    p.px(hx + 9, headTop - 2, '#ffd447');
    // 双手合十
    p.rect(cx + 2, torsoTop + 2, 3, 3, '#ff8ac0');
    p.rect(cx + 4, torsoTop + 2, 2, 2, SKIN);
  }
  return c;
}
