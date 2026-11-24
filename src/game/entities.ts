// 战斗实体：普通怪物、暗影魔王 Boss（三技能预警红圈）、投射物、箭雨、弹跳掉落物、隐藏宝箱
import { clamp, rand, randInt, chance, dist, overlap, Rect } from '../core/utils';
import { audio } from '../core/audio';
import { Ctx, silhouette, rgba } from '../gfx/pixel';
import { enemySprites } from '../gfx/monsters';
import { itemIcon, coinFrames, chestSprite, RARITY_COLORS } from '../gfx/world';
import { radial } from '../gfx/backgrounds';
import { ENEMIES, EnemyKind, Item, genItem, rollRarity, randGold, displayName, RARITY_NAMES } from './data';
import type { MapDef, Platform } from './maps';
import type { Effects, WarningZone } from './effects';
import type { Player } from './player';

const GRAV = 900;

export interface EnemyHooks {
  spawnEnemyProj: (x: number, y: number, vx: number, vy: number, atk: number, color: string) => void;
  summonImp: (x: number, y: number) => void;
  countImps: () => number;
  bossLightningHit: (x: number, y: number, r: number, atk: number) => void;
}

// ======================== 怪物与 Boss ========================
export class Enemy {
  kind: EnemyKind;
  x: number;
  y: number;
  spawnX: number;
  spawnY: number;
  vx = 0;
  vy = 0;
  dir: 1 | -1 = -1;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  hpLag: number;
  atk: number;
  def: number;
  alive = true;
  dying = 0;

  // 状态
  onGround = false;
  patrolMin = 20;
  patrolMax = 400;
  state = 'patrol';
  stateTimer = 0;
  aiTimer = 0;
  animTime = 0;
  hurtFlash = 0;
  hurtStun = 0;
  hitIds = new Set<number>();
  floatBaseY = 0;
  fromSpawnIdx = -1; // -1 表示召唤物，不重生

  // Boss 专属
  bossSkill = 0;
  bossPhase = 1;
  bossWarnZones: { x: number; y: number; r: number; zone: WarningZone }[] = [];
  bossLaneZone: WarningZone | null = null;
  bossChargeDir: 1 | -1 = -1;
  bossAfterTimer = 0;
  bossEnragedAnnounced = false;

  constructor(kind: EnemyKind, x: number, y: number, map: MapDef, spawnIdx = -1) {
    const def = ENEMIES[kind];
    this.kind = kind;
    this.x = x;
    this.y = y;
    this.spawnX = x;
    this.spawnY = y;
    this.floatBaseY = y - 24;
    this.w = def.w;
    this.h = def.h;
    this.hp = def.hp;
    this.maxHp = def.hp;
    this.hpLag = def.hp;
    this.atk = def.atk;
    this.def = def.def;
    this.fromSpawnIdx = spawnIdx;
    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.aiTimer = rand(0.5, 1.8);
    // 计算巡逻平台范围
    let bestP: Platform | null = null;
    for (const p of map.platforms) {
      if (x >= p.x && x <= p.x + p.w && Math.abs(p.y - y) < 16) {
        bestP = p;
        break;
      }
    }
    if (bestP) {
      this.patrolMin = Math.max(bestP.x + 14, x - 160);
      this.patrolMax = Math.min(bestP.x + bestP.w - 14, x + 160);
    } else {
      this.patrolMin = Math.max(20, x - 140);
      this.patrolMax = Math.min(map.width - 20, x + 140);
    }
    if (kind === 'boss') {
      this.dir = -1;
      this.state = 'idle';
      this.stateTimer = 1.4;
    }
  }

