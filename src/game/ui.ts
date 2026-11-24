// 经典 RPG 界面系统（原生 1280x720 高清文字 + 像素风格边框）：
// 底部状态栏 + 超长分段 EXP 条、右上迷你地图、主线任务追踪、Boss 血条、背包装备、铁匠商店、NPC 对话、标题与通关结算
import { Ctx, rgba } from '../gfx/pixel';
import { VIEW_W, VIEW_H } from '../gfx/backgrounds';
import { itemIcon, RARITY_COLORS } from '../gfx/world';
import { heroSprites, npcSprites, JOB_COLORS } from '../gfx/characters';
import { bitmapText } from '../gfx/font';
import {
  JOBS, JOB_ORDER, JobId, expToNext, Item, Slot, RARITY_NAMES, SLOT_NAMES,
  itemAtk, displayName, itemScore, enhanceCost, QUESTS, SHARDS_NEEDED, genItem, rollRarity,
} from './data';
import type { MapDef } from './maps';
import type { Player } from './player';
import type { Enemy, Chest } from './entities';
import type { Effects } from './effects';
import type { Input } from '../core/input';
import { audio } from '../core/audio';
import { clamp, formatTime } from '../core/utils';

export const UI_SCALE = 2; // 640x360 逻辑坐标 -> 1280x720 画布分辨率
const FONT = '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", system-ui, sans-serif';

export type ModalState =
  | null
  | { kind: 'title'; hasSave: boolean; showHelp: boolean }
  | { kind: 'inventory'; sel: number }
  | { kind: 'dialog'; speaker: string; portrait: 'elder' | 'smith' | 'princess' | 'sign'; lines: string[]; idx: number; actions?: { label: string; fn: () => void }[] }
  | { kind: 'shop'; tab: 0 | 1 | 2; stock: Item[]; msg: string; msgT: number }
  | { kind: 'pause' }
  | { kind: 'dead'; timer: number }
  | { kind: 'victory'; time: number; stage: 'cutscene' | 'summary'; lineIdx: number };

export interface UIActions {
  startNew: () => void;
  continueSave: () => void;
  closeModal: () => void;
  openInventory: () => void;
  openPause: () => void;
  returnTown: () => void;
  saveNow: () => void;
  revive: () => void;
  continueFreePlay: () => void;
  backToTitle: () => void;
  openShop: () => void;
}

// ======================== 基础高清绘制辅助（全部使用 640x360 逻辑坐标） ========================
function S(v: number) { return Math.round(v * UI_SCALE); }

function panel(g: Ctx, x: number, y: number, w: number, h: number, bg = 'rgba(18,14,34,0.9)', border = '#cfa252', inner = '#4a3d6e') {
  const X = S(x), Y = S(y), W = S(w), H = S(h);
  g.fillStyle = '#0a0714';
  g.fillRect(X - 2, Y - 2, W + 4, H + 4);
  g.fillStyle = border;
  g.fillRect(X, Y, W, H);
  g.fillStyle = inner;
  g.fillRect(X + 2, Y + 2, W - 4, H - 4);
  g.fillStyle = bg;
  g.fillRect(X + 4, Y + 4, W - 8, H - 8);
}

function txt(
  g: Ctx,
  text: string,
  x: number,
  y: number,
  size: number,
  color = '#ffffff',
  align: CanvasTextAlign = 'left',
  bold = false,
  shadow = true,
) {
  g.save();
  g.font = `${bold ? 'bold ' : ''}${Math.round(size * UI_SCALE)}px ${FONT}`;
  g.textAlign = align;
  g.textBaseline = 'middle';
  const X = Math.round(x * UI_SCALE), Y = Math.round(y * UI_SCALE);
  if (shadow) {
    g.fillStyle = 'rgba(8,4,18,0.88)';
    g.fillText(text, X + 2, Y + 2);
  }
  g.fillStyle = color;
  g.fillText(text, X, Y);
  g.restore();
}

function hit(mx: number, my: number, x: number, y: number, w: number, h: number) {
  return mx >= x && mx <= x + w && my >= y && my <= y + h;
}

function button(
  g: Ctx,
  mx: number,
  my: number,
  clicked: boolean,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  accent = '#4a7ae0',
  disabled = false,
): boolean {
  const hov = !disabled && hit(mx, my, x, y, w, h);
  const bg = disabled ? '#2b283a' : hov ? '#463a72' : '#261f42';
  const bd = disabled ? '#5a5670' : hov ? '#ffe070' : accent;
  panel(g, x, y, w, h, bg, bd, disabled ? '#343045' : '#3a2f5e');
  txt(g, label, x + w / 2, y + h / 2 + 0.5, 8.5, disabled ? '#88849a' : hov ? '#fff8d0' : '#f0eef8', 'center', true);
  return hov && clicked;
}

