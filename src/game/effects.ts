// 爽感特效系统：粒子、伤害跳字、升级圣光柱、残影、斩击弧、落雷、预警红圈、屏幕震动
import { Ctx, Canvas, silhouette, rgba } from '../gfx/pixel';
import { bitmapText, FS } from '../gfx/font';
import { radial } from '../gfx/backgrounds';
import { rand, easeOutBack, easeOutCubic, clamp } from '../core/utils';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
  drag?: number;
  glow?: boolean;
  shape?: 'sq' | 'circle' | 'spark' | 'star' | 'petal' | 'ring';
  rot?: number;
  vrot?: number;
  alpha?: number;
}

export interface DamageNum {
  x: number;
  y: number;
  vy: number;
  text: string;
  style: keyof typeof FS;
  crit: boolean;
  life: number;
  maxLife: number;
  baseScale: number;
}

export interface Afterimage {
  img: Canvas;
  x: number;
  y: number;
  life: number;
  maxLife: number;
  tint: string;
  alpha: number;
}

export interface SlashArc {
  x: number;
  y: number;
  dir: number;
  r: number;
  startAng: number;
  endAng: number;
  color: string;
  core: string;
  life: number;
  maxLife: number;
  thick: number;
  full?: boolean; // 360度旋风斩
}

export interface RingWave {
  x: number;
  y: number;
  r: number;
  maxR: number;
  color: string;
  life: number;
  maxLife: number;
  thick: number;
}

export interface LightningBolt {
  x: number;
  y0: number;
  y1: number;
  pts: [number, number][];
  color: string;
  life: number;
  maxLife: number;
  width: number;
}

export interface LevelUpFx {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  level: number;
}

export interface WarningZone {
  kind: 'circle' | 'lane';
  x: number;
  y: number;
  w: number; // circle: radius; lane: width
  h: number; // lane: height
  t: number;
  dur: number;
  color: string;
  dir?: number;
}

export interface ToastMsg {
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export class Effects {
  particles: Particle[] = [];
  ambient: Particle[] = [];
  nums: DamageNum[] = [];
  afterimages: Afterimage[] = [];
  slashes: SlashArc[] = [];
  rings: RingWave[] = [];
  bolts: LightningBolt[] = [];
  levelUps: LevelUpFx[] = [];
  warnings: WarningZone[] = [];
  toasts: ToastMsg[] = [];

  shakeMag = 0;
  shakeDur = 0;
  shakeX = 0;
  shakeY = 0;
  flashAlpha = 0;
  flashColor = '#ffffff';
  hitStop = 0;
  private numStagger = 0;

  clearWorld() {
    this.particles.length = 0;
    this.ambient.length = 0;
    this.nums.length = 0;
    this.afterimages.length = 0;
    this.slashes.length = 0;
    this.rings.length = 0;
    this.bolts.length = 0;
    this.levelUps.length = 0;
    this.warnings.length = 0;
  }

  shake(mag: number, dur = 0.18) {
    if (mag >= this.shakeMag || this.shakeDur <= 0) {
      this.shakeMag = mag;
      this.shakeDur = Math.max(this.shakeDur, dur);
    }
  }

  flash(color = '#ffffff', alpha = 0.4) {
    this.flashColor = color;
    this.flashAlpha = Math.max(this.flashAlpha, alpha);
  }

  toast(text: string, color = '#fff0b0') {
    this.toasts.push({ text, color, life: 3.0, maxLife: 3.0 });
    if (this.toasts.length > 6) this.toasts.shift();
  }

  spawnNum(x: number, y: number, text: string, style: keyof typeof FS, crit = false) {
    this.numStagger = (this.numStagger + 1) % 4;
    const ox = rand(-8, 8);
    const oy = -this.numStagger * 7;
    this.nums.push({
      x: x + ox,
      y: y + oy,
      vy: crit ? -62 : -44,
      text,
      style,
      crit,
      life: crit ? 1.15 : 0.85,
      maxLife: crit ? 1.15 : 0.85,
      baseScale: crit ? 2.15 : style === 'exp' ? 1.1 : 1.45,
    });
  }

  spawnAfterimage(img: Canvas, x: number, y: number, tint = '#60c8ff', life = 0.24, alpha = 0.65) {
    this.afterimages.push({ img: silhouette(img, tint), x, y, life, maxLife: life, tint, alpha });
  }

  spawnSlash(x: number, y: number, dir: number, r: number, startAng: number, endAng: number, color: string, core = '#ffffff', life = 0.16, thick = 6, full = false) {
    this.slashes.push({ x, y, dir, r, startAng, endAng, color, core, life, maxLife: life, thick, full });
  }

  spawnRing(x: number, y: number, maxR: number, color: string, life = 0.3, thick = 3) {
    this.rings.push({ x, y, r: 4, maxR, color, life, maxLife: life, thick });
  }

  spawnLightning(x: number, y0: number, y1: number, color = '#c060ff', width = 10) {
    const pts: [number, number][] = [];
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const jx = i === 0 || i === steps ? 0 : rand(-14, 14);
      pts.push([x + jx, y0 + (y1 - y0) * t]);
    }
    this.bolts.push({ x, y0, y1, pts, color, life: 0.32, maxLife: 0.32, width });
    this.spawnRing(x, y1, 36, color, 0.35, 3);
    this.burst(x, y1, 16, [color, '#ffffff', '#ff60b0'], 40, 140, 120);
  }