  hitbox(): Rect {
    return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h };
  }

  hurt(dmg: number, crit: boolean, kbX: number, kbY: number, hitId: number, fx: Effects, color = '#ffd86b'): boolean {
    if (!this.alive || this.dying > 0) return false;
    if (hitId > 0 && this.hitIds.has(hitId)) return false;
    if (hitId > 0) {
      this.hitIds.add(hitId);
      if (this.hitIds.size > 40) this.hitIds.clear();
    }
    this.hp = Math.max(0, this.hp - dmg);
    this.hurtFlash = 0.14;
    const poise = this.kind === 'boss' ? 0 : this.kind === 'knight' ? 0.35 : 1;
    if (poise > 0) {
      this.hurtStun = 0.18 * poise;
      this.vx = kbX * poise;
      if (this.kind !== 'sorcerer' && this.kind !== 'imp') {
        this.vy = Math.min(this.vy, kbY * poise);
        if (kbY < -20) this.onGround = false;
      }
    }
    audio.sfx(crit ? 'crit' : 'hit');
    fx.hitSparks(this.x, this.y - this.h * 0.55, crit, color);
    fx.spawnNum(this.x, this.y - this.h - 4, crit ? `${dmg}!` : `${dmg}`, crit ? 'crit' : 'dmg', crit);
    if (crit) {
      fx.shake(this.kind === 'boss' ? 4 : 2.8, 0.12);
      fx.hitStop = Math.max(fx.hitStop, 0.028);
    }
    if (this.hp <= 0) {
      this.alive = false;
      this.clearBossWarnings(fx);
      audio.sfx('die');
      fx.burst(this.x, this.y - this.h * 0.5, this.kind === 'boss' ? 45 : 14,
        this.kind === 'boss' ? ['#c060ff', '#ff4a6a', '#ffd447', '#ffffff'] : ['#ffffff', '#ffd447', '#8aff9a'],
        40, this.kind === 'boss' ? 220 : 120, 120);
      return true;
    }
    return false;
  }

  clearBossWarnings(fx: Effects) {
    for (const w of this.bossWarnZones) {
      const i = fx.warnings.indexOf(w.zone);
      if (i >= 0) fx.warnings.splice(i, 1);
    }
    this.bossWarnZones.length = 0;
    if (this.bossLaneZone) {
      const i = fx.warnings.indexOf(this.bossLaneZone);
      if (i >= 0) fx.warnings.splice(i, 1);
      this.bossLaneZone = null;
    }
  }

  update(dt: number, player: Player, map: MapDef, fx: Effects, hooks: EnemyHooks) {
    if (!this.alive) return;
    this.animTime += dt;
    this.hpLag = Math.max(this.hp, this.hpLag - this.maxHp * 0.65 * dt);
    if (this.hurtFlash > 0) this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    if (this.hurtStun > 0) this.hurtStun = Math.max(0, this.hurtStun - dt);

    if (this.kind === 'boss') {
      this.updateBoss(dt, player, map, fx, hooks);
      return;
    }

    const def = ENEMIES[this.kind];
    const dToP = dist(this.x, this.y, player.x, player.y);
    const dxP = player.x - this.x;

    // 浮空型敌人（术士 / 小鬼）
    if (this.kind === 'sorcerer') {
      if (this.hurtStun <= 0) {
        this.aiTimer -= dt;
        const targetY = this.floatBaseY + Math.sin(this.animTime * 2.4) * 14;
        this.vy = (targetY - this.y) * 4;
        if (dToP < 270) {
          this.dir = dxP >= 0 ? 1 : -1;
          // 保持一定距离漂浮
          const ideal = dToP < 105 ? -this.dir * def.speed : dToP > 190 ? this.dir * def.speed * 0.7 : 0;
          this.vx += (ideal - this.vx) * 4 * dt;
          if (this.state === 'cast') {
            this.stateTimer -= dt;
            if (this.stateTimer <= 0) {
              const ang = Math.atan2((player.y - 18) - (this.y - 22), player.x - this.x);
              hooks.spawnEnemyProj(this.x + this.dir * 10, this.y - 22, Math.cos(ang) * 165, Math.sin(ang) * 165, this.atk, '#7ff8ff');
              audio.sfx('enemyShot');
              this.state = 'patrol';
              this.aiTimer = rand(1.9, 2.7);
            }
          } else if (this.aiTimer <= 0) {
            this.state = 'cast';
            this.stateTimer = 0.45;
            fx.burst(this.x + this.dir * 10, this.y - 24, 6, ['#7ff8ff', '#ffffff'], 15, 45, 0);
          }
        } else {
          this.state = 'patrol';
          this.vx = this.dir * def.speed * 0.65;
          if (this.x < this.patrolMin) this.dir = 1;
          if (this.x > this.patrolMax) this.dir = -1;
        }
      } else {
        this.vx *= Math.pow(0.05, dt);
      }
      this.x = clamp(this.x + this.vx * dt, 18, map.width - 18);
      this.y = clamp(this.y + this.vy * dt, 40, map.height - 40);
      return;
    }

    if (this.kind === 'imp') {
      if (this.hurtStun <= 0) {
        const ang = Math.atan2((player.y - 18) - (this.y - 8), player.x - this.x);
        this.dir = dxP >= 0 ? 1 : -1;
        this.vx += (Math.cos(ang) * def.speed - this.vx) * 3.5 * dt;
        this.vy += (Math.sin(ang) * def.speed + Math.sin(this.animTime * 6) * 28 - this.vy) * 3.5 * dt;
      } else {
        this.vx *= Math.pow(0.08, dt);
        this.vy *= Math.pow(0.08, dt);
      }
      this.x = clamp(this.x + this.vx * dt, 18, map.width - 18);
      this.y = clamp(this.y + this.vy * dt, 30, map.height - 42);
      return;
    }

    // 地面型敌人：史莱姆 / 蘑菇 / 发条铁皮骑士
    if (this.hurtStun <= 0) {
      if (this.kind === 'slime') {
        this.aiTimer -= dt;
        if (this.onGround) {
          this.vx *= Math.pow(0.02, dt);
          if (this.aiTimer <= 0) {
            if (dToP < 180 && Math.abs(player.y - this.y) < 70) this.dir = dxP >= 0 ? 1 : -1;
            else if (this.x <= this.patrolMin) this.dir = 1;
            else if (this.x >= this.patrolMax) this.dir = -1;
            else if (chance(0.3)) this.dir = this.dir > 0 ? -1 : 1;
            this.vx = this.dir * (def.speed * 1.9);
            this.vy = -195;
            this.onGround = false;
            this.aiTimer = rand(0.9, 1.7);
          }
        }
      } else if (this.kind === 'mushroom') {
        const aggro = dToP < 190 && Math.abs(player.y - this.y) < 75;
        if (aggro) {
          this.dir = dxP >= 0 ? 1 : -1;
          this.vx = this.dir * def.speed * 1.35;
          this.aiTimer -= dt;
          if (this.onGround && this.aiTimer <= 0 && dToP < 120) {
            this.vy = -225;
            this.onGround = false;
            this.aiTimer = rand(1.1, 1.8);
          }
        } else {
          this.vx = this.dir * def.speed;
          if (this.x <= this.patrolMin) this.dir = 1;
          if (this.x >= this.patrolMax) this.dir = -1;
        }
      } else if (this.kind === 'knight') {
        if (this.state === 'windup') {
          this.vx = 0;
          this.stateTimer -= dt;
          if (this.stateTimer <= 0) {
            this.state = 'lunge';
            this.stateTimer = 0.28;
            this.vx = this.dir * 210;
            audio.sfx('swing');
          }
        } else if (this.state === 'lunge') {
          this.stateTimer -= dt;
          if (this.stateTimer <= 0) {
            this.state = 'recover';
            this.stateTimer = 0.55;
            this.vx = 0;
          }
        } else if (this.state === 'recover') {
          this.vx = 0;
          this.stateTimer -= dt;
          if (this.stateTimer <= 0) this.state = 'patrol';
        } else {
          const aggro = dToP < 210 && Math.abs(player.y - this.y) < 60;
          if (aggro) {
            this.dir = dxP >= 0 ? 1 : -1;
            if (dToP < 68) {
              this.state = 'windup';
              this.stateTimer = 0.42;
              this.vx = 0;
            } else {
              this.vx = this.dir * def.speed * 1.25;
            }
          } else {
            this.vx = this.dir * def.speed;
            if (this.x <= this.patrolMin) this.dir = 1;
            if (this.x >= this.patrolMax) this.dir = -1;
          }
        }
      }
    } else {
      this.vx *= Math.pow(0.06, dt);
    }

    // 地面碰撞
    this.vy = Math.min(440, this.vy + GRAV * dt);
    const prevY = this.y;
    this.x = clamp(this.x + this.vx * dt, 16, map.width - 16);
    if (this.state !== 'lunge' && this.hurtStun <= 0) {
      if (this.x < this.patrolMin && this.vx < 0) { this.x = this.patrolMin; this.dir = 1; }
      if (this.x > this.patrolMax && this.vx > 0) { this.x = this.patrolMax; this.dir = -1; }
    }
    this.y += this.vy * dt;
    this.onGround = false;
    if (this.vy >= 0) {
      for (const p of map.platforms) {
        if (this.x + 8 > p.x && this.x - 8 < p.x + p.w && prevY <= p.y + 4 && this.y >= p.y) {
          this.y = p.y;
          this.vy = 0;
          this.onGround = true;
          break;
        }
      }
    }
  }

  // ==================== 暗影魔王·莫德雷德 AI ====================
  private updateBoss(dt: number, player: Player, map: MapDef, fx: Effects, hooks: EnemyHooks) {
    const floorY = 320;
    if (this.hp < this.maxHp * 0.5 && this.bossPhase === 1) {
      this.bossPhase = 2;
      if (!this.bossEnragedAnnounced) {
        this.bossEnragedAnnounced = true;
        audio.sfx('roar');
        fx.shake(7, 0.5);
        fx.flash('#c030ff', 0.35);
        fx.spawnRing(this.x, this.y - 46, 110, '#ff3a6a', 0.6, 4);
        fx.toast('暗影魔王进入狂暴阶段！技能更加迅猛！', '#ff6a8a');
      }
    }
    const fast = this.bossPhase === 2 ? 0.78 : 1;

    // 狂暴阶段暗影粒子
    if (this.bossPhase === 2 && Math.random() < 0.35) {
      fx.particles.push({
        x: this.x + rand(-24, 24), y: this.y - rand(10, 75),
        vx: rand(-15, 15), vy: rand(-55, -20),
        life: 0.45, maxLife: 0.45, size: rand(2, 3.5), color: Math.random() < 0.5 ? '#c040ff' : '#ff3a5a', gravity: 0, glow: true,
      });
    }

    if (this.state === 'idle') {
      // 缓步逼近玩家，之后轮换释放三大技能
      this.dir = player.x >= this.x ? 1 : -1;
      const d = Math.abs(player.x - this.x);
      if (d > 95) this.x = clamp(this.x + this.dir * ENEMIES.boss.speed * (this.bossPhase === 2 ? 1.35 : 1) * dt, 70, map.width - 70);
      this.y = floorY;
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        // 轮换技能：0 暗影落雷 -> 1 全屏冲锋 -> 2 召唤小怪
        const sk = this.bossSkill % 3;
        this.bossSkill++;
        if (sk === 0) this.startBossLightning(player, map, fx, fast);
        else if (sk === 1) this.startBossCharge(player, map, fx, fast);
        else this.startBossSummon(map, fx, hooks, fast);
      }
    } else if (this.state === 'lightning_warn') {
      this.stateTimer -= dt;
      for (const w of this.bossWarnZones) w.zone.t += dt;
      if (this.stateTimer <= 0) {
        audio.sfx('thunder');
        fx.shake(6.5, 0.35);
        fx.flash('#d080ff', 0.28);
        for (const w of this.bossWarnZones) {
          fx.spawnLightning(w.x, 0, w.y, '#c060ff', 14);
          hooks.bossLightningHit(w.x, w.y, w.r, Math.round(this.atk * 1.25));
        }
        this.clearBossWarnings(fx);
        this.state = 'idle';
        this.stateTimer = 1.65 * fast;
      }
    } else if (this.state === 'charge_warn') {
      this.stateTimer -= dt;
      if (this.bossLaneZone) this.bossLaneZone.t += dt;
      if (this.stateTimer <= 0) {
        this.clearBossWarnings(fx);
        audio.sfx('dash');
        audio.sfx('roar');
        fx.shake(5, 0.3);
        this.state = 'charge_go';
        this.stateTimer = 1.45;
      }
    } else if (this.state === 'charge_go') {
      const spd = this.bossPhase === 2 ? 700 : 580;
      this.x += this.bossChargeDir * spd * dt;
      this.bossAfterTimer -= dt;
      if (this.bossAfterTimer <= 0) {
        this.bossAfterTimer = 0.035;
        const sp = enemySprites('boss');
        const fr = sp.anims.charge[0];
        const img = this.dir > 0 ? fr.r : fr.l;
        const dx = this.x - (this.dir > 0 ? sp.cx : sp.w - sp.cx);
        fx.spawnAfterimage(img, dx, this.y - sp.feet, '#a030ff', 0.25, 0.55);
        fx.particles.push({
          x: this.x - this.dir * 20, y: this.y - rand(6, 65),
          vx: -this.dir * rand(60, 140), vy: rand(-30, 15),
          life: 0.3, maxLife: 0.3, size: rand(3, 5), color: '#ff4a6a', gravity: 0, glow: true,
        });
      }
      this.stateTimer -= dt;
      if ((this.bossChargeDir > 0 && this.x >= map.width - 75) || (this.bossChargeDir < 0 && this.x <= 75) || this.stateTimer <= 0) {
        this.x = clamp(this.x, 75, map.width - 75);
        fx.shake(5, 0.22);
        fx.burst(this.x, this.y - 30, 18, ['#c060ff', '#ff4a6a', '#ffffff'], 50, 180, 100);
        this.state = 'idle';
        this.stateTimer = 1.5 * fast;
      }
    } else if (this.state === 'summon_warn') {
      this.stateTimer -= dt;
      for (const w of this.bossWarnZones) w.zone.t += dt;
      if (this.stateTimer <= 0) {
        audio.sfx('summon');
        const need = Math.max(0, (this.bossPhase === 2 ? 4 : 3) - hooks.countImps());
        let spawned = 0;
        for (const w of this.bossWarnZones) {
          fx.spawnRing(w.x, w.y - 10, 34, '#c060ff', 0.35, 3);
          fx.burst(w.x, w.y - 10, 14, ['#c060ff', '#ff3a6a', '#ffffff'], 30, 110, 0);
          if (spawned < need) {
            hooks.summonImp(w.x, w.y - 24);
            spawned++;
          }
        }
        // 召唤同时向玩家释放扇形暗影魔球
        const shots = this.bossPhase === 2 ? 5 : 3;
        const baseAng = Math.atan2((player.y - 18) - (this.y - 52), player.x - this.x);
        for (let i = 0; i < shots; i++) {
          const off = (i - (shots - 1) / 2) * 0.24;
          hooks.spawnEnemyProj(this.x, this.y - 52, Math.cos(baseAng + off) * 190, Math.sin(baseAng + off) * 190, Math.round(this.atk * 0.85), '#d050ff');
        }
        this.clearBossWarnings(fx);
        this.state = 'idle';
        this.stateTimer = 1.55 * fast;
      }
    }
  }

  private startBossLightning(player: Player, map: MapDef, fx: Effects, fast: number) {
    this.clearBossWarnings(fx);
    const dur = 1.05 * fast;
    this.state = 'lightning_warn';
    this.stateTimer = dur;
    audio.sfx('warn');
    const count = this.bossPhase === 2 ? 6 : 4;
    const xs: number[] = [clamp(player.x, 70, map.width - 70)];
    for (let i = 1; i < count; i++) {
      let cx = rand(80, map.width - 80);
      for (let tries = 0; tries < 8; tries++) {
        if (xs.every((ox) => Math.abs(ox - cx) > 95)) break;
        cx = rand(80, map.width - 80);
      }
      xs.push(cx);
    }
    for (const x of xs) {
      const zone: WarningZone = { kind: 'circle', x, y: 320, w: 38, h: 16, t: 0, dur, color: '#ff2a4a' };
      fx.warnings.push(zone);
      this.bossWarnZones.push({ x, y: 320, r: 38, zone });
    }
  }

  private startBossCharge(player: Player, map: MapDef, fx: Effects, fast: number) {
    this.clearBossWarnings(fx);
    const dur = 1.0 * fast;
    // 瞬移到场地较远一侧准备全屏冲锋
    const goRight = player.x > map.width * 0.5;
    fx.burst(this.x, this.y - 45, 16, ['#c060ff', '#2a1040'], 40, 120, 0);
    this.x = goRight ? 78 : map.width - 78;
    this.y = 320;
    this.bossChargeDir = goRight ? 1 : -1;
    this.dir = this.bossChargeDir;
    fx.burst(this.x, this.y - 45, 18, ['#ff3a5a', '#c060ff'], 40, 130, 0);
    audio.sfx('warn');
    const lane: WarningZone = {
      kind: 'lane', x: 20, y: 320 - 82, w: map.width - 40, h: 82, t: 0, dur, color: '#ff2a4a', dir: this.bossChargeDir,
    };
    fx.warnings.push(lane);
    this.bossLaneZone = lane;
    this.state = 'charge_warn';
    this.stateTimer = dur;
  }

  private startBossSummon(map: MapDef, fx: Effects, _hooks: EnemyHooks, fast: number) {
    this.clearBossWarnings(fx);
    const dur = 0.9 * fast;
    this.state = 'summon_warn';
    this.stateTimer = dur;
    audio.sfx('warn');
    const spots = this.bossPhase === 2 ? [210, 480, 750] : [220, 740];
    for (const sx of spots) {
      const x = clamp(sx + rand(-30, 30), 80, map.width - 80);
      const zone: WarningZone = { kind: 'circle', x, y: 245, w: 28, h: 14, t: 0, dur, color: '#d040ff' };
      fx.warnings.push(zone);
      this.bossWarnZones.push({ x, y: 245, r: 28, zone });
    }
  }

  draw(g: Ctx) {
    if (!this.alive) return;
    const sp = enemySprites(this.kind);
    let anim = 'idle';
    if (this.hurtFlash > 0.04 && sp.anims.hurt) anim = 'hurt';
    else if (this.kind === 'boss') {
      if (this.state === 'charge_go') anim = 'charge';
      else if (this.state.endsWith('_warn')) anim = 'cast';
      else anim = 'idle';
    } else if (this.kind === 'knight') {
      if (this.state === 'windup') anim = 'atk0';
      else if (this.state === 'lunge') anim = 'atk1';
      else anim = Math.abs(this.vx) > 4 ? 'move' : 'idle';
    } else if (this.kind === 'sorcerer') {
      anim = this.state === 'cast' ? 'cast' : 'idle';
    } else {
      anim = Math.abs(this.vx) > 4 || !this.onGround ? 'move' : 'idle';
    }
    const list = sp.anims[anim] ?? sp.anims.idle;
    const rate = this.kind === 'imp' ? 11 : this.kind === 'boss' ? 3 : 6;
    const frame = list[Math.floor(this.animTime * rate) % list.length];
    const img = this.dir > 0 ? frame.r : frame.l;
    const dx = Math.round(this.x - (this.dir > 0 ? sp.cx : sp.w - sp.cx));
    const dy = Math.round(this.y - sp.feet);

    // 脚底阴影
    if (this.kind !== 'sorcerer' && this.kind !== 'imp') {
      g.fillStyle = 'rgba(12,6,24,0.34)';
      g.beginPath();
      g.ellipse(this.x, this.y + 1, this.w * 0.55, this.kind === 'boss' ? 6 : 3, 0, 0, Math.PI * 2);
      g.fill();
    }
    if (this.kind === 'boss') {
      radial(g, this.x, this.y - 48, this.bossPhase === 2 ? 78 : 56, this.bossPhase === 2 ? 'rgba(255,40,90,0.28)' : 'rgba(160,60,255,0.24)');
    }
    if (this.kind === 'knight' && this.state === 'windup') {
      radial(g, this.x + this.dir * 12, this.y - 24, 16, 'rgba(255,90,70,0.45)');
    }

    g.drawImage(img, dx, dy);

    // 受击闪白
    if (this.hurtFlash > 0) {
      g.save();
      g.globalAlpha = 0.72;
      g.drawImage(silhouette(img, '#ffffff'), dx, dy);
      g.restore();
    }

    // 普通怪物头顶迷你血条（受过伤时显示）
    if (this.kind !== 'boss' && this.hp < this.maxHp) {
      const bw = Math.max(24, this.w + 4);
      const bx = Math.round(this.x - bw / 2);
      const by = Math.round(this.y - this.h - 10);
      g.fillStyle = '#180c24';
      g.fillRect(bx - 1, by - 1, bw + 2, 5);
      g.fillStyle = '#5a2030';
      g.fillRect(bx, by, bw, 3);
      g.fillStyle = '#ffffff';
      g.fillRect(bx, by, Math.round(bw * (this.hpLag / this.maxHp)), 3);
      g.fillStyle = '#ff4a5a';
      g.fillRect(bx, by, Math.round(bw * (this.hp / this.maxHp)), 3);
    }
  }
}