/** 绘制技能小图标（纯程序化向量像素） */
function drawSkillGlyph(g: Ctx, kind: string, x: number, y: number, s: number) {
  const X = S(x), Y = S(y), Z = S(s);
  const cx = X + Z / 2, cy = Y + Z / 2;
  g.save();
  if (kind === 'atk_sword') {
    g.strokeStyle = '#ffd447'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(cx - 12, cy + 12); g.lineTo(cx + 12, cy - 12); g.stroke();
    g.strokeStyle = '#ffffff'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(cx - 10, cy + 10); g.lineTo(cx + 12, cy - 12); g.stroke();
  } else if (kind === 'atk_mage') {
    g.fillStyle = '#b88aff'; g.beginPath(); g.arc(cx, cy, 10, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(cx - 2, cy - 2, 4, 0, Math.PI * 2); g.fill();
  } else if (kind === 'atk_ranger') {
    g.strokeStyle = '#6af09a'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(cx - 12, cy + 6); g.lineTo(cx + 12, cy - 6); g.stroke();
    g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(cx + 14, cy - 7); g.lineTo(cx + 6, cy - 9); g.lineTo(cx + 9, cy - 1); g.fill();
  } else if (kind === 'whirl') {
    g.strokeStyle = '#5cc8ff'; g.lineWidth = 4;
    g.beginPath(); g.arc(cx, cy, 11, 0, Math.PI * 1.45); g.stroke();
    g.strokeStyle = '#ffd447'; g.lineWidth = 3;
    g.beginPath(); g.arc(cx, cy, 6, Math.PI, Math.PI * 2.4); g.stroke();
  } else if (kind === 'charge') {
    g.fillStyle = '#ffd447';
    g.beginPath(); g.moveTo(cx + 14, cy); g.lineTo(cx - 4, cy - 10); g.lineTo(cx, cy); g.lineTo(cx - 4, cy + 10); g.closePath(); g.fill();
    g.strokeStyle = '#fff8c0'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(cx - 14, cy - 4); g.lineTo(cx - 4, cy - 4); g.moveTo(cx - 12, cy + 4); g.lineTo(cx - 4, cy + 4); g.stroke();
  } else if (kind === 'meteor') {
    g.fillStyle = '#ff6a2a'; g.beginPath(); g.arc(cx + 4, cy + 4, 9, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffd447'; g.beginPath(); g.arc(cx + 3, cy + 3, 5, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#ff9a4a'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(cx - 13, cy - 13); g.lineTo(cx, cy); g.stroke();
  } else if (kind === 'blink') {
    g.strokeStyle = '#c07dff'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(cx - 12, cy); g.lineTo(cx + 12, cy); g.stroke();
    g.fillStyle = '#7fe0ff';
    g.beginPath(); g.moveTo(cx + 6, cy - 11); g.lineTo(cx + 10, cy); g.lineTo(cx + 6, cy + 11); g.lineTo(cx + 2, cy); g.closePath(); g.fill();
  } else if (kind === 'rain') {
    g.strokeStyle = '#6af09a'; g.lineWidth = 2.5;
    for (const dx of [-8, 0, 8]) {
      g.beginPath(); g.moveTo(cx + dx + 3, cy - 11); g.lineTo(cx + dx - 3, cy + 11); g.stroke();
    }
  } else if (kind === 'backshot') {
    g.strokeStyle = '#6af09a'; g.lineWidth = 2.5;
    for (const dy of [-7, 0, 7]) {
      g.beginPath(); g.moveTo(cx - 10, cy); g.lineTo(cx + 12, cy + dy); g.stroke();
    }
  }
  g.restore();
}

// ======================== HUD 绘制与交互 ========================
export class GameUI {
  modal: ModalState = null;
  bannerText = '';
  bannerSub = '';
  bannerTimer = 0;

  showBanner(name: string, sub: string) {
    this.bannerText = name;
    this.bannerSub = sub;
    this.bannerTimer = 2.8;
  }

  hasBetterGear(player: Player): boolean {
    for (const it of player.bag) {
      if (itemScore(it) > itemScore(player.equip[it.slot]) + 1) return true;
    }
    return false;
  }

  /** 渲染游戏内常规 HUD（底部状态栏、迷你地图、任务、Boss 血条、拾取提示、地图横幅） */
  drawHUD(
    g: Ctx,
    player: Player,
    map: MapDef,
    enemies: Enemy[],
    chest: Chest | null,
    fx: Effects,
    questIdx: number,
    questProg: number,
    input: Input,
    actions: UIActions,
    t: number,
  ) {
    const st = player.stats();
    const mx = input.mouse.x, my = input.mouse.y;
    const click = this.modal === null && input.mouse.clicked;

    // 1. 地图进入横幅
    if (this.bannerTimer > 0) {
      const a = this.bannerTimer > 2.4 ? (2.8 - this.bannerTimer) / 0.4 : this.bannerTimer < 0.6 ? this.bannerTimer / 0.6 : 1;
      g.save();
      g.globalAlpha = clamp(a, 0, 1);
      const grd = g.createLinearGradient(S(160), 0, S(480), 0);
      grd.addColorStop(0, 'rgba(18,12,34,0)');
      grd.addColorStop(0.2, 'rgba(18,12,34,0.82)');
      grd.addColorStop(0.8, 'rgba(18,12,34,0.82)');
      grd.addColorStop(1, 'rgba(18,12,34,0)');
      g.fillStyle = grd;
      g.fillRect(S(160), S(42), S(320), S(34));
      g.fillStyle = 'rgba(255,212,71,0.75)';
      g.fillRect(S(210), S(42), S(220), 2);
      g.fillRect(S(210), S(75), S(220), 2);
      txt(g, this.bannerText, 320, 54, 13, '#ffe890', 'center', true);
      txt(g, this.bannerSub, 320, 68, 7.5, '#d0d8f8', 'center', false);
      g.restore();
    }

    // 2. Boss 独立血条
    const boss = enemies.find((e) => e.kind === 'boss' && e.alive);
    if (boss) {
      const bx = 148, by = 8, bw = 344, bh = 26;
      panel(g, bx, by, bw, bh, 'rgba(20,8,30,0.92)', boss.bossPhase === 2 ? '#ff4a6a' : '#cfa252', '#4a1c5e');
      txt(g, `暗影魔王·莫德雷德  Lv.15${boss.bossPhase === 2 ? '  [狂暴]' : ''}`, bx + 8, by + 8, 8.5, boss.bossPhase === 2 ? '#ff8aa0' : '#ffe090', 'left', true);
      txt(g, `${Math.ceil(boss.hp)} / ${boss.maxHp}`, bx + bw - 8, by + 8, 7.5, '#ffd0e0', 'right', true);
      const barX = bx + 6, barY = by + 15, barW = bw - 12, barH = 7;
      g.fillStyle = '#1a081e';
      g.fillRect(S(barX), S(barY), S(barW), S(barH));
      // 延迟掉血白条
      g.fillStyle = '#ffd0d8';
      g.fillRect(S(barX), S(barY), S(barW * (boss.hpLag / boss.maxHp)), S(barH));
      // 血条渐变
      const bgrd = g.createLinearGradient(S(barX), 0, S(barX + barW), 0);
      bgrd.addColorStop(0, boss.bossPhase === 2 ? '#ff2050' : '#a020d8');
      bgrd.addColorStop(1, boss.bossPhase === 2 ? '#ff8a30' : '#ff3a6a');
      g.fillStyle = bgrd;
      g.fillRect(S(barX), S(barY), S(barW * (boss.hp / boss.maxHp)), S(barH));
      // 50% 阶段分割线
      g.fillStyle = '#ffd447';
      g.fillRect(S(barX + barW * 0.5), S(barY) - 1, 2, S(barH) + 2);
    }

    // 3. 右上角迷你地图
    this.drawMinimap(g, player, map, enemies, chest, t);

    // 4. 主线任务追踪
    this.drawQuestTracker(g, player, questIdx, questProg);

    // 5. 右下拾取提示（HUD 上方）
    for (let i = 0; i < fx.toasts.length; i++) {
      const m = fx.toasts[i];
      const al = clamp(m.life / 0.6, 0, 1);
      const y = 300 - (fx.toasts.length - 1 - i) * 13;
      g.save();
      g.globalAlpha = al;
      const w = Math.min(230, m.text.length * 8 + 18);
      g.fillStyle = 'rgba(14,10,28,0.75)';
      g.fillRect(S(636 - w), S(y - 6), S(w), S(11));
      txt(g, m.text, 632, y - 0.5, 7.5, m.color, 'right', false);
      g.restore();
    }

    // 6. 底部经典 RPG 横条状态栏
    const hy = 310;
    panel(g, 0, hy, VIEW_W, 50, 'rgba(17,15,34,0.95)', '#c89b4b', '#3a325c');

    // --- 左侧：等级与职业（可点击 1/2/3 切换） ---
    panel(g, 5, hy + 4, 108, 34, 'rgba(28,24,52,0.95)', JOB_COLORS[player.job], '#221c3c');
    // 等级徽章
    g.fillStyle = '#ffd447';
    g.fillRect(S(8), S(hy + 7), S(28), S(12));
    txt(g, `Lv.${player.level}`, 22, hy + 13.5, 7.5, '#2a1606', 'center', true, false);
    txt(g, JOBS[player.job].name, 40, hy + 13.5, 8.5, '#ffffff', 'left', true);
    // 1/2/3 职业快切小钮
    JOB_ORDER.forEach((jid, idx) => {
      const bx = 8 + idx * 34, by = hy + 22, bw = 32, bh = 13;
      const active = player.job === jid;
      const hov = this.modal === null && hit(mx, my, bx, by, bw, bh);
      g.fillStyle = active ? JOB_COLORS[jid] : hov ? '#483e72' : '#1b1632';
      g.fillRect(S(bx), S(by), S(bw), S(bh));
      g.strokeStyle = active ? '#fff2a0' : '#4a426e';
      g.lineWidth = 1.5;
      g.strokeRect(S(bx), S(by), S(bw), S(bh));
      txt(g, `${idx + 1}${JOBS[jid].short}`, bx + bw / 2, by + bh / 2 + 0.5, 6.8, active ? '#120820' : '#c8c4e0', 'center', active, !active);
      if (hov && click) player.switchJob(jid, fx);
    });

    // --- 中左：HP 血条 & MP 蓝条 ---
    const bx = 118, bw = 172;
    // HP
    this.drawResourceBar(g, bx, hy + 6, bw, 14, player.hp, player.hpLag, st.maxHp, '#e8344a', '#ff7a7a', 'HP');
    // MP
    this.drawResourceBar(g, bx, hy + 23, bw, 14, player.mp, player.mp, st.maxMp, '#2c78e8', '#7ac4ff', 'MP');

    // --- 中右：技能冷却 & 药水快捷键栏 ---
    const job = JOBS[player.job];
    const slotY = hy + 5;
    const slotS = 32;
    const drawSlot = (
      sx: number,
      keyLabel: string,
      glyph: string | 'hp' | 'mp' | 'bag',
      cd = 0,
      maxCd = 1,
      sub = '',
      badge = '',
      highlight = false,
      onClick?: () => void,
    ) => {
      const hov = this.modal === null && hit(mx, my, sx, slotY, slotS, slotS);
      panel(g, sx, slotY, slotS, slotS, hov ? '#382f62' : '#1b1734', highlight ? '#ffd447' : hov ? '#a0d8ff' : '#6c6294', '#2c2548');
      if (glyph === 'hp' || glyph === 'mp') {
        g.imageSmoothingEnabled = false;
        g.drawImage(itemIcon(glyph), S(sx + 6), S(slotY + 5), S(20), S(20));
      } else if (glyph === 'bag') {
        g.imageSmoothingEnabled = false;
        g.drawImage(itemIcon('chest'), S(sx + 6), S(slotY + 5), S(20), S(20));
        if (highlight) {
          g.fillStyle = '#ffd447';
          g.beginPath(); g.arc(S(sx + slotS - 5), S(slotY + 5), 5, 0, Math.PI * 2); g.fill();
        }
      } else {
        drawSkillGlyph(g, glyph, sx + 3, slotY + 3, slotS - 6);
      }
      // 冷却遮罩与数字倒计时
      if (cd > 0) {
        const ratio = clamp(cd / Math.max(0.01, maxCd), 0, 1);
        g.fillStyle = 'rgba(8,5,20,0.72)';
        g.fillRect(S(sx + 2), S(slotY + 2 + (slotS - 4) * (1 - ratio)), S(slotS - 4), S((slotS - 4) * ratio));
        txt(g, cd >= 1 ? cd.toFixed(1) : cd.toFixed(1), sx + slotS / 2, slotY + slotS / 2, 9.5, '#ffe070', 'center', true);
      }
      // 键位角标
      g.fillStyle = 'rgba(10,8,22,0.85)';
      g.fillRect(S(sx + 2), S(slotY + 2), S(10), S(9));
      txt(g, keyLabel, sx + 7, slotY + 6.5, 6.5, '#ffd870', 'center', true, false);
      if (sub) txt(g, sub, sx + slotS - 2, slotY + slotS - 5, 6, '#90d0ff', 'right', false);
      if (badge) txt(g, badge, sx + slotS - 2, slotY + slotS - 5, 7, '#ffffff', 'right', true);
      if (hov && click && onClick) onClick();
    };

    drawSlot(298, 'A', `atk_${player.job}`, 0, 1, '普攻');
    drawSlot(334, 'Q', job.skills[0].icon, player.cdQ, job.skills[0].cd, `${job.skills[0].mp}M`);
    drawSlot(370, 'W', job.skills[1].icon, player.cdW, job.skills[1].cd, `${job.skills[1].mp}M`);
    drawSlot(410, 'Z', 'hp', 0, 1, '', `×${player.potHp}`, false, () => player.usePotion('hp', fx));
    drawSlot(446, 'X', 'mp', 0, 1, '', `×${player.potMp}`, false, () => player.usePotion('mp', fx));
    drawSlot(486, 'I', 'bag', 0, 1, '', '背包', this.hasBetterGear(player), () => actions.openInventory());

    // --- 右侧：金币、星辉碎片、静音与菜单 ---
    g.imageSmoothingEnabled = false;
    g.drawImage(itemIcon('gold'), S(524), S(hy + 6), S(12), S(12));
    txt(g, `${player.gold}`, 539, hy + 12.5, 8.5, '#ffd84a', 'left', true);
    g.drawImage(itemIcon('shard'), S(524), S(hy + 22), S(12), S(12));
    txt(g, `${player.shards}/${SHARDS_NEEDED}`, 539, hy + 28.5, 8.5, '#7ff8ff', 'left', true);

    if (button(g, mx, my, click, 586, hy + 5, 22, 14, audio.muted ? '静' : '音', '#6a5a9a')) audio.toggleMute();
    if (button(g, mx, my, click, 610, hy + 5, 25, 14, '菜单', '#6a5a9a')) actions.openPause();
    txt(g, '↑互动/传送', 610, hy + 28.5, 6.5, '#b8b4d8', 'center', false);

    // --- 最底部：经典超长 10 段式 EXP 经验条 ---
    const ey = 350, eh = 10;
    const need = expToNext(player.level);
    const expPct = clamp(player.exp / need, 0, 1);
    g.fillStyle = '#0c0818';
    g.fillRect(0, S(ey), S(VIEW_W), S(eh));
    const egrd = g.createLinearGradient(0, S(ey), 0, S(ey + eh));
    egrd.addColorStop(0, '#fff080');
    egrd.addColorStop(0.5, '#f0b820');
    egrd.addColorStop(1, '#c87808');
    g.fillStyle = egrd;
    g.fillRect(2, S(ey) + 2, Math.round((S(VIEW_W) - 4) * expPct), S(eh) - 4);
    // 10 等分刻度
    g.fillStyle = 'rgba(12,8,24,0.55)';
    for (let i = 1; i < 10; i++) g.fillRect(Math.round((S(VIEW_W) * i) / 10), S(ey) + 2, 2, S(eh) - 4);
    txt(g, `EXP  ${player.exp} / ${need}  (${(expPct * 100).toFixed(1)}%)`, VIEW_W / 2, ey + eh / 2 + 0.5, 6.8, '#ffffff', 'center', true);
  }

  private drawResourceBar(g: Ctx, x: number, y: number, w: number, h: number, val: number, lag: number, max: number, col: string, hi: string, label: string) {
    const X = S(x), Y = S(y), W = S(w), H = S(h);
    g.fillStyle = '#0d091c';
    g.fillRect(X, Y, W, H);
    g.strokeStyle = '#645c8a';
    g.lineWidth = 2;
    g.strokeRect(X, Y, W, H);
    const iw = W - 4, ih = H - 4;
    const lagR = clamp(lag / Math.max(1, max), 0, 1);
    const valR = clamp(val / Math.max(1, max), 0, 1);
    if (lagR > valR) {
      g.fillStyle = '#ffe0e0';
      g.fillRect(X + 2, Y + 2, Math.round(iw * lagR), ih);
    }
    const gr = g.createLinearGradient(0, Y + 2, 0, Y + 2 + ih);
    gr.addColorStop(0, hi);
    gr.addColorStop(0.45, col);
    gr.addColorStop(1, col);
    g.fillStyle = gr;
    g.fillRect(X + 2, Y + 2, Math.round(iw * valR), ih);
    g.fillStyle = 'rgba(255,255,255,0.28)';
    g.fillRect(X + 2, Y + 2, Math.round(iw * valR), Math.max(2, ih * 0.3));
    txt(g, label, x + 5, y + h / 2 + 0.5, 7.2, '#fff0b0', 'left', true);
    txt(g, `${Math.ceil(val)} / ${max}`, x + w / 2 + 8, y + h / 2 + 0.5, 7.5, '#ffffff', 'center', true);
  }

  private drawMinimap(g: Ctx, player: Player, map: MapDef, enemies: Enemy[], chest: Chest | null, t: number) {
    const mw = 136, mh = 68, mx = VIEW_W - mw - 6, my = 6;
    panel(g, mx, my, mw, mh, 'rgba(12,10,26,0.82)', '#b89450', '#383058');
    txt(g, `${map.name} (${map.rec})`, mx + mw / 2, my + 8.5, 7, '#ffe898', 'center', true);
    const ix = mx + 6, iy = my + 16, iw = mw - 12, ih = mh - 21;
    const sx = iw / map.width, sy = ih / map.height;
    g.fillStyle = 'rgba(24,20,44,0.85)';
    g.fillRect(S(ix), S(iy), S(iw), S(ih));
    // 平台
    for (const p of map.platforms) {
      g.fillStyle = p.solid ? '#5a8a62' : '#9a7a58';
      g.fillRect(S(ix + p.x * sx), S(iy + p.y * sy), Math.max(3, S(p.w * sx)), p.solid ? 4 : 2);
    }
    // 绳索
    g.fillStyle = '#c8a86a';
    for (const r of map.ropes) {
      g.fillRect(S(ix + r.x * sx), S(iy + r.top * sy), 2, Math.max(3, S((r.bottom - r.top) * sy)));
    }
    // 传送门
    for (const po of map.portals) {
      const locked = po.locked && player.shards < SHARDS_NEEDED;
      g.fillStyle = locked ? '#ff5a6a' : '#5ce8ff';
      g.beginPath();
      g.arc(S(ix + po.x * sx), S(iy + (po.y - 12) * sy), 4.5, 0, Math.PI * 2);
      g.fill();
    }
    // NPC
    g.fillStyle = '#6af08a';
    for (const n of map.npcs) {
      g.fillRect(S(ix + n.x * sx) - 2, S(iy + (n.y - 12) * sy) - 2, 5, 5);
    }
    // 宝箱
    if (chest && !chest.opened) {
      g.fillStyle = Math.floor(t * 6) % 2 ? '#ffd447' : '#ffffff';
      g.fillRect(S(ix + chest.x * sx) - 3, S(iy + (chest.y - 10) * sy) - 3, 6, 6);
    }
    // 怪物
    for (const e of enemies) {
      if (!e.alive) continue;
      if (e.kind === 'boss') {
        g.fillStyle = '#ff3070';
        g.beginPath(); g.arc(S(ix + e.x * sx), S(iy + (e.y - 30) * sy), 6, 0, Math.PI * 2); g.fill();
      } else {
        g.fillStyle = '#ff5a5a';
        g.fillRect(S(ix + e.x * sx) - 2, S(iy + (e.y - 10) * sy) - 2, 4, 4);
      }
    }
    // 玩家（脉动黄点）
    const pulse = 4 + Math.sin(t * 9) * 1.2;
    g.fillStyle = '#fff050';
    g.beginPath();
    g.arc(S(ix + player.x * sx), S(iy + (player.y - 14) * sy), pulse, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#180820';
    g.lineWidth = 1.5;
    g.stroke();
  }

  private drawQuestTracker(g: Ctx, player: Player, questIdx: number, questProg: number) {
    const q = QUESTS[clamp(questIdx, 0, QUESTS.length - 1)];
    const qw = 136, qh = 46, qx = VIEW_W - qw - 6, qy = 78;
    panel(g, qx, qy, qw, qh, 'rgba(14,12,30,0.8)', '#8c74b0', '#2a2248');
    txt(g, `★ ${q.title}`, qx + 6, qy + 9, 7.5, '#ffd860', 'left', true);
    let obj = q.desc;
    if (q.type === 'kill' && q.count) obj += ` (${Math.min(questProg, q.count)}/${q.count})`;
    else if (q.type === 'boss') obj = `星辉碎片 (${player.shards}/${SHARDS_NEEDED}) · 击败魔王`;
    txt(g, obj, qx + 6, qy + 22, 6.8, '#eef2ff', 'left', false);
    txt(g, q.hint, qx + 6, qy + 34, 6.2, '#9cb8e8', 'left', false);
  }

  // ======================== 弹窗与全屏界面 ========================
  updateAndDrawModal(g: Ctx, player: Player, input: Input, fx: Effects, actions: UIActions, t: number) {
    const m = this.modal;
    if (!m) return;
    if (m.kind === 'title') this.drawTitle(g, m, input, actions, t);
    else if (m.kind === 'inventory') this.drawInventory(g, m, player, input, fx, actions, t);
    else if (m.kind === 'dialog') this.drawDialog(g, m, input, actions, t);
    else if (m.kind === 'shop') this.drawShop(g, m, player, input, fx, actions);
    else if (m.kind === 'pause') this.drawPause(g, input, actions);
    else if (m.kind === 'dead') this.drawDead(g, m, input, actions);
    else if (m.kind === 'victory') this.drawVictory(g, m, player, input, actions, t);
  }

  private drawTitle(g: Ctx, m: Extract<ModalState, { kind: 'title' }>, input: Input, actions: UIActions, t: number) {
    // 半透明光晕罩层（透出后方动态视差晨风镇）
    const gr = g.createLinearGradient(0, 0, 0, S(VIEW_H));
    gr.addColorStop(0, 'rgba(14,10,36,0.45)');
    gr.addColorStop(0.55, 'rgba(18,12,42,0.28)');
    gr.addColorStop(1, 'rgba(12,8,28,0.75)');
    g.fillStyle = gr;
    g.fillRect(0, 0, S(VIEW_W), S(VIEW_H));

    // 主标题（带轻微悬浮与金辉）
    const ty = 78 + Math.sin(t * 2.2) * 3;
    g.save();
    g.fillStyle = 'rgba(255,212,71,0.2)';
    g.beginPath();
    g.ellipse(S(320), S(ty), S(160), S(42), 0, 0, Math.PI * 2);
    g.fill();
    g.restore();

    txt(g, '星 辉 物 语', 320, ty - 6, 30, '#ffe87a', 'center', true);
    g.save();
    g.scale(UI_SCALE, UI_SCALE);
    bitmapText(g, 'STARLIGHT STORY', 320, ty + 24, 1.8, 'white', 0.5);
    g.restore();
    txt(g, '2D 横版像素风动作角色扮演游戏 · 纯代码程序化美术与 8-bit 音效', 320, ty + 44, 8, '#d8e4ff', 'center', false);

    // 三职业王子动态预览
    JOB_ORDER.forEach((jid, i) => {
      const sp = heroSprites(jid, i + 2);
      const fr = sp.idle[Math.floor(t * 3 + i) % sp.idle.length];
      g.imageSmoothingEnabled = false;
      g.drawImage(fr.r, S(244 + i * 52), S(142), S(48), S(48));
    });

    const mx = input.mouse.x, my = input.mouse.y, click = input.mouse.clicked;
    if (m.showHelp) {
      panel(g, 130, 146, 380, 174, 'rgba(16,12,34,0.96)', '#ffd447', '#4a3d72');
      txt(g, '操作指南与玩法说明', 320, 163, 11, '#ffe47a', 'center', true);
      const tips = [
        '移动 / 攀爬：方向键 ← → ↑ ↓  |  跳跃 / 二段空中冲刺：Space / C',
        '穿透薄平台：↓ + Space  |  对话 / 进传送门 / 开宝箱：↑',
        '普攻连击：A / J / Ctrl  |  职业技能：Q、W  |  喝红/蓝药：Z、X',
        '随时自由切职业：数字键 1(剑士)  2(法师)  3(游侠)',
        '背包与换装：I / B  |  静音：M  |  暂停与帮助：Esc / P',
        '主线目标：集齐 3 枚星辉碎片，登上蚀月高塔击败魔王拯救公主！',
      ];
      tips.forEach((line, i) => txt(g, line, 148, 186 + i * 17, 7.8, i === 5 ? '#ffd870' : '#e4ecff', 'left'));
      if (button(g, mx, my, click, 270, 294, 100, 20, '返回', '#cfa252') || input.pressed('cancel')) {
        audio.sfx('click');
        m.showHelp = false;
      }
      return;
    }

    const bx = 250, bw = 140;
    let by = 204;
    let trigger: 'continue' | 'new' | 'help' | null = null;
    if (m.hasSave) {
      if (button(g, mx, my, click, bx, by, bw, 24, '继续冒险', '#ffd447') || input.pressed('confirm')) trigger = 'continue';
      by += 30;
    }
    if (button(g, mx, my, click, bx, by, bw, 24, m.hasSave ? '新的冒险' : '开始冒险', '#5cb8ff') || (!m.hasSave && input.pressed('confirm'))) {
      if (!trigger) trigger = 'new';
    }
    by += 30;
    if (button(g, mx, my, click, bx, by, bw, 22, '操作说明', '#9a7ad8')) {
      if (!trigger) trigger = 'help';
    }
    txt(g, '按 Enter / 点击开始冒险 · 进度自动保存', 320, 336, 7.5, '#b8c4e8', 'center');

    if (trigger === 'continue') { audio.sfx('select'); input.consumeAll(); actions.continueSave(); }
    else if (trigger === 'new') { audio.sfx('select'); input.consumeAll(); actions.startNew(); }
    else if (trigger === 'help') { audio.sfx('click'); input.consumeAll(); m.showHelp = true; }
  }

  private drawInventory(g: Ctx, m: Extract<ModalState, { kind: 'inventory' }>, player: Player, input: Input, fx: Effects, actions: UIActions, t: number) {
    g.fillStyle = 'rgba(8,6,18,0.68)';
    g.fillRect(0, 0, S(VIEW_W), S(VIEW_H));
    const px = 48, py = 24, pw = 544, ph = 282;
    panel(g, px, py, pw, ph, 'rgba(18,15,36,0.97)', '#d8ae58', '#443868');
    txt(g, '角色装备与背包', px + 14, py + 15, 11, '#ffe480', 'left', true);
    txt(g, `金币: ${player.gold} G   星辉碎片: ${player.shards}/${SHARDS_NEEDED}`, px + pw - 58, py + 15, 8.2, '#ffd870', 'right', true);

    const mx = input.mouse.x, my = input.mouse.y, click = input.mouse.clicked;
    if (button(g, mx, my, click, px + pw - 46, py + 6, 38, 17, '关闭', '#a05a6a') || input.pressed('inventory') || input.pressed('cancel')) {
      audio.sfx('click');
      actions.closeModal();
      return;
    }

    // 左侧：角色预览 + 属性 + 3 装备栏
    panel(g, px + 10, py + 30, 198, 240, 'rgba(24,20,48,0.9)', '#5c4e8a', '#2c244a');
    // 角色动态精灵
    const sp = heroSprites(player.job, player.weaponTier());
    const fr = sp.idle[Math.floor(t * 3) % sp.idle.length];
    g.imageSmoothingEnabled = false;
    g.drawImage(fr.r, S(px + 20), S(py + 36), S(56), S(56));
    const st = player.stats();
    txt(g, `星辉王子  Lv.${player.level}`, px + 84, py + 45, 9, '#fff0a0', 'left', true);
    txt(g, JOBS[player.job].name, px + 84, py + 58, 8, JOB_COLORS[player.job], 'left', true);
    txt(g, `攻击: ${st.atk}   防御: ${st.def}`, px + 84, py + 72, 7.5, '#eef2ff', 'left');
    txt(g, `暴击: ${Math.round(st.crit * 100)}%  爆伤: ${Math.round(st.critDmg * 100)}%`, px + 84, py + 84, 7.5, '#ffd88a', 'left');
    txt(g, `HP: ${Math.ceil(player.hp)}/${st.maxHp}  MP: ${Math.ceil(player.mp)}/${st.maxMp}`, px + 20, py + 101, 7.2, '#b8e0ff', 'left');

    // 已装备 3 槽位
    const slots: Slot[] = ['weapon', 'armor', 'badge'];
    slots.forEach((slot, i) => {
      const sy = py + 114 + i * 49;
      const eq = player.equip[slot];
      panel(g, px + 18, sy, 182, 44, 'rgba(18,14,34,0.95)', eq ? RARITY_COLORS[eq.rarity] : '#4a426a', '#282040');
      if (eq) {
        g.imageSmoothingEnabled = false;
        g.drawImage(itemIcon(slot, eq.rarity), S(px + 24), S(sy + 10), S(24), S(24));
        txt(g, `[${RARITY_NAMES[eq.rarity]}] ${displayName(eq)}`, px + 54, sy + 14, 7.8, RARITY_COLORS[eq.rarity], 'left', true);
        txt(g, this.itemStatLine(eq), px + 54, sy + 29, 6.8, '#d0d8f4', 'left');
      } else {
        txt(g, `${SLOT_NAMES[slot]}：未装备`, px + 30, sy + 22, 8, '#7a7498', 'left');
      }
    });

    // 右侧：24 格背包网格
    const gx = px + 218, gy = py + 30;
    const cols = 6, cell = 38, gap = 5;
    m.sel = clamp(m.sel, 0, Math.max(0, player.bag.length - 1));
    if (input.pressed('right') && m.sel < player.bag.length - 1) m.sel++;
    if (input.pressed('left') && m.sel > 0) m.sel--;
    if (input.pressed('down') && m.sel + cols < player.bag.length) m.sel += cols;
    if (input.pressed('up') && m.sel - cols >= 0) m.sel -= cols;

    for (let i = 0; i < player.bagCap; i++) {
      const cx = gx + (i % cols) * (cell + gap);
      const cy = gy + Math.floor(i / cols) * (cell + gap);
      const it = player.bag[i];
      const isSel = it && m.sel === i;
      const hov = hit(mx, my, cx, cy, cell, cell);
      panel(g, cx, cy, cell, cell, isSel ? '#362d64' : hov ? '#2c2452' : '#16122c', isSel ? '#ffe066' : it ? RARITY_COLORS[it.rarity] : '#3a3458', '#221c3c');
      if (it) {
        g.imageSmoothingEnabled = false;
        g.drawImage(itemIcon(it.slot, it.rarity), S(cx + 7), S(cy + 6), S(24), S(24));
        if (it.enh > 0) txt(g, `+${it.enh}`, cx + cell - 3, cy + 8, 6.5, '#ffd447', 'right', true);
        const better = itemScore(it) > itemScore(player.equip[it.slot]) + 1;
        if (better) txt(g, '▲', cx + 5, cy + cell - 6, 7, '#6af08a', 'left', true);
        txt(g, `Lv${it.level}`, cx + cell - 3, cy + cell - 6, 6, '#c8d0e8', 'right', false);
        if (hov && click) {
          if (m.sel === i) player.equipItem(i, fx); // 双击/再次点击直接穿戴
          else { m.sel = i; audio.sfx('click'); }
        }
      }
    }

    // 底部选中物品详情 + 操作按钮
    const dy = gy + 4 * (cell + gap) + 4;
    panel(g, gx, dy, 316, 64, 'rgba(24,20,48,0.92)', '#6a5c9a', '#2e2650');
    const selItem = player.bag[m.sel];
    if (selItem) {
      const diff = Math.round(itemScore(selItem) - itemScore(player.equip[selItem.slot]));
      txt(g, `[${RARITY_NAMES[selItem.rarity]}·${SLOT_NAMES[selItem.slot]}] ${displayName(selItem)}  (Lv.${selItem.level})`, gx + 8, dy + 12, 8.2, RARITY_COLORS[selItem.rarity], 'left', true);
      txt(g, this.itemStatLine(selItem), gx + 8, dy + 27, 7.2, '#e4ecff', 'left');
      txt(g, diff > 0 ? `▲ 战力 +${diff}` : diff < 0 ? `▼ 战力 ${diff}` : '— 战力持平', gx + 308, dy + 12, 7.5, diff > 0 ? '#6af08a' : diff < 0 ? '#ff7a7a' : '#b8b8d0', 'right', true);
      const sellVal = Math.max(5, Math.round(selItem.price * 0.5));
      if (button(g, mx, my, click, gx + 8, dy + 38, 86, 20, '装备 [Enter]', '#4a90e8') || input.pressed('confirm')) {
        player.equipItem(m.sel, fx);
      }
      if (button(g, mx, my, click, gx + 100, dy + 38, 92, 20, `出售 +${sellVal}G`, '#c87a3a') || input.pressed('sell')) {
        player.gold += sellVal;
        player.totalGold += sellVal;
        player.bag.splice(m.sel, 1);
        m.sel = clamp(m.sel, 0, Math.max(0, player.bag.length - 1));
        audio.sfx('coin');
        fx.toast(`出售装备，获得 +${sellVal} 金币`, '#ffd447');
      }
    } else {
      txt(g, '背包空空如也，去翠绿草原或萤火古林打怪爆装吧！', gx + 158, dy + 22, 8, '#a09cc0', 'center');
    }
    if (button(g, mx, my, click, gx + 198, dy + 38, 110, 20, '一键售白/蓝装', '#7a68a8', !player.bag.some((i) => i.rarity <= 1))) {
      let sum = 0, cnt = 0;
      for (let i = player.bag.length - 1; i >= 0; i--) {
        if (player.bag[i].rarity <= 1) {
          sum += Math.max(5, Math.round(player.bag[i].price * 0.5));
          player.bag.splice(i, 1);
          cnt++;
        }
      }
      if (cnt > 0) {
        player.gold += sum;
        player.totalGold += sum;
        audio.sfx('buy');
        fx.toast(`批量出售 ${cnt} 件闲置装备，获得 +${sum} 金币！`, '#ffd447');
      }
    }
  }

  private itemStatLine(it: Item): string {
    const parts: string[] = [];
    if (it.atk) parts.push(`攻击+${itemAtk(it)}`);
    if (it.def) parts.push(`防御+${it.def}`);
    if (it.hp) parts.push(`生命+${it.hp}`);
    if (it.mp) parts.push(`法力+${it.mp}`);
    if (it.crit) parts.push(`暴击+${Math.round(it.crit * 100)}%`);
    if (it.critDmg) parts.push(`爆伤+${Math.round(it.critDmg * 100)}%`);
    return parts.join('  ');
  }

  private drawDialog(g: Ctx, m: Extract<ModalState, { kind: 'dialog' }>, input: Input, actions: UIActions, t: number) {
    const bx = 56, by = 204, bw = 528, bh = 100;
    panel(g, bx, by, bw, bh, 'rgba(18,14,38,0.96)', '#e0b860', '#483a72');
    // 说话人立绘
    if (m.portrait !== 'sign') {
      const fr = npcSprites(m.portrait)[Math.floor(t * 2) % 2];
      panel(g, bx + 10, by + 12, 54, 58, '#282048', '#8a74b8', '#1e1838');
      g.imageSmoothingEnabled = false;
      g.drawImage(fr.r, S(bx + 13), S(by + 16), S(48), S(48));
    }
    const tx = m.portrait === 'sign' ? bx + 16 : bx + 74;
    txt(g, m.speaker, tx, by + 16, 10, '#ffe47a', 'left', true);
    const line = m.lines[m.idx] ?? '';
    // 自动按换行符分行
    const rows = line.split('\n');
    rows.forEach((r, i) => txt(g, r, tx, by + 36 + i * 15, 8.5, '#f0f4ff', 'left'));

    const mx = input.mouse.x, my = input.mouse.y, click = input.mouse.clicked;
    const isLast = m.idx >= m.lines.length - 1;
    if (isLast && m.actions && m.actions.length > 0) {
      let chosen: (() => void) | null = null;
      m.actions.forEach((act, i) => {
        const ax = bx + bw - (m.actions!.length - i) * 106 - 6;
        const lbl = i === 0 ? `${act.label} [Enter]` : act.label;
        if (button(g, mx, my, click, ax, by + bh - 26, 100, 20, lbl, i === 0 ? '#5cb8ff' : '#c89b4b') || (i === 0 && input.pressed('confirm'))) {
          chosen = act.fn;
        }
      });
      if (chosen) {
        audio.sfx('select');
        input.consumeAll();
        (chosen as () => void)();
        return;
      }
    } else {
      const nextLabel = isLast ? '关闭 [Enter]' : '继续 [Enter]';
      if (button(g, mx, my, click, bx + bw - 102, by + bh - 26, 92, 20, nextLabel, '#ffd447') || input.pressed('confirm')) {
        audio.sfx('click');
        input.consumeAll();
        if (isLast) actions.closeModal();
        else m.idx++;
        return;
      }
    }
    if (input.pressed('cancel')) { audio.sfx('click'); input.consumeAll(); actions.closeModal(); }
  }

  private drawShop(g: Ctx, m: Extract<ModalState, { kind: 'shop' }>, player: Player, input: Input, fx: Effects, actions: UIActions) {
    g.fillStyle = 'rgba(8,6,18,0.68)';
    g.fillRect(0, 0, S(VIEW_W), S(VIEW_H));
    const px = 76, py = 26, pw = 488, ph = 276;
    panel(g, px, py, pw, ph, 'rgba(20,16,38,0.97)', '#e0a84a', '#4a3868');
    txt(g, '晨风镇铁匠铺 · 格林', px + 14, py + 15, 11, '#ffe47a', 'left', true);
    txt(g, `持有金币：${player.gold} G`, px + pw - 62, py + 15, 9, '#ffd447', 'right', true);

    const mx = input.mouse.x, my = input.mouse.y, click = input.mouse.clicked;
    if (button(g, mx, my, click, px + pw - 48, py + 6, 40, 17, '离开', '#a05a6a') || input.pressed('cancel')) {
      audio.sfx('click');
      actions.closeModal();
      return;
    }

    // 3 个分页按钮
    const tabs = ['药水补给', '武器强化', '装备锻造'];
    tabs.forEach((name, i) => {
      if (button(g, mx, my, click, px + 12 + i * 96, py + 30, 90, 20, name, m.tab === i ? '#ffd447' : '#5c5280')) {
        audio.sfx('click');
        m.tab = i as 0 | 1 | 2;
      }
    });

    const cy = py + 58;
    if (m.tab === 0) {
      // 药水补给
      const items = [
        { icon: 'hp' as const, name: '红色生命药水 ×1', desc: '瞬间回复 48% 最大生命值（快捷键 Z）', price: 30, buy: () => { player.potHp += 1; } },
        { icon: 'mp' as const, name: '蓝色法力药水 ×1', desc: '瞬间回复 50% 最大法力值（快捷键 X）', price: 30, buy: () => { player.potMp += 1; } },
        { icon: 'hp' as const, name: '红蓝双补给包（各 ×5）', desc: '冒险必备实惠套装，刷怪 Boss 战无忧', price: 260, buy: () => { player.potHp += 5; player.potMp += 5; } },
      ];
      items.forEach((it, i) => {
        const ry = cy + i * 58;
        panel(g, px + 14, ry, pw - 28, 50, 'rgba(26,22,52,0.92)', '#5c528a', '#241e44');
        g.imageSmoothingEnabled = false;
        g.drawImage(itemIcon(it.icon), S(px + 24), S(ry + 11), S(26), S(26));
        txt(g, it.name, px + 58, ry + 16, 9.5, '#ffffff', 'left', true);
        txt(g, it.desc, px + 58, ry + 32, 7.5, '#b8c4e8', 'left');
        if (button(g, mx, my, click, px + pw - 108, ry + 14, 84, 22, `购买 ${it.price}G`, '#ffd447', player.gold < it.price)) {
          player.gold -= it.price;
          it.buy();
          audio.sfx('buy');
          m.msg = `购买成功：${it.name}！`;
          m.msgT = 2.5;
        }
      });
    } else if (m.tab === 1) {
      // 武器强化
      const w = player.equip.weapon;
      panel(g, px + 14, cy, pw - 28, 170, 'rgba(26,22,52,0.92)', w ? RARITY_COLORS[w.rarity] : '#5c528a', '#262044');
      if (w) {
        g.imageSmoothingEnabled = false;
        g.drawImage(itemIcon('weapon', w.rarity), S(px + 34), S(cy + 26), S(42), S(42));
        txt(g, `[${RARITY_NAMES[w.rarity]}] ${displayName(w)}`, px + 92, cy + 34, 11, RARITY_COLORS[w.rarity], 'left', true);
        const curAtk = itemAtk(w);
        const nextAtk = Math.round(w.atk * (1 + 0.12 * (w.enh + 1)));
        const cost = enhanceCost(w);
        const maxed = w.enh >= 10;
        txt(g, `当前强化等级：+${w.enh} / +10  （每级 +12% 武器攻击力，+3 起绽放圣光特效）`, px + 92, cy + 54, 7.8, '#d8e0ff', 'left');
        txt(g, maxed ? `当前攻击力：${curAtk}（已达最高强化！）` : `攻击力变化：${curAtk}  →  ${nextAtk}  (+${nextAtk - curAtk})`, px + 92, cy + 74, 9.5, '#8aff9a', 'left', true);
        txt(g, '格林大师保证：100% 锻造成功，绝不碎装！', px + 92, cy + 96, 7.8, '#ffd88a', 'left');
        if (button(g, mx, my, click, px + 160, cy + 122, 168, 28, maxed ? '已满级' : `锻造强化 (${cost} G)`, '#ffd447', maxed || player.gold < cost)) {
          player.gold -= cost;
          w.enh++;
          audio.sfx('anvil');
          fx.toast(`锻造成功！${displayName(w)} 攻击力提升至 ${itemAtk(w)}！`, '#ffd447');
          m.msg = `叮当！武器强化至 +${w.enh}，锋芒更盛！`;
          m.msgT = 2.6;
        }
      } else {
        txt(g, '你当前没有装备武器！请先在背包中装备一把武器。', px + pw / 2, cy + 80, 9.5, '#ff9a9a', 'center');
      }
    } else {
      // 装备锻造 + 神秘星辉宝箱
      m.stock.forEach((it, i) => {
        const ry = cy + i * 44;
        panel(g, px + 14, ry, pw - 28, 39, 'rgba(26,22,52,0.92)', RARITY_COLORS[it.rarity], '#241e44');
        g.imageSmoothingEnabled = false;
        g.drawImage(itemIcon(it.slot, it.rarity), S(px + 22), S(ry + 7), S(24), S(24));
        txt(g, `[${RARITY_NAMES[it.rarity]}] ${it.name} (Lv.${it.level})`, px + 54, ry + 13, 8.2, RARITY_COLORS[it.rarity], 'left', true);
        txt(g, this.itemStatLine(it), px + 54, ry + 27, 7, '#d0daf4', 'left');
        const price = Math.round(it.price * 2.2);
        if (button(g, mx, my, click, px + pw - 102, ry + 9, 78, 21, `购买 ${price}G`, '#ffd447', player.gold < price)) {
          player.gold -= price;
          player.addItem({ ...it }, fx);
          m.stock[i] = genItem(Math.max(2, player.level + 1), rollRarity(0.22));
          audio.sfx('buy');
          m.msg = `购得 [${RARITY_NAMES[it.rarity]}] ${it.name}，已放入背包！`;
          m.msgT = 2.5;
        }
      });
      // 星辉秘匣抽奖
      const by = cy + 136;
      panel(g, px + 14, by, pw - 28, 42, 'rgba(42,24,68,0.95)', '#c77dff', '#301a4e');
      g.imageSmoothingEnabled = false;
      g.drawImage(itemIcon('chest'), S(px + 22), S(by + 8), S(24), S(24));
      txt(g, '星辉神秘锻造匣（高概率开出史诗 / 传说装备！）', px + 54, by + 15, 8.5, '#f0b8ff', 'left', true);
      txt(g, `按当前等级 Lv.${player.level} 随机打造一件强力装备`, px + 54, by + 29, 7, '#d8c8f4', 'left');
      const boxCost = Math.round(140 + player.level * 25);
      if (button(g, mx, my, click, px + pw - 108, by + 10, 84, 22, `开启 ${boxCost}G`, '#c77dff', player.gold < boxCost)) {
        player.gold -= boxCost;
        const rar = rollRarity(0.45);
        const it = genItem(player.level + 1, Math.max(1, rar));
        player.addItem(it, fx);
        audio.sfx(it.rarity >= 2 ? 'rare' : 'buy');
        m.msg = `哇！打造出 [${RARITY_NAMES[it.rarity]}] ${it.name}，快打开背包(I)装备！`;
        m.msgT = 3.2;
      }
    }

    if (m.msgT > 0) {
      m.msgT -= 0.016;
      txt(g, m.msg, px + pw / 2, py + ph - 14, 8.2, '#ffe880', 'center', true);
    } else {
      txt(g, '提示：买到好装备后按 I 打开背包即可一键换装！', px + pw / 2, py + ph - 14, 7.5, '#9ea8d0', 'center');
    }
  }

  private drawPause(g: Ctx, input: Input, actions: UIActions) {
    g.fillStyle = 'rgba(8,6,18,0.68)';
    g.fillRect(0, 0, S(VIEW_W), S(VIEW_H));
    panel(g, 160, 48, 320, 248, 'rgba(18,14,36,0.96)', '#d8ae58', '#423668');
    txt(g, '游 戏 暂 停', 320, 68, 13, '#ffe47a', 'center', true);
    const tips = [
      '← → 移动 | Space 跳跃/空中冲刺 | ↓+Space 下穿平台',
      'A/J/Ctrl 普攻 | Q/W 技能 | 1/2/3 切换职业',
      'Z/X 喝红蓝药 | I 背包 | ↑ 对话/传送门/爬绳 | M 静音',
    ];
    tips.forEach((t, i) => txt(g, t, 320, 92 + i * 13, 7, '#c8d4f4', 'center'));

    const mx = input.mouse.x, my = input.mouse.y, click = input.mouse.clicked;
    if (button(g, mx, my, click, 240, 140, 160, 24, '继续冒险', '#5cb8ff') || input.pressed('pause')) {
      audio.sfx('click'); actions.closeModal(); return;
    }
    if (button(g, mx, my, click, 240, 170, 160, 24, audio.muted ? '开启音乐与音效 (M)' : '静音音乐与音效 (M)', '#9a7ad8')) {
      audio.toggleMute();
    }
    if (button(g, mx, my, click, 240, 200, 160, 24, '返回晨风镇（回满状态）', '#4fd88a')) {
      audio.sfx('portal'); actions.returnTown(); return;
    }
    if (button(g, mx, my, click, 240, 230, 160, 24, '保存进度', '#ffd447')) {
      actions.saveNow(); audio.sfx('select');
    }
    if (button(g, mx, my, click, 240, 260, 160, 24, '返回标题画面', '#c85a6a')) {
      audio.sfx('click'); actions.backToTitle();
    }
  }

  private drawDead(g: Ctx, m: Extract<ModalState, { kind: 'dead' }>, input: Input, actions: UIActions) {
    g.fillStyle = 'rgba(20,4,14,0.72)';
    g.fillRect(0, 0, S(VIEW_W), S(VIEW_H));
    panel(g, 180, 112, 280, 120, 'rgba(24,10,28,0.95)', '#ff5a6a', '#5a1c38');
    txt(g, '你暂时力竭倒下了...', 320, 138, 13, '#ff9aa8', 'center', true);
    txt(g, '星辉的加护将带你安全返回晨风镇，所有装备与金币均完好无损！', 320, 164, 7.6, '#f0d8e0', 'center');
    const mx = input.mouse.x, my = input.mouse.y, click = input.mouse.clicked;
    if (button(g, mx, my, click, 245, 188, 150, 26, '立即返回晨风镇复活', '#ffd447') || input.pressed('confirm') || m.timer <= 0) {
      actions.revive();
    }
  }

  private drawVictory(g: Ctx, m: Extract<ModalState, { kind: 'victory' }>, player: Player, input: Input, actions: UIActions, t: number) {
    const mx = input.mouse.x, my = input.mouse.y, click = input.mouse.clicked;
    if (m.stage === 'cutscene') {
      // 拯救艾莉娅公主的温馨剧情对话框
      const lines = [
        { who: '艾莉娅公主', p: 'princess' as const, text: '哥哥……！我就知道你一定会穿过迷雾与荆棘来到这里！\n暗影魔王的诅咒终于彻底粉碎，蚀月散去了！' },
        { who: '星辉王子', p: 'elder' as const, text: '让你受苦了，艾莉娅！星辉王国终于重归黎明。\n我们一起回到晨风镇吧！' },
        { who: '艾莉娅公主', p: 'princess' as const, text: '嗯！感谢你的勇气与星辉之力，这趟冒险真是太耀眼了！' },
      ];
      const cur = lines[m.lineIdx] ?? lines[0];
      const bx = 60, by = 204, bw = 520, bh = 98;
      panel(g, bx, by, bw, bh, 'rgba(26,18,46,0.95)', '#ffd447', '#6a4aa0');
      panel(g, bx + 12, by + 14, 54, 58, '#36245c', '#ffd447', '#241840');
      g.imageSmoothingEnabled = false;
      const img = cur.who === '星辉王子'
        ? heroSprites(player.job, player.weaponTier()).idle[Math.floor(t * 2) % 2].r
        : npcSprites('princess')[Math.floor(t * 2) % 2].r;
      g.drawImage(img, S(bx + 15), S(by + 18), S(48), S(48));
      txt(g, cur.who, bx + 76, by + 18, 10.5, '#ffe47a', 'left', true);
      cur.text.split('\n').forEach((r, i) => txt(g, r, bx + 76, by + 40 + i * 16, 8.8, '#ffffff', 'left'));
      if (button(g, mx, my, click, bx + bw - 108, by + bh - 26, 96, 20, m.lineIdx < lines.length - 1 ? '继续 [Enter]' : '查看通关结算', '#ffd447') || input.pressed('confirm')) {
        audio.sfx('select');
        if (m.lineIdx < lines.length - 1) m.lineIdx++;
        else m.stage = 'summary';
      }
      return;
    }

    // 华丽通关结算卡片
    g.fillStyle = 'rgba(14,8,30,0.78)';
    g.fillRect(0, 0, S(VIEW_W), S(VIEW_H));
    panel(g, 110, 34, 420, 286, 'rgba(22,16,44,0.97)', '#ffd447', '#5a4490');
    txt(g, '★ 星 辉 永 耀 · 冒 险 通 关 ★', 320, 58, 15, '#ffe87a', 'center', true);
    txt(g, '暗影魔王·莫德雷德已被击败，艾莉娅公主重获自由！', 320, 78, 8.5, '#d8e4ff', 'center');

    // 王子与公主并肩庆祝
    const heroImg = heroSprites(player.job, player.weaponTier()).idle[Math.floor(t * 3) % 2].r;
    const prinImg = npcSprites('princess')[Math.floor(t * 2) % 2].l;
    g.imageSmoothingEnabled = false;
    g.drawImage(heroImg, S(268), S(88), S(48), S(48));
    g.drawImage(prinImg, S(324), S(88), S(48), S(48));

    // 战绩统计
    panel(g, 140, 146, 360, 116, 'rgba(14,10,30,0.88)', '#7a68a8', '#2a2248');
    const rank = player.level >= 12 && m.time < 900 ? 'S+' : player.kills >= 20 ? 'S' : 'A';
    const rows: [string, string][] = [
      ['通关用时', formatTime(m.time)],
      ['最终等级 / 职业', `Lv.${player.level} · ${JOBS[player.job].name}`],
      ['击败魔物总数', `${player.kills} 只`],
      ['最高暴击伤害', `${player.maxCrit || player.stats().atk}`],
      ['累计获得金币', `${player.totalGold} G`],
    ];
    rows.forEach(([k, v], i) => {
      txt(g, k, 160, 164 + i * 19, 8.5, '#b8c4e8', 'left');
      txt(g, v, 378, 164 + i * 19, 8.8, '#fff2b0', 'right', true);
    });
    // 综合评级徽章
    txt(g, '冒险评级', 446, 174, 8, '#d0c4f8', 'center');
    txt(g, rank, 446, 212, 28, '#ffd447', 'center', true);

    if (button(g, mx, my, click, 168, 276, 140, 26, '继续自由冒险', '#4fd88a') || input.pressed('confirm')) {
      audio.sfx('select');
      actions.continueFreePlay();
    }
    if (button(g, mx, my, click, 332, 276, 140, 26, '返回标题画面', '#9a7ad8')) {
      audio.sfx('click');
      actions.backToTitle();
    }
  }
}
