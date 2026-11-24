// 玩家实体：丝滑横版平台物理、三职业切换与技能、RPG 属性/装备/背包/药水
import { clamp, approach, rand, Rect } from '../core/utils';
import { Input } from '../core/input';
import { audio } from '../core/audio';
import { Ctx, silhouette, rgba } from '../gfx/pixel';
import { heroSprites, HERO_SIZE, HERO_FEET, HeroAnim, WEAPON_COLORS, JOB_COLORS } from '../gfx/characters';
import { radial } from '../gfx/backgrounds';
import {
  JOBS, JobId, expToNext, Item, Slot, itemAtk, genItem, displayName, RARITY_NAMES,
} from './data';
import type { MapDef, Rope } from './maps';
import type { Effects } from './effects';

export interface PlayerStats {
  maxHp: number;
  maxMp: number;
  atk: number;
  def: number;
  crit: number;
  critDmg: number;
}

export interface CombatHooks {
  meleeHit: (rect: Rect, mult: number, kbX: number, kbY: number, hitId: number, color: string, isSkill?: boolean) => number;
  spawnBolt: (x: number, y: number, vx: number, vy: number, mult: number, kind: 'magic' | 'arrow' | 'pierce' | 'wave', color: string, pierce?: number) => void;
  spawnMeteor: (targetX: number, groundY: number, mult: number, delay: number) => void;
  spawnArrowRain: (x: number, y: number, w: number, dur: number, mult: number) => void;
  onLevelUp?: (lv: number) => void;
}

const GRAV = 980;
const MAX_FALL = 460;
const MOVE_SPEED = 152;
const JUMP_VY = -395;

export class Player {
  x = 100;
  y = 352;
  vx = 0;
  vy = 0;
  dir: 1 | -1 = 1;
  readonly w = 18;
  readonly h = 34;

  // 平台状态
  onGround = false;
  onThin = false;
  coyote = 0;
  jumpBuf = 0;
  downTapTimer = 0;
  airJumps = 1;
  dropTimer = 0;
  climbing = false;
  climbRope: Rope | null = null;
  ropeCool = 0;
  flashTrail = 0;

  // 战斗状态与输入缓冲
  job: JobId = 'sword';
  cdQ = 0;
  cdW = 0;
  atkTimer = 0;
  atkDur = 0;
  atkBuf = 0;
  skill1Buf = 0;
  skill2Buf = 0;
  combo = 0;
  comboWindow = 0;
  atkHitDone = false;
  hitSeq = 1;

  // 持续技能状态
  whirlTimer = 0;
  whirlTick = 0;
  chargeTimer = 0;
  chargeHitId = 0;
  castTimer = 0;

  // 受伤与无敌
  invuln = 0;
  hurtTimer = 0;
  potCool = 0;

  // 动画
  animTime = 0;
  afterTimer = 0;
  glowTimer = 0;

  // RPG 属性与道具
  level = 1;
  exp = 0;
  hp = 140;
  mp = 75;
  hpLag = 140; // 血条平滑扣血残影
  gold = 120;
  shards = 0;
  potHp = 5;
  potMp = 5;

  equip: Record<Slot, Item | null> = {
    weapon: null,
    armor: null,
    badge: null,
  };
  bag: Item[] = [];
  readonly bagCap = 24;

  // 统计（用于通关结算）
  kills = 0;
  maxCrit = 0;
  totalGold = 120;

  constructor() {
    // 初始新手木剑 + 旅人外衣
    this.equip.weapon = genItem(1, 0, 'weapon');
    this.equip.weapon.name = '王家练习剑';
    this.equip.armor = genItem(1, 0, 'armor');
    this.equip.armor.name = '晨风披风';
    const st = this.stats();
    this.hp = st.maxHp;
    this.hpLag = st.maxHp;
    this.mp = st.maxMp;
  }

  stats(): PlayerStats {
    const j = JOBS[this.job];
    const L = this.level;
    const w = this.equip.weapon;
    const a = this.equip.armor;
    const b = this.equip.badge;
    const baseHp = 95 + L * 26 + (a?.hp ?? 0) + (b?.hp ?? 0);
    const baseMp = 55 + L * 12 + (a?.mp ?? 0) + (b?.mp ?? 0);
    const baseAtk = 10 + L * 3.4 + (w ? itemAtk(w) : 0) + (b?.atk ?? 0);
    const baseDef = Math.floor(L * 1.2) + j.def + (a?.def ?? 0);
    const crit = clamp(0.12 + j.crit + (w?.crit ?? 0) + (b?.crit ?? 0), 0.05, 0.85);
    const critDmg = 1.65 + (w?.critDmg ?? 0) + (b?.critDmg ?? 0);
    return {
      maxHp: Math.round(baseHp * j.hp),
      maxMp: Math.round(baseMp * j.mp),
      atk: Math.round(baseAtk * j.atk),
      def: baseDef,
      crit,
      critDmg,
    };
  }