// ======================== 投射物与技能区域 ========================
export interface Projectile {
  fromPlayer: boolean;
  kind: 'magic' | 'arrow' | 'pierce' | 'wave' | 'meteor' | 'enemy';
  x: number;
  y: number;
  vx: number;
  vy: number;
  mult: number; // 玩家：攻击倍率；敌人：固定攻击力
  color: string;
  life: number;
  pierce: number;
  hitId: number;
  targetY?: number;
  delay?: number;
  warn?: WarningZone;
  trailT: number;
}

export interface ArrowRain {
  x: number;
  y: number; // 地面 y
  w: number;
  life: number;
  maxLife: number;
  tick: number;
  mult: number;
  arrows: { x: number; y: number; vy: number }[];
}

export function drawProjectile(g: Ctx, p: Projectile) {
  if ((p.delay ?? 0) > 0) return;
  g.save();
  if (p.kind === 'magic') {
    radial(g, p.x, p.y, 13, rgba(p.color, 0.55));
    g.fillStyle = p.color;
    g.beginPath();
    g.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(p.x - 1, p.y - 1, 2.2, 0, Math.PI * 2);
    g.fill();
  } else if (p.kind === 'arrow' || p.kind === 'pierce') {
    const ang = Math.atan2(p.vy, p.vx);
    g.translate(p.x, p.y);
    g.rotate(ang);
    if (p.kind === 'pierce') radial(g, 0, 0, 12, rgba(p.color, 0.45));
    g.fillStyle = '#e8c480';
    g.fillRect(-9, -1, 14, 2);
    g.fillStyle = p.color;
    g.fillRect(4, -2, 4, 4);
    g.fillStyle = '#ffffff';
    g.fillRect(6, -1, 3, 2);
    g.fillStyle = '#ff6a6a';
    g.fillRect(-10, -2, 3, 1);
    g.fillRect(-10, 1, 3, 1);
  } else if (p.kind === 'wave') {
    const d = p.vx >= 0 ? 1 : -1;
    g.translate(p.x, p.y);
    g.scale(d, 1);
    radial(g, 0, 0, 22, rgba(p.color, 0.4));
    g.strokeStyle = p.color;
    g.lineWidth = 5;
    g.beginPath();
    g.arc(-8, 0, 16, -1.1, 1.1);
    g.stroke();
    g.strokeStyle = '#ffffff';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(-6, 0, 16, -0.95, 0.95);
    g.stroke();
  } else if (p.kind === 'meteor') {
    radial(g, p.x, p.y, 28, 'rgba(255,140,40,0.65)');
    g.fillStyle = '#ff6a2a';
    g.beginPath();
    g.arc(p.x, p.y, 12, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffd447';
    g.beginPath();
    g.arc(p.x - 1, p.y - 1, 8, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(p.x - 2, p.y - 2, 4, 0, Math.PI * 2);
    g.fill();
  } else {
    radial(g, p.x, p.y, 13, rgba(p.color, 0.5));
    g.fillStyle = p.color;
    g.beginPath();
    g.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(p.x, p.y, 2, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

export function drawArrowRain(g: Ctx, r: ArrowRain) {
  const fade = Math.min(1, r.life / 0.35);
  g.save();
  g.globalAlpha = fade;
  // 地面风阵光带
  g.fillStyle = 'rgba(106,240,154,0.16)';
  g.fillRect(r.x - r.w / 2, r.y - 4, r.w, 6);
  g.strokeStyle = 'rgba(140,255,180,0.65)';
  g.lineWidth = 1.5;
  g.beginPath();
  g.ellipse(r.x, r.y, r.w * 0.5, 6, 0, 0, Math.PI * 2);
  g.stroke();
  // 坠落光箭
  for (const a of r.arrows) {
    g.strokeStyle = '#6af09a';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(a.x, a.y - 14);
    g.lineTo(a.x, a.y + 4);
    g.stroke();
    g.fillStyle = '#ffffff';
    g.fillRect(Math.round(a.x - 1), Math.round(a.y + 2), 2, 4);
  }
  g.restore();
}

// ======================== 满地爆装与抛物线掉落 ========================
export type DropKind = 'gold' | 'hp' | 'mp' | 'equip' | 'shard';
export interface Drop {
  kind: DropKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  amount: number;
  item?: Item;
  age: number;
  life: number;
  onGround: boolean;
  bounces: number;
}

export function spawnEnemyDrops(e: Enemy, drops: Drop[]) {
  const def = ENEMIES[e.kind];
  const totalGold = randGold(def.gold);
  const coins = e.kind === 'boss' ? 14 : randInt(2, 4);
  const per = Math.max(1, Math.round(totalGold / coins));
  for (let i = 0; i < coins; i++) {
    drops.push({
      kind: 'gold',
      x: e.x + rand(-6, 6), y: e.y - 12,
      vx: rand(-95, 95), vy: rand(-235, -140),
      amount: per, age: 0, life: 35, onGround: false, bounces: 0,
    });
  }
  if (chance(e.kind === 'boss' ? 1 : 0.28)) {
    drops.push({
      kind: 'hp', x: e.x, y: e.y - 14,
      vx: rand(-80, 80), vy: rand(-230, -155),
      amount: e.kind === 'boss' ? 3 : 1, age: 0, life: 35, onGround: false, bounces: 0,
    });
  }
  if (chance(e.kind === 'boss' ? 1 : 0.24)) {
    drops.push({
      kind: 'mp', x: e.x, y: e.y - 14,
      vx: rand(-80, 80), vy: rand(-230, -155),
      amount: e.kind === 'boss' ? 3 : 1, age: 0, life: 35, onGround: false, bounces: 0,
    });
  }
  if (chance(def.equipRate)) {
    const count = e.kind === 'boss' ? 3 : 1;
    for (let i = 0; i < count; i++) {
      const rarity = e.kind === 'boss' ? (i === 0 ? 3 : 2) : rollRarity(def.lv >= 8 ? 0.14 : 0.04);
      const it = genItem(def.lv, rarity);
      drops.push({
        kind: 'equip', x: e.x, y: e.y - 16,
        vx: rand(-100, 100), vy: rand(-260, -175),
        amount: 1, item: it, age: 0, life: 45, onGround: false, bounces: 0,
      });
    }
  }
}

export function updateDrops(dt: number, drops: Drop[], player: Player, map: MapDef, fx: Effects) {
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    d.age += dt;
    d.life -= dt;
    if (d.life <= 0) { drops.splice(i, 1); continue; }

    // 靠近角色自动吸附拾取
    const px = player.x, py = player.y - 16;
    const dd = dist(d.x, d.y, px, py);
    if (d.age > 0.34 && dd < 78) {
      const pull = clamp(1 - dd / 78, 0.2, 1) * 420;
      const ang = Math.atan2(py - d.y, px - d.x);
      d.vx = Math.cos(ang) * pull;
      d.vy = Math.sin(ang) * pull;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.onGround = false;
      if (dd < 18) {
        collectDrop(d, player, fx);
        drops.splice(i, 1);
      }
      continue;
    }

    if (!d.onGround) {
      d.vy = Math.min(420, d.vy + 760 * dt);
      const prevY = d.y;
      d.x = clamp(d.x + d.vx * dt, 14, map.width - 14);
      d.y += d.vy * dt;
      if (d.vy >= 0) {
        for (const p of map.platforms) {
          if (d.x >= p.x && d.x <= p.x + p.w && prevY <= p.y + 4 && d.y >= p.y) {
            d.y = p.y;
            if (d.bounces < 2 && Math.abs(d.vy) > 75) {
              d.vy = -d.vy * 0.42;
              d.vx *= 0.58;
              d.bounces++;
            } else {
              d.vy = 0;
              d.vx = 0;
              d.onGround = true;
            }
            break;
          }
        }
      }
    }
  }
}

function collectDrop(d: Drop, player: Player, fx: Effects) {
  if (d.kind === 'gold') {
    player.gold += d.amount;
    player.totalGold += d.amount;
    audio.sfx('coin');
    fx.toast(`+${d.amount} 金币`, '#ffd447');
    fx.burst(d.x, d.y - 6, 4, ['#ffd447', '#fff8a0'], 15, 55, 40);
  } else if (d.kind === 'hp') {
    player.potHp += d.amount;
    audio.sfx('pickup');
    fx.toast(`红药水 +${d.amount}`, '#ff8a9a');
  } else if (d.kind === 'mp') {
    player.potMp += d.amount;
    audio.sfx('pickup');
    fx.toast(`蓝药水 +${d.amount}`, '#7cc8ff');
  } else if (d.kind === 'shard') {
    player.shards += d.amount;
    audio.sfx('rare');
    fx.toast(`获得星辉碎片！(${player.shards}/3)`, '#7ff8ff');
    fx.spawnRing(player.x, player.y - 18, 45, '#7ff8ff', 0.45, 3);
  } else if (d.kind === 'equip' && d.item) {
    const it = d.item;
    audio.sfx(it.rarity >= 2 ? 'rare' : 'pickup');
    if (player.addItem(it, fx)) {
      fx.toast(`获得 [${RARITY_NAMES[it.rarity]}] ${displayName(it)}`, RARITY_COLORS[it.rarity]);
    }
    if (it.rarity >= 2) fx.burst(player.x, player.y - 18, 14, [RARITY_COLORS[it.rarity], '#ffffff'], 30, 110, 30);
  }
}

export function drawDrops(g: Ctx, drops: Drop[], t: number) {
  for (const d of drops) {
    // 消失前闪烁
    if (d.life < 4 && Math.floor(d.life * 10) % 2 === 0) continue;
    const bob = d.onGround ? Math.sin(t * 5 + d.x * 0.1) * 2.2 : 0;
    const y = Math.round(d.y - 12 + bob);
    // 高品质装备垂直光柱
    if (d.kind === 'equip' && d.item && d.item.rarity >= 1) {
      const col = RARITY_COLORS[d.item.rarity];
      const h = d.item.rarity === 3 ? 62 : d.item.rarity === 2 ? 44 : 26;
      const gr = g.createLinearGradient(0, d.y - h, 0, d.y);
      gr.addColorStop(0, 'rgba(0,0,0,0)');
      gr.addColorStop(1, rgba(col, 0.55));
      g.fillStyle = gr;
      g.fillRect(Math.round(d.x - 4), Math.round(d.y - h), 8, h);
      radial(g, d.x, y + 6, 14, rgba(col, 0.4));
    } else if (d.kind === 'shard') {
      radial(g, d.x, y + 6, 18, 'rgba(127,248,255,0.5)');
    }

    if (d.kind === 'gold') {
      const tier = d.amount >= 30 ? 2 : d.amount >= 10 ? 1 : 0;
      const frames = coinFrames(tier);
      const fr = frames[Math.floor(t * 9 + d.x) % frames.length];
      g.drawImage(fr, Math.round(d.x - 7), y);
    } else if (d.kind === 'hp') {
      g.drawImage(itemIcon('hp'), Math.round(d.x - 8), y - 2);
    } else if (d.kind === 'mp') {
      g.drawImage(itemIcon('mp'), Math.round(d.x - 8), y - 2);
    } else if (d.kind === 'shard') {
      g.drawImage(itemIcon('shard'), Math.round(d.x - 8), y - 2);
    } else if (d.kind === 'equip' && d.item) {
      g.drawImage(itemIcon(d.item.slot, d.item.rarity), Math.round(d.x - 8), y - 2);
    }
  }
}

// ======================== 隐藏高爆率宝箱 ========================
export interface Chest {
  x: number;
  y: number;
  opened: boolean;
}

export function openChest(chest: Chest, drops: Drop[], fx: Effects, playerLv: number) {
  if (chest.opened) return;
  chest.opened = true;
  audio.sfx('chest');
  fx.shake(4, 0.25);
  fx.spawnRing(chest.x, chest.y - 12, 55, '#ffd447', 0.45, 3);
  fx.burst(chest.x, chest.y - 14, 28, ['#ffd447', '#fff8a0', '#c77dff', '#7ff8ff'], 40, 165, 110);
  // 喷出丰厚金币、药水、保底史诗/传说装备！
  for (let i = 0; i < 10; i++) {
    drops.push({
      kind: 'gold', x: chest.x, y: chest.y - 14,
      vx: rand(-115, 115), vy: rand(-260, -170),
      amount: randInt(25, 45), age: 0, life: 45, onGround: false, bounces: 0,
    });
  }
  drops.push({ kind: 'hp', x: chest.x, y: chest.y - 14, vx: -65, vy: -220, amount: 3, age: 0, life: 45, onGround: false, bounces: 0 });
  drops.push({ kind: 'mp', x: chest.x, y: chest.y - 14, vx: 65, vy: -220, amount: 3, age: 0, life: 45, onGround: false, bounces: 0 });
  const eq1 = genItem(Math.max(10, playerLv + 1), chance(0.45) ? 3 : 2, 'weapon');
  const eq2 = genItem(Math.max(10, playerLv + 1), 2, chance(0.5) ? 'armor' : 'badge');
  drops.push({ kind: 'equip', x: chest.x, y: chest.y - 16, vx: -45, vy: -280, amount: 1, item: eq1, age: 0, life: 60, onGround: false, bounces: 0 });
  drops.push({ kind: 'equip', x: chest.x, y: chest.y - 16, vx: 45, vy: -265, amount: 1, item: eq2, age: 0, life: 60, onGround: false, bounces: 0 });
  fx.toast('开启了古林秘宝宝箱！喷出极品装备与大量金币！', '#ffd447');
}

export function drawChest(g: Ctx, chest: Chest, t: number) {
  if (!chest.opened) {
    radial(g, chest.x, chest.y - 12, 24 + Math.sin(t * 4) * 4, 'rgba(255,212,71,0.35)');
  }
  const spr = chestSprite(chest.opened);
  g.drawImage(spr, Math.round(chest.x - 14), Math.round(chest.y - 23));
}

export function overlapRect(a: Rect, b: Rect) {
  return overlap(a, b);
}