  spawnLevelUp(x: number, y: number, level: number) {
    this.levelUps.push({ x, y, life: 2.0, maxLife: 2.0, level });
    this.shake(5.5, 0.45);
    this.flash('#fff4b0', 0.45);
    this.spawnRing(x, y, 75, '#ffd447', 0.65, 4);
    this.spawnRing(x, y, 50, '#ffffff', 0.45, 2);
    for (let i = 0; i < 40; i++) {
      this.particles.push({
        x: x + rand(-24, 24),
        y: y - rand(0, 60),
        vx: rand(-55, 55),
        vy: rand(-220, -60),
        life: rand(0.6, 1.4),
        maxLife: 1.4,
        size: rand(2, 4),
        color: i % 3 === 0 ? '#ffffff' : i % 2 === 0 ? '#ffd447' : '#ff9a2e',
        gravity: 30,
        glow: true,
        shape: 'star',
      });
    }
  }

  hitSparks(x: number, y: number, crit: boolean, color = '#ffd86b') {
    const n = crit ? 16 : 8;
    const cols = crit ? ['#fff36b', '#ff4a4a', '#ffffff', '#ffaa22'] : [color, '#ffffff', '#ffe49e'];
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const spd = rand(crit ? 65 : 35, crit ? 190 : 115);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 20,
        life: rand(0.18, crit ? 0.42 : 0.28),
        maxLife: 0.42,
        size: crit ? rand(2, 4) : rand(1.5, 3),
        color: cols[i % cols.length],
        gravity: 160,
        glow: crit,
        shape: i % 3 === 0 ? 'spark' : 'sq',
      });
    }
    if (crit) this.spawnRing(x, y, 28, '#ffd447', 0.22, 2.5);
  }

  burst(x: number, y: number, count: number, colors: string[], minSpd = 30, maxSpd = 120, gravity = 140, glow = true) {
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(minSpd, maxSpd);
      const l = rand(0.25, 0.6);
      this.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 25,
        life: l, maxLife: l, size: rand(2, 4),
        color: colors[i % colors.length], gravity, glow, shape: i % 2 === 0 ? 'sq' : 'circle',
      });
    }
  }

  dust(x: number, y: number, count = 6, color = '#e8dcc8') {
    for (let i = 0; i < count; i++) {
      const l = rand(0.22, 0.4);
      this.particles.push({
        x: x + rand(-6, 6), y: y - 2,
        vx: rand(-38, 38), vy: rand(-35, -8),
        life: l, maxLife: l, size: rand(2, 4), color, gravity: 40, shape: 'circle', alpha: 0.7,
      });
    }
  }

  /** 环境飘浮粒子（花瓣 / 萤火虫 / 落叶 / 火星） */
  updateAmbient(dt: number, kind: 'petal' | 'firefly' | 'ember' | 'leaf', camX: number, camY: number, viewW: number, viewH: number) {
    const target = kind === 'firefly' ? 32 : kind === 'ember' ? 28 : 22;
    while (this.ambient.length < target) {
      const x = camX + rand(-30, viewW + 30);
      const y = camY + rand(-20, viewH + 20);
      if (kind === 'petal') {
        this.ambient.push({
          x, y, vx: rand(-22, -8), vy: rand(12, 24),
          life: rand(3, 7), maxLife: 7, size: rand(2, 3.5),
          color: Math.random() < 0.7 ? '#ffb4d0' : '#ffe4f0',
          gravity: 0, shape: 'petal', rot: rand(0, 6.28), vrot: rand(-2, 2),
        });
      } else if (kind === 'leaf') {
        this.ambient.push({
          x, y, vx: rand(-26, -10), vy: rand(10, 22),
          life: rand(3, 7), maxLife: 7, size: rand(2, 3.5),
          color: Math.random() < 0.65 ? '#9aef6a' : '#fff08a',
          gravity: 0, shape: 'petal', rot: rand(0, 6.28), vrot: rand(-2.5, 2.5),
        });
      } else if (kind === 'firefly') {
        this.ambient.push({
          x, y, vx: rand(-12, 12), vy: rand(-10, 10),
          life: rand(2.5, 6), maxLife: 6, size: rand(1.5, 2.8),
          color: Math.random() < 0.6 ? '#b8ff7a' : '#7ff8e0',
          gravity: 0, glow: true, shape: 'circle', rot: rand(0, 6.28),
        });
      } else {
        this.ambient.push({
          x, y: camY + viewH + rand(0, 20), vx: rand(-18, 18), vy: rand(-45, -18),
          life: rand(2, 5), maxLife: 5, size: rand(1.5, 3),
          color: Math.random() < 0.5 ? '#ff7a3a' : '#c060ff',
          gravity: 0, glow: true, shape: 'sq',
        });
      }
    }
    for (let i = this.ambient.length - 1; i >= 0; i--) {
      const p = this.ambient[i];
      p.life -= dt;
      if (kind === 'firefly') {
        p.rot = (p.rot ?? 0) + dt * 2.5;
        p.vx += Math.sin(p.rot) * 14 * dt;
        p.vy += Math.cos(p.rot * 0.8) * 12 * dt;
        p.vx = clamp(p.vx, -16, 16);
        p.vy = clamp(p.vy, -14, 14);
      } else if (kind === 'petal' || kind === 'leaf') {
        p.rot = (p.rot ?? 0) + (p.vrot ?? 1) * dt;
        p.x += Math.sin(p.rot) * 10 * dt;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0 || p.x < camX - 60 || p.x > camX + viewW + 60 || p.y < camY - 60 || p.y > camY + viewH + 60) {
        this.ambient.splice(i, 1);
      }
    }
  }

  update(dt: number) {
    if (this.shakeDur > 0) {
      this.shakeDur -= dt;
      const m = this.shakeMag * clamp(this.shakeDur / 0.25, 0.25, 1);
      this.shakeX = rand(-m, m);
      this.shakeY = rand(-m, m);
      if (this.shakeDur <= 0) {
        this.shakeMag = 0;
        this.shakeX = 0;
        this.shakeY = 0;
      }
    }
    if (this.flashAlpha > 0) this.flashAlpha = Math.max(0, this.flashAlpha - dt * 1.6);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      p.vy += p.gravity * dt;
      if (p.drag) { p.vx *= 1 - p.drag * dt; p.vy *= 1 - p.drag * dt; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = this.nums.length - 1; i >= 0; i--) {
      const n = this.nums[i];
      n.life -= dt;
      if (n.life <= 0) { this.nums.splice(i, 1); continue; }
      n.y += n.vy * dt;
      n.vy *= Math.pow(0.08, dt);
    }
    for (let i = this.afterimages.length - 1; i >= 0; i--) {
      this.afterimages[i].life -= dt;
      if (this.afterimages[i].life <= 0) this.afterimages.splice(i, 1);
    }
    for (let i = this.slashes.length - 1; i >= 0; i--) {
      this.slashes[i].life -= dt;
      if (this.slashes[i].life <= 0) this.slashes.splice(i, 1);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      if (r.life <= 0) { this.rings.splice(i, 1); continue; }
      r.r = r.maxR * easeOutCubic(1 - r.life / r.maxLife);
    }
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      this.bolts[i].life -= dt;
      if (this.bolts[i].life <= 0) this.bolts.splice(i, 1);
    }
    for (let i = this.levelUps.length - 1; i >= 0; i--) {
      this.levelUps[i].life -= dt;
      if (this.levelUps[i].life <= 0) this.levelUps.splice(i, 1);
    }
    for (let i = this.toasts.length - 1; i >= 0; i--) {
      this.toasts[i].life -= dt;
      if (this.toasts[i].life <= 0) this.toasts.splice(i, 1);
    }
  }

  /** 绘制预警红圈/红线（在角色/怪物脚下层） */
  drawWarnings(g: Ctx) {
    for (const w of this.warnings) {
      const prog = clamp(w.t / w.dur, 0, 1);
      const pulse = 0.55 + Math.sin(w.t * 28) * 0.25;
      g.save();
      if (w.kind === 'circle') {
        // 预警地面红圈
        g.fillStyle = rgba(w.color, 0.18 + prog * 0.25);
        g.beginPath();
        g.ellipse(w.x, w.y, w.w, w.w * 0.34, 0, 0, Math.PI * 2);
        g.fill();
        // 收缩充能内圈
        g.fillStyle = rgba('#ff4a4a', 0.32 + prog * 0.25);
        g.beginPath();
        g.ellipse(w.x, w.y, w.w * prog, w.w * 0.34 * prog, 0, 0, Math.PI * 2);
        g.fill();
        // 外环红线
        g.strokeStyle = rgba('#ff3a4a', pulse + 0.2);
        g.lineWidth = 2;
        g.beginPath();
        g.ellipse(w.x, w.y, w.w, w.w * 0.34, 0, 0, Math.PI * 2);
        g.stroke();
        // 垂直光柱提示
        g.fillStyle = rgba('#ff3a5a', 0.08 + prog * 0.18);
        g.fillRect(w.x - w.w * 0.35 * (1 - prog * 0.4), w.y - 260, w.w * 0.7 * (1 - prog * 0.4), 260);
      } else {
        // 全屏冲锋走廊预警
        g.fillStyle = rgba('#ff2a3a', 0.14 + prog * 0.22);
        g.fillRect(w.x, w.y, w.w, w.h);
        g.strokeStyle = rgba('#ff4a5a', pulse + 0.2);
        g.lineWidth = 2;
        g.strokeRect(w.x, w.y, w.w, w.h);
        // 滑动箭头提示方向
        const d = w.dir ?? 1;
        g.fillStyle = rgba('#ffd0d0', 0.55 + prog * 0.35);
        const shift = ((w.t * 140) % 48) * d;
        for (let ax = w.x + 24; ax < w.x + w.w - 24; ax += 48) {
          const px = ax + shift;
          if (px < w.x + 8 || px > w.x + w.w - 8) continue;
          const cy = w.y + w.h * 0.5;
          g.beginPath();
          g.moveTo(px + d * 10, cy);
          g.lineTo(px - d * 6, cy - 8);
          g.lineTo(px - d * 2, cy);
          g.lineTo(px - d * 6, cy + 8);
          g.closePath();
          g.fill();
        }
      }
      g.restore();
    }
  }

  drawAfterimages(g: Ctx) {
    for (const a of this.afterimages) {
      g.save();
      g.globalAlpha = (a.life / a.maxLife) * a.alpha;
      g.drawImage(a.img, Math.round(a.x), Math.round(a.y));
      g.restore();
    }
  }

  /** 绘制战场上层特效：斩击、光环、落雷、升级圣光柱、粒子 */
  drawWorldFx(g: Ctx) {
    // 升级圣光柱
    for (const lu of this.levelUps) {
      const p = 1 - lu.life / lu.maxLife;
      const fade = p < 0.15 ? p / 0.15 : p > 0.65 ? (1 - p) / 0.35 : 1;
      const w = 48 * (1 - p * 0.35) + Math.sin(p * 30) * 3;
      g.save();
      g.globalCompositeOperation = 'lighter';
      // 外层金色光柱
      const grd = g.createLinearGradient(lu.x - w, 0, lu.x + w, 0);
      grd.addColorStop(0, 'rgba(255,212,71,0)');
      grd.addColorStop(0.25, rgba('#ffd447', 0.45 * fade));
      grd.addColorStop(0.5, rgba('#fffbe0', 0.85 * fade));
      grd.addColorStop(0.75, rgba('#ffd447', 0.45 * fade));
      grd.addColorStop(1, 'rgba(255,212,71,0)');
      g.fillStyle = grd;
      g.fillRect(lu.x - w, lu.y - 420, w * 2, 424);
      // 脚下金色法阵光环
      g.strokeStyle = rgba('#ffe46a', 0.9 * fade);
      g.lineWidth = 2;
      g.beginPath();
      g.ellipse(lu.x, lu.y, 26 + p * 34, 8 + p * 10, 0, 0, Math.PI * 2);
      g.stroke();
      radial(g, lu.x, lu.y - 18, 65, rgba('#ffd447', 0.55 * fade));
      g.restore();
    }

    // 斩击弧光
    for (const s of this.slashes) {
      const t = 1 - s.life / s.maxLife;
      const a = 1 - t;
      g.save();
      g.translate(s.x, s.y);
      if (s.dir < 0 && !s.full) g.scale(-1, 1);
      g.globalAlpha = a;
      g.lineCap = 'round';
      g.strokeStyle = s.color;
      g.lineWidth = s.thick * (1 - t * 0.4);
      g.beginPath();
      const rot = s.full ? t * Math.PI * 3 * s.dir : 0;
      g.arc(0, 0, s.r, s.startAng + rot, s.endAng + rot);
      g.stroke();
      g.strokeStyle = s.core;
      g.lineWidth = Math.max(1.5, s.thick * 0.4 * (1 - t * 0.4));
      g.beginPath();
      g.arc(0, 0, s.r, s.startAng + rot + 0.1, s.endAng + rot - 0.1);
      g.stroke();
      g.restore();
    }

    // 冲击波圆环
    for (const r of this.rings) {
      g.save();
      g.globalAlpha = r.life / r.maxLife;
      g.strokeStyle = r.color;
      g.lineWidth = r.thick * (r.life / r.maxLife);
      g.beginPath();
      g.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    }

    // 暗影落雷
    for (const b of this.bolts) {
      const a = b.life / b.maxLife;
      g.save();
      g.globalAlpha = a;
      g.lineJoin = 'round';
      g.strokeStyle = b.color;
      g.lineWidth = b.width * a;
      g.beginPath();
      b.pts.forEach(([px, py], i) => (i === 0 ? g.moveTo(px, py) : g.lineTo(px, py)));
      g.stroke();
      g.strokeStyle = '#ffffff';
      g.lineWidth = Math.max(2, b.width * 0.4 * a);
      g.stroke();
      g.restore();
    }

    // 战斗粒子
    this.drawParticleList(g, this.particles);
  }

  drawAmbient(g: Ctx) {
    this.drawParticleList(g, this.ambient);
  }

  private drawParticleList(g: Ctx, list: Particle[]) {
    for (const p of list) {
      const ratio = clamp(p.life / p.maxLife, 0, 1);
      const al = (p.alpha ?? 1) * (p.shape === 'petal' ? Math.min(1, ratio * 3) : ratio);
      if (al <= 0.02) continue;
      g.save();
      g.globalAlpha = al;
      if (p.glow) {
        g.fillStyle = rgba(p.color, 0.35);
        g.beginPath();
        g.arc(p.x, p.y, p.size * 2.1, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = p.color;
      if (p.shape === 'circle') {
        g.beginPath();
        g.arc(p.x, p.y, p.size * 0.65, 0, Math.PI * 2);
        g.fill();
      } else if (p.shape === 'star') {
        const s = Math.max(1, Math.round(p.size));
        const px = Math.round(p.x), py = Math.round(p.y);
        g.fillRect(px - s, py, s * 2 + 1, 1);
        g.fillRect(px, py - s, 1, s * 2 + 1);
      } else if (p.shape === 'spark') {
        g.strokeStyle = p.color;
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(p.x, p.y);
        g.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
        g.stroke();
      } else if (p.shape === 'petal') {
        g.translate(p.x, p.y);
        g.rotate(p.rot ?? 0);
        g.fillRect(-p.size * 0.6, -p.size * 0.35, p.size * 1.2, p.size * 0.7);
      } else {
        const s = Math.max(1, Math.round(p.size));
        g.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
      }
      g.restore();
    }
  }

  /** 伤害数字与 LEVEL UP 特效字（最顶层世界空间） */
  drawNumbers(g: Ctx) {
    for (const n of this.nums) {
      const age = 1 - n.life / n.maxLife;
      let sc = n.baseScale;
      if (age < 0.18) sc *= easeOutBack(age / 0.18);
      else if (n.crit && age < 0.35) sc *= 1 + Math.sin(((age - 0.18) / 0.17) * Math.PI) * 0.18;
      const alpha = age > 0.7 ? (1 - age) / 0.3 : 1;
      g.save();
      g.globalAlpha = clamp(alpha, 0, 1);
      if (n.crit) {
        // 暴击金色星芒底晕
        radial(g, n.x, n.y, 16 * (sc / 2), 'rgba(255,215,50,0.4)');
      }
      bitmapText(g, n.text, n.x, n.y, sc, n.style, 0.5);
      g.restore();
    }
    // LEVEL UP! 像素特效字
    for (const lu of this.levelUps) {
      const p = 1 - lu.life / lu.maxLife;
      const sc = p < 0.15 ? 2.4 * easeOutBack(p / 0.15) : 2.4 + Math.sin(p * 14) * 0.08;
      const fade = p > 0.75 ? (1 - p) / 0.25 : 1;
      const ty = lu.y - 68 - easeOutCubic(Math.min(1, p * 1.4)) * 22;
      g.save();
      g.globalAlpha = clamp(fade, 0, 1);
      bitmapText(g, 'LEVEL UP!', lu.x, ty, sc, 'gold', 0.5);
      bitmapText(g, `LV.${lu.level}`, lu.x, ty + 18, 1.35, 'white', 0.5);
      g.restore();
    }
  }
}