  weaponTier(): number {
    const w = this.equip.weapon;
    if (!w) return 0;
    return clamp(w.rarity + 1, 1, 4);
  }

  hitbox(): Rect {
    return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h };
  }

  switchJob(id: JobId, fx: Effects, silent = false) {
    if (this.job === id) return;
    const oldSt = this.stats();
    const hpR = this.hp / Math.max(1, oldSt.maxHp);
    const mpR = this.mp / Math.max(1, oldSt.maxMp);
    this.job = id;
    this.whirlTimer = 0;
    this.chargeTimer = 0;
    this.atkTimer = 0;
    const st = this.stats();
    this.hp = Math.max(1, Math.round(st.maxHp * hpR));
    this.hpLag = this.hp;
    this.mp = Math.round(st.maxMp * mpR);
    if (!silent) {
      audio.sfx('job');
      fx.burst(this.x, this.y - 18, 18, [JOB_COLORS[id], '#ffffff', '#ffd447'], 40, 120, 40);
      fx.spawnRing(this.x, this.y - 18, 36, JOB_COLORS[id], 0.3, 2.5);
      fx.toast(`切换职业：${JOBS[id].name}`, JOB_COLORS[id]);
    }
  }

  equipItem(bagIdx: number, fx: Effects) {
    const it = this.bag[bagIdx];
    if (!it) return;
    const prev = this.equip[it.slot];
    const oldSt = this.stats();
    const hpR = this.hp / Math.max(1, oldSt.maxHp);
    const mpR = this.mp / Math.max(1, oldSt.maxMp);
    this.equip[it.slot] = it;
    if (prev) this.bag[bagIdx] = prev;
    else this.bag.splice(bagIdx, 1);
    const st = this.stats();
    this.hp = clamp(Math.round(st.maxHp * hpR), 1, st.maxHp);
    this.mp = clamp(Math.round(st.maxMp * mpR), 0, st.maxMp);
    audio.sfx('select');
    fx.toast(`已装备 [${RARITY_NAMES[it.rarity]}] ${displayName(it)}`, '#ffe680');
  }

  addItem(it: Item, fx: Effects): boolean {
    if (this.bag.length >= this.bagCap) {
      // 背包满自动折算金币，避免掉落浪费
      const val = Math.max(5, Math.round(it.price * 0.6));
      this.gold += val;
      this.totalGold += val;
      fx.toast(`背包已满，${it.name} 自动折算 +${val} 金币`, '#ffd447');
      return false;
    }
    this.bag.push(it);
    return true;
  }

  gainExp(amount: number, fx: Effects, hooks?: CombatHooks) {
    this.exp += amount;
    fx.spawnNum(this.x, this.y - 44, `+${amount} EXP`, 'exp', false);
    let leveled = false;
    while (this.exp >= expToNext(this.level)) {
      this.exp -= expToNext(this.level);
      this.level++;
      leveled = true;
    }
    if (leveled) {
      const st = this.stats();
      this.hp = st.maxHp;
      this.hpLag = st.maxHp;
      this.mp = st.maxMp;
      this.cdQ = 0;
      this.cdW = 0;
      audio.sfx('levelup');
      fx.spawnLevelUp(this.x, this.y, this.level);
      fx.toast(`升级啦！达到 Lv.${this.level}，HP/MP 全满！`, '#ffd447');
      hooks?.onLevelUp?.(this.level);
    }
  }

  usePotion(kind: 'hp' | 'mp', fx: Effects) {
    if (this.potCool > 0) return;
    const st = this.stats();
    if (kind === 'hp') {
      if (this.potHp <= 0) { audio.sfx('error'); fx.toast('红药水不足！可在晨风镇铁匠处购买', '#ff8a8a'); return; }
      if (this.hp >= st.maxHp) return;
      this.potHp--;
      const heal = Math.round(st.maxHp * 0.48);
      this.hp = Math.min(st.maxHp, this.hp + heal);
      this.potCool = 0.35;
      audio.sfx('potion');
      fx.spawnNum(this.x, this.y - 36, `+${heal}`, 'heal');
      fx.burst(this.x, this.y - 18, 12, ['#ff6a7a', '#9aff8a', '#ffffff'], 25, 85, -40);
    } else {
      if (this.potMp <= 0) { audio.sfx('error'); fx.toast('蓝药水不足！可在晨风镇铁匠处购买', '#8ab8ff'); return; }
      if (this.mp >= st.maxMp) return;
      this.potMp--;
      const rec = Math.round(st.maxMp * 0.5);
      this.mp = Math.min(st.maxMp, this.mp + rec);
      this.potCool = 0.35;
      audio.sfx('potion');
      fx.spawnNum(this.x, this.y - 36, `+${rec}`, 'mp');
      fx.burst(this.x, this.y - 18, 12, ['#5cb8ff', '#a8e8ff', '#ffffff'], 25, 85, -40);
    }
  }

  takeDamage(rawAtk: number, fromX: number, fx: Effects): boolean {
    if (this.invuln > 0 || this.chargeTimer > 0) return false;
    const st = this.stats();
    const dmg = Math.max(1, Math.round(rawAtk * rand(0.9, 1.1) - st.def * 0.65));
    this.hp = Math.max(0, this.hp - dmg);
    this.invuln = 0.95;
    this.hurtTimer = 0.24;
    this.whirlTimer = 0;
    this.climbing = false;
    this.climbRope = null;
    const pushDir = this.x < fromX ? -1 : 1;
    this.vx = pushDir * 145;
    this.vy = -175;
    this.onGround = false;
    audio.sfx('hurt');
    fx.shake(4.5, 0.2);
    fx.flash('#ff3050', 0.25);
    fx.spawnNum(this.x, this.y - 38, `-${dmg}`, 'player');
    fx.hitSparks(this.x, this.y - 18, false, '#ff60b0');
    return true;
  }

  update(dt: number, input: Input, map: MapDef, fx: Effects, hooks: CombatHooks, allowControl = true) {
    const st = this.stats();
    this.animTime += dt;
    this.hpLag = approach(this.hpLag, this.hp, st.maxHp * 0.75 * dt);

    // 冷却与输入缓冲计时
    if (this.cdQ > 0) this.cdQ = Math.max(0, this.cdQ - dt);
    if (this.cdW > 0) this.cdW = Math.max(0, this.cdW - dt);
    if (this.invuln > 0) this.invuln = Math.max(0, this.invuln - dt);
    if (this.hurtTimer > 0) this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    if (this.potCool > 0) this.potCool = Math.max(0, this.potCool - dt);
    if (this.dropTimer > 0) this.dropTimer = Math.max(0, this.dropTimer - dt);
    if (this.ropeCool > 0) this.ropeCool = Math.max(0, this.ropeCool - dt);
    if (this.downTapTimer > 0) this.downTapTimer = Math.max(0, this.downTapTimer - dt);
    if (this.atkBuf > 0) this.atkBuf = Math.max(0, this.atkBuf - dt);
    if (this.skill1Buf > 0) this.skill1Buf = Math.max(0, this.skill1Buf - dt);
    if (this.skill2Buf > 0) this.skill2Buf = Math.max(0, this.skill2Buf - dt);
    if (this.comboWindow > 0) {
      this.comboWindow -= dt;
      if (this.comboWindow <= 0) this.combo = 0;
    }
    if (this.castTimer > 0) this.castTimer = Math.max(0, this.castTimer - dt);
    if (this.flashTrail > 0) this.flashTrail = Math.max(0, this.flashTrail - dt);

    // 现代模式同时支持在主战区用鼠标左键普攻、右键释放位移技
    const mouseField = allowControl && input.scheme === 'modern' && input.mouseInPlayfield();
    const wantAtkPress = allowControl && (input.pressed('attack') || (mouseField && input.mouse.clicked));
    const wantAtkHold = allowControl && (input.isDown('attack') || (mouseField && input.mouse.down));
    const wantSkill1 = allowControl && input.pressed('skill1');
    const wantSkill2 = allowControl && (input.pressed('skill2') || (mouseField && input.mouse.rclicked));
    if (wantAtkPress) this.atkBuf = 0.14;
    if (wantSkill1) this.skill1Buf = 0.14;
    if (wantSkill2) this.skill2Buf = 0.14;

    // 自然回复（主城快速回血蓝，野外缓慢回蓝）
    if (map.id === 'town') {
      this.hp = Math.min(st.maxHp, this.hp + st.maxHp * 0.14 * dt);
      this.mp = Math.min(st.maxMp, this.mp + st.maxMp * 0.18 * dt);
    } else {
      this.mp = Math.min(st.maxMp, this.mp + (2.5 + st.maxMp * 0.025) * dt);
    }

    // 切换职业 & 药水（只要可操作随时响应）
    if (allowControl) {
      if (input.pressed('job1')) this.switchJob('sword', fx);
      if (input.pressed('job2')) this.switchJob('mage', fx);
      if (input.pressed('job3')) this.switchJob('ranger', fx);
      if (input.pressed('potHp')) this.usePotion('hp', fx);
      if (input.pressed('potMp')) this.usePotion('mp', fx);
    }

    // 圣光冲锋（霸体突进中）
    if (this.chargeTimer > 0) {
      this.chargeTimer -= dt;
      this.vx = this.dir * 420;
      this.vy = 0;
      this.moveAndCollide(dt, map, fx);
      // 沿途伤害
      const box: Rect = { x: this.x - 26, y: this.y - 38, w: 52, h: 40 };
      hooks.meleeHit(box, 1.85, this.dir * 210, -140, this.chargeHitId, '#ffd447', true);
      this.afterTimer -= dt;
      if (this.afterTimer <= 0) {
        this.afterTimer = 0.04;
        this.emitAfterimage(fx, '#ffd447', 0.25);
        fx.particles.push({
          x: this.x - this.dir * 12, y: this.y - rand(6, 30),
          vx: -this.dir * rand(40, 100), vy: rand(-20, 20),
          life: 0.24, maxLife: 0.24, size: rand(2, 4), color: '#fff3a0', gravity: 0, glow: true, shape: 'spark',
        });
      }
      if (this.chargeTimer <= 0) this.vx *= 0.35;
      return;
    }

    // 旋风斩持续
    if (this.whirlTimer > 0) {
      this.whirlTimer -= dt;
      this.whirlTick -= dt;
      if (this.whirlTick <= 0) {
        this.whirlTick = 0.16;
        audio.sfx('spin');
        const box: Rect = { x: this.x - 58, y: this.y - 44, w: 116, h: 48 };
        hooks.meleeHit(box, 0.92, 0, -110, ++this.hitSeq, '#60d8ff', true);
        fx.spawnSlash(this.x, this.y - 18, this.dir, 46, 0, Math.PI * 1.45, '#5cc8ff', '#fff7a8', 0.17, 7, true);
        fx.spawnSlash(this.x, this.y - 18, -this.dir, 34, Math.PI, Math.PI * 2.35, '#ffd447', '#ffffff', 0.17, 5, true);
      }
    }

    // 普攻计时（前摇缩短至 2~3 帧，挥砍/射箭/发弹瞬间响应）
    if (this.atkTimer > 0) {
      this.atkTimer -= dt;
      if (!this.atkHitDone && this.atkTimer <= this.atkDur * 0.84) {
        this.atkHitDone = true;
        this.executeBasicHit(fx, hooks);
      }
    }

    const moveL = allowControl && input.isDown('left');
    const moveR = allowControl && input.isDown('right');
    const moveU = allowControl && input.isDown('up');
    const moveD = allowControl && input.isDown('down');
    const axis = (moveR ? 1 : 0) - (moveL ? 1 : 0);

    // 绳索 / 梯子判定
    if (this.climbing && this.climbRope) {
      this.vx = 0;
      this.vy = 0;
      this.onGround = false;
      this.airJumps = 1;
      this.x = this.climbRope.x;
      if (moveU) this.y -= 118 * dt;
      if (moveD) this.y += 128 * dt;
      if (this.y <= this.climbRope.top) {
        this.y = this.climbRope.top;
        this.climbing = false;
        this.climbRope = null;
        this.onGround = true;
      } else if (this.y >= this.climbRope.bottom) {
        this.y = this.climbRope.bottom;
        this.climbing = false;
        this.climbRope = null;
      } else if (allowControl && (input.pressed('jump') || wantAtkPress || wantSkill1 || wantSkill2)) {
        this.climbing = false;
        this.climbRope = null;
        this.ropeCool = 0.24;
        if (input.pressed('jump')) {
          this.vy = -340;
          audio.sfx('jump');
        }
        if (axis !== 0) {
          this.dir = axis > 0 ? 1 : -1;
          this.vx = axis * 170;
        }
      }
      return;
    }

    // 尝试抓绳索
    if (allowControl && this.ropeCool <= 0 && this.hurtTimer <= 0 && this.whirlTimer <= 0 && (moveU || moveD)) {
      for (const r of map.ropes) {
        if (Math.abs(this.x - r.x) <= 13) {
          const canUp = moveU && this.y > r.top + 3 && this.y <= r.bottom + 8;
          const canDown = moveD && this.y >= r.top - 4 && this.y < r.bottom - 10;
          if (canUp || canDown) {
            this.climbing = true;
            this.climbRope = r;
            this.x = r.x;
            this.vx = 0;
            this.vy = 0;
            if (canDown && this.y < r.top + 4) this.y = r.top + 6;
            this.atkTimer = 0;
            return;
          }
        }
      }
    }

    // 跳跃缓冲 & 双击下键穿透薄平台检测
    if (allowControl && input.pressed('jump')) this.jumpBuf = 0.13;
    else if (this.jumpBuf > 0) this.jumpBuf = Math.max(0, this.jumpBuf - dt);

    let doubleTapDrop = false;
    if (allowControl && input.pressed('down') && this.onGround && this.onThin) {
      if (this.downTapTimer > 0) {
        doubleTapDrop = true;
        this.downTapTimer = 0;
      } else {
        this.downTapTimer = 0.24;
      }
    }

    // 水平移动（急停转向高加速度，空中响应丝滑无滑冰感）
    const speedMult = this.whirlTimer > 0 ? 0.78 : this.atkTimer > 0 && this.onGround ? 0.55 : 1;
    const targetVx = this.hurtTimer > 0 ? this.vx : axis * MOVE_SPEED * speedMult;
    const turning = axis !== 0 && Math.sign(this.vx) !== 0 && Math.sign(this.vx) !== axis;
    const accel = this.onGround ? (turning ? 2400 : 1750) : 1180;
    if (this.hurtTimer <= 0) {
      this.vx = approach(this.vx, targetVx, accel * dt);
      if (axis !== 0 && this.atkTimer <= 0) this.dir = axis > 0 ? 1 : -1;
    }

    // 下 + 跳 或 双击下键 穿透薄平台
    if (allowControl && this.onGround && this.onThin && ((moveD && this.jumpBuf > 0) || doubleTapDrop)) {
      this.dropTimer = 0.22;
      this.y += 3;
      this.vy = 55;
      this.onGround = false;
      this.onThin = false;
      this.coyote = 0;
      this.jumpBuf = 0;
    } else if (this.jumpBuf > 0 && this.coyote > 0 && this.hurtTimer <= 0) {
      // 普通起跳（含土狼时间）
      this.vy = JUMP_VY;
      this.onGround = false;
      this.coyote = 0;
      this.jumpBuf = 0;
      audio.sfx('jump');
      fx.dust(this.x, this.y, 5);
    } else if (allowControl && input.pressed('jump') && !this.onGround && this.coyote <= 0 && this.airJumps > 0 && this.hurtTimer <= 0) {
      // 二段跳 / 空中冲刺（Flash Jump）
      this.airJumps--;
      this.jumpBuf = 0;
      audio.sfx('flash');
      if (axis !== 0) {
        this.dir = axis > 0 ? 1 : -1;
        this.vx = this.dir * 290;
        this.vy = -280;
        this.flashTrail = 0.26;
        fx.spawnRing(this.x - this.dir * 10, this.y - 16, 26, '#7fe0ff', 0.24, 2.5);
        fx.burst(this.x - this.dir * 8, this.y - 14, 12, ['#7fe0ff', '#ffffff', '#ffd447'], 30, 120, 20);
      } else {
        this.vy = -355;
        this.flashTrail = 0.16;
        fx.spawnRing(this.x, this.y, 24, '#ffd447', 0.24, 2);
        fx.burst(this.x, this.y, 10, ['#ffd447', '#ffffff', '#7fe0ff'], 25, 95, 40);
      }
      this.emitAfterimage(fx, '#7fe0ff', 0.24);
    }

    // 可变跳跃高度（松开跳跃键削减上升速度）
    if (allowControl && input.released('jump') && this.vy < -150) {
      this.vy *= 0.56;
    }

    // 残影（空中冲刺时）
    if (this.flashTrail > 0) {
      this.afterTimer -= dt;
      if (this.afterTimer <= 0) {
        this.afterTimer = 0.05;
        this.emitAfterimage(fx, '#60d0ff', 0.2);
      }
    }

    // 重力 & 地形碰撞
    this.vy = Math.min(MAX_FALL, this.vy + GRAV * dt);
    this.moveAndCollide(dt, map, fx);

    // 攻击与技能触发（仅响应方向键转向，鼠标点击纯触发攻击/位移，不擅自改变人物朝向）
    const syncFacing = () => {
      if (axis !== 0) this.dir = axis > 0 ? 1 : -1;
    };
    if (allowControl && this.hurtTimer <= 0) {
      if (this.skill2Buf > 0) {
        // 位移技优先响应，可随时取消旋风斩与普攻后摇躲避 Boss 技能！
        syncFacing();
        if (this.castSkillW(map, fx, hooks, moveU)) {
          this.whirlTimer = 0;
          this.skill2Buf = 0;
        }
      } else if (this.whirlTimer <= 0) {
        if (this.skill1Buf > 0) {
          syncFacing();
          if (this.castSkillQ(map, fx, hooks)) this.skill1Buf = 0;
        } else if ((this.atkBuf > 0 || wantAtkHold) && this.atkTimer <= 0) {
          syncFacing();
          this.atkBuf = 0;
          this.startAttack(fx);
        }
      }
    }

    // 武器高品质发光粒子
    const tier = this.weaponTier();
    if (tier >= 2 || (this.equip.weapon && this.equip.weapon.enh >= 3)) {
      this.glowTimer -= dt;
      if (this.glowTimer <= 0) {
        this.glowTimer = tier >= 4 ? 0.08 : 0.14;
        const tip = this.weaponTipWorld();
        const col = WEAPON_COLORS[tier].glow || '#ffd447';
        fx.particles.push({
          x: tip.x + rand(-3, 3), y: tip.y + rand(-3, 3),
          vx: rand(-10, 10), vy: rand(-22, -6),
          life: 0.35, maxLife: 0.35, size: rand(1.5, 2.5), color: col, gravity: -10, glow: true, shape: 'star',
        });
      }
    }
  }

  private moveAndCollide(dt: number, map: MapDef, fx: Effects) {
    const prevY = this.y;
    const wasGround = this.onGround;
    this.x = clamp(this.x + this.vx * dt, 14, map.width - 14);
    this.y += this.vy * dt;

    this.onGround = false;
    this.onThin = false;
    if (this.vy >= 0) {
      const halfW = this.w * 0.45;
      for (const p of map.platforms) {
        if (!p.solid && this.dropTimer > 0) continue;
        if (this.x + halfW > p.x && this.x - halfW < p.x + p.w) {
          if (prevY <= p.y + 4 && this.y >= p.y) {
            this.y = p.y;
            if (!wasGround && this.vy > 220) fx.dust(this.x, this.y, 6);
            this.vy = 0;
            this.onGround = true;
            this.onThin = !p.solid;
            break;
          }
        }
      }
    }
    if (this.onGround) {
      this.coyote = 0.11;
      this.airJumps = 1;
    } else if (this.coyote > 0) {
      this.coyote = Math.max(0, this.coyote - dt);
    }
    if (this.y > map.height + 60) {
      this.x = map.spawnPoint.x;
      this.y = map.spawnPoint.y;
      this.vy = 0;
    }
  }

  private startAttack(fx: Effects) {
    if (this.job === 'sword') {
      this.combo = this.comboWindow > 0 ? (this.combo % 3) + 1 : 1;
      this.atkDur = this.combo === 3 ? 0.34 : 0.24;
      this.atkTimer = this.atkDur;
      this.comboWindow = 0.72;
      this.atkHitDone = false;
      if (this.onGround) this.vx += this.dir * (this.combo === 3 ? 115 : 55);
      audio.sfx(this.combo === 3 ? 'swing3' : 'swing');
    } else if (this.job === 'mage') {
      this.combo = (this.combo % 2) + 1;
      this.atkDur = 0.3;
      this.atkTimer = this.atkDur;
      this.atkHitDone = false;
      audio.sfx('magic');
    } else {
      this.combo = (this.combo % 3) + 1;
      this.atkDur = 0.21;
      this.atkTimer = this.atkDur;
      this.comboWindow = 0.9;
      this.atkHitDone = false;
      audio.sfx('arrow');
    }
    void fx;
  }

  private executeBasicHit(fx: Effects, hooks: CombatHooks) {
    const tier = this.weaponTier();
    const wCol = WEAPON_COLORS[tier].glow || JOB_COLORS[this.job];
    if (this.job === 'sword') {
      const c = this.combo;
      const reach = c === 3 ? 62 : 48;
      const box: Rect = {
        x: this.dir > 0 ? this.x - 6 : this.x - reach + 6,
        y: this.y - 42,
        w: reach,
        h: 44,
      };
      const mult = c === 3 ? 1.55 : c === 2 ? 1.15 : 1.0;
      const kb = c === 3 ? 190 : 95;
      hooks.meleeHit(box, mult, this.dir * kb, c === 3 ? -120 : -45, ++this.hitSeq, c === 3 ? '#ffd447' : wCol);
      if (c === 1) fx.spawnSlash(this.x + this.dir * 12, this.y - 18, this.dir, 32, -1.25, 0.95, wCol, '#ffffff', 0.15, 6);
      else if (c === 2) fx.spawnSlash(this.x + this.dir * 14, this.y - 18, this.dir, 34, 1.15, -1.15, '#7fe8ff', '#ffffff', 0.15, 6);
      else {
        fx.spawnSlash(this.x + this.dir * 16, this.y - 18, this.dir, 42, -1.45, 1.35, '#ffd447', '#ffffff', 0.22, 9);
        // 第三斩附带一道短程金色剑气波！
        hooks.spawnBolt(this.x + this.dir * 20, this.y - 18, this.dir * 310, 0, 0.75, 'wave', '#ffd447', 4);
        fx.shake(2.5, 0.12);
      }
    } else if (this.job === 'mage') {
      const sx = this.x + this.dir * 16;
      const sy = this.y - 20;
      hooks.spawnBolt(sx, sy, this.dir * 320, 0, 1.15, 'magic', tier >= 4 ? '#ffd447' : '#b88aff', 1);
      fx.burst(sx, sy, 6, ['#d09aff', '#7fe0ff', '#ffffff'], 20, 70, 0);
    } else {
      const sx = this.x + this.dir * 14;
      const sy = this.y - 18;
      if (this.combo === 3) {
        // 第3箭：双连疾风穿透箭
        hooks.spawnBolt(sx, sy - 3, this.dir * 450, 0, 0.85, 'pierce', '#6af09a', 3);
        hooks.spawnBolt(sx, sy + 3, this.dir * 450, 0, 0.85, 'pierce', '#a8ffcf', 3);
      } else {
        hooks.spawnBolt(sx, sy, this.dir * 430, 0, 0.92, 'arrow', '#7ff090', 1);
      }
    }
  }

  private castSkillQ(map: MapDef, fx: Effects, hooks: CombatHooks): boolean {
    const sk = JOBS[this.job].skills[0];
    if (this.cdQ > 0) return false;
    if (this.mp < sk.mp) { audio.sfx('error'); fx.toast('MP 不足！按 X 喝蓝药水', '#8ab8ff'); this.skill1Buf = 0; return false; }
    this.mp -= sk.mp;
    this.cdQ = sk.cd;
    if (this.job === 'sword') {
      // Q：旋风斩
      this.whirlTimer = 0.86;
      this.whirlTick = 0;
      this.atkTimer = 0;
      fx.shake(3, 0.25);
    } else if (this.job === 'mage') {
      // Q：天降陨石（召唤 3 颗巨型星辰陨石轰炸前方）
      this.castTimer = 0.32;
      audio.sfx('meteor');
      const groundY = this.findGroundBelow(this.x + this.dir * 115, this.y, map);
      hooks.spawnMeteor(clamp(this.x + this.dir * 95, 40, map.width - 40), groundY, 2.3, 0.0);
      hooks.spawnMeteor(clamp(this.x + this.dir * 150, 40, map.width - 40), groundY, 2.1, 0.16);
      hooks.spawnMeteor(clamp(this.x + this.dir * 205, 40, map.width - 40), groundY, 2.1, 0.32);
      fx.burst(this.x, this.y - 26, 14, ['#ff9a3a', '#ffd447', '#c070ff'], 30, 110, -20);
    } else {
      // Q：疾风箭雨
      this.castTimer = 0.28;
      audio.sfx('flash');
      const cx = clamp(this.x + this.dir * 120, 70, map.width - 70);
      const groundY = this.findGroundBelow(cx, this.y, map);
      hooks.spawnArrowRain(cx, groundY, 170, 2.6, 0.72);
      fx.burst(this.x + this.dir * 10, this.y - 24, 12, ['#6af09a', '#ffffff', '#b8ff9a'], 40, 140, -60);
    }
    return true;
  }

  private castSkillW(map: MapDef, fx: Effects, hooks: CombatHooks, holdUp = false): boolean {
    const sk = JOBS[this.job].skills[1];
    if (this.cdW > 0) return false;
    if (this.mp < sk.mp) { audio.sfx('error'); fx.toast('MP 不足！按 X 喝蓝药水', '#8ab8ff'); this.skill2Buf = 0; return false; }
    this.mp -= sk.mp;
    this.cdW = sk.cd;
    if (this.job === 'sword') {
      // 圣光冲锋（霸体突进）
      this.chargeTimer = 0.34;
      this.chargeHitId = ++this.hitSeq;
      this.atkTimer = 0;
      audio.sfx('charge');
      fx.spawnRing(this.x, this.y - 18, 34, '#ffd447', 0.25, 3);
      fx.shake(2.5, 0.16);
    } else if (this.job === 'mage') {
      // 星界瞬移（短距闪烁并留下残影；按住上键可垂直向上瞬移登台！）
      audio.sfx('blink');
      const ox = this.x, oy = this.y;
      for (let i = 0; i < 3; i++) this.emitAfterimage(fx, '#b07dff', 0.32 - i * 0.05);
      fx.burst(ox, oy - 18, 16, ['#c07dff', '#7fe0ff', '#ffffff'], 30, 110, 0);
      fx.spawnRing(ox, oy - 18, 28, '#c07dff', 0.28, 2.5);
      if (holdUp) {
        // 向上瞬移：寻找头顶上方最近的平台或直接上跃 104px
        let targetY = clamp(this.y - 104, 48, map.height - 20);
        for (const p of map.platforms) {
          if (this.x >= p.x - 8 && this.x <= p.x + p.w + 8 && p.y < this.y - 24 && p.y >= this.y - 124) {
            targetY = Math.min(targetY, p.y);
          }
        }
        hooks.meleeHit({ x: ox - 28, y: targetY - 24, w: 56, h: oy - targetY + 30 }, 0.9, 0, -90, ++this.hitSeq, '#c07dff', true);
        this.y = targetY;
        this.vy = -85;
        this.onGround = false;
      } else {
        const nx = clamp(this.x + this.dir * 136, 20, map.width - 20);
        const minX = Math.min(ox, nx), maxX = Math.max(ox, nx);
        hooks.meleeHit({ x: minX, y: oy - 36, w: maxX - minX + 16, h: 38 }, 0.9, this.dir * 80, -60, ++this.hitSeq, '#c07dff', true);
        this.x = nx;
        this.vy = Math.min(this.vy, -80);
      }
      this.invuln = Math.max(this.invuln, 0.36);
      fx.burst(this.x, this.y - 18, 16, ['#7fe0ff', '#ffffff', '#d080ff'], 30, 110, 0);
      fx.spawnRing(this.x, this.y - 18, 30, '#7fe0ff', 0.28, 2.5);
    } else {
      // 后跳射击
      audio.sfx('flash');
      audio.sfx('arrow');
      this.vx = -this.dir * 235;
      this.vy = -270;
      this.onGround = false;
      this.invuln = Math.max(this.invuln, 0.3);
      this.flashTrail = 0.22;
      this.emitAfterimage(fx, '#6af09a', 0.24);
      const sx = this.x + this.dir * 10, sy = this.y - 18;
      // 扇形三连穿透箭
      for (const ang of [-0.14, 0, 0.16]) {
        const vx = Math.cos(ang) * 440 * this.dir;
        const vy = Math.sin(ang) * 440;
        hooks.spawnBolt(sx, sy, vx, vy, 1.1, 'pierce', '#6af09a', 3);
      }
      fx.burst(sx, sy, 10, ['#6af09a', '#ffffff'], 40, 120, 0);
    }
    return true;
  }

  private findGroundBelow(x: number, y: number, map: MapDef): number {
    let best = map.height - 40;
    for (const p of map.platforms) {
      if (x >= p.x && x <= p.x + p.w && p.y >= y - 16 && p.y < best) best = p.y;
    }
    // 兜底用实心地面
    const solid = map.platforms.find((p) => p.solid);
    return best < map.height - 40 ? best : (solid ? solid.y : y);
  }

  currentAnim(): { anim: HeroAnim; idx: number } {
    if (this.hurtTimer > 0) return { anim: 'hurt', idx: 0 };
    if (this.climbing) return { anim: 'climb', idx: Math.floor(Math.abs(this.y) / 9) % 2 };
    if (this.whirlTimer > 0) return { anim: 'attack', idx: Math.floor(this.animTime * 22) % 3 };
    if (this.chargeTimer > 0) return { anim: 'attack', idx: 1 };
    if (this.castTimer > 0) return { anim: 'cast', idx: 0 };
    if (this.atkTimer > 0) {
      const p = 1 - this.atkTimer / Math.max(0.01, this.atkDur);
      const idx = p < 0.28 ? 0 : p < 0.7 ? 1 : 2;
      return { anim: 'attack', idx };
    }
    if (!this.onGround) return { anim: this.vy < 0 ? 'jump' : 'fall', idx: 0 };
    if (Math.abs(this.vx) > 14) return { anim: 'run', idx: Math.floor(this.animTime * 11) % 4 };
    return { anim: 'idle', idx: Math.floor(this.animTime * 2.5) % 2 };
  }

  private currentSprite() {
    const sprites = heroSprites(this.job, this.weaponTier());
    const { anim, idx } = this.currentAnim();
    const list = sprites[anim];
    return list[idx % list.length];
  }

  private weaponTipWorld() {
    const f = this.currentSprite();
    const ox = Math.round(this.x - HERO_SIZE / 2);
    const oy = Math.round(this.y - HERO_FEET);
    const tx = this.dir > 0 ? ox + f.tip.x : ox + (HERO_SIZE - f.tip.x);
    const ty = oy + f.tip.y;
    return { x: tx, y: ty };
  }

  private emitAfterimage(fx: Effects, tint: string, life = 0.22) {
    const f = this.currentSprite();
    const img = this.dir > 0 ? f.r : f.l;
    fx.spawnAfterimage(img, this.x - HERO_SIZE / 2, this.y - HERO_FEET, tint, life);
  }

  draw(g: Ctx, t: number) {
    // 无敌闪烁
    if (this.invuln > 0 && Math.floor(this.invuln * 18) % 2 === 0 && this.chargeTimer <= 0) return;
    const f = this.currentSprite();
    const flip = this.whirlTimer > 0 ? (Math.floor(t * 24) % 2 === 0 ? 1 : -1) : this.dir;
    const img = flip > 0 ? f.r : f.l;
    const dx = Math.round(this.x - HERO_SIZE / 2);
    const dy = Math.round(this.y - HERO_FEET);

    // 脚底柔和阴影
    if (this.onGround) {
      g.fillStyle = 'rgba(15,8,30,0.32)';
      g.beginPath();
      g.ellipse(this.x, this.y + 1, 10, 3, 0, 0, Math.PI * 2);
      g.fill();
    }

    // 高品质武器或高强化发光光晕
    const tier = this.weaponTier();
    const enh = this.equip.weapon?.enh ?? 0;
    if (tier >= 2 || enh >= 3) {
      const tip = this.weaponTipWorld();
      const col = WEAPON_COLORS[tier].glow || '#ffd447';
      const r = 10 + (tier >= 4 ? 6 : 0) + Math.min(8, enh) + Math.sin(t * 8) * 2;
      radial(g, tip.x, tip.y, r, rgba(col, 0.35));
    }

    // 圣光冲锋霸体光环
    if (this.chargeTimer > 0) {
      radial(g, this.x, this.y - 18, 30, 'rgba(255,212,71,0.45)');
    }

    g.drawImage(img, dx, dy);

    // 受击闪白叠加
    if (this.hurtTimer > 0.14) {
      g.save();
      g.globalAlpha = 0.65;
      g.drawImage(silhouette(img, '#ffffff'), dx, dy);
      g.restore();
    }
  }
}
