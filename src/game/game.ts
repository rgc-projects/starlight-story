// 核心游戏主控：世界模拟、视差场景渲染、传送门、任务流、战斗结算、Boss 战与拯救公主、自动存档
import { clamp, lerp, rand, dist, overlap, Rect } from '../core/utils';
import { Input } from '../core/input';
import { audio } from '../core/audio';
import { Ctx, rgba } from '../gfx/pixel';
import { VIEW_W, VIEW_H, background, drawBackground, drawForeground, radial } from '../gfx/backgrounds';
import { drawGround, drawPlatform, drawRope, decoSprite, drawWindmillBlades, RARITY_COLORS } from '../gfx/world';
import { npcSprites, HERO_SIZE, HERO_FEET } from '../gfx/characters';
import {
  ENEMIES, QUESTS, SHARDS_NEEDED, genItem, rollRarity, setUidBase, Item, Slot, RARITY_NAMES,
} from './data';
import { MAPS, MapId, MapDef, PortalDef, NpcDef } from './maps';
import { Effects, WarningZone } from './effects';
import { Player, CombatHooks } from './player';
import {
  Enemy, Projectile, ArrowRain, Drop, Chest,
  spawnEnemyDrops, updateDrops, drawDrops, drawProjectile, drawArrowRain, openChest, drawChest,
} from './entities';
import { GameUI, UI_SCALE, UIActions } from './ui';

const SAVE_KEY = 'starlight_story_save_v1';
const PLAY_H = VIEW_H - 50; // 底部经典状态栏高 50px，保留 310px 完整活动视野

interface SaveData {
  mapId: MapId;
  level: number;
  exp: number;
  gold: number;
  shards: number;
  job: Player['job'];
  potHp: number;
  potMp: number;
  equip: Record<Slot, Item | null>;
  bag: Item[];
  questIdx: number;
  questProg: number;
  chestOpened: boolean;
  bossDefeated: boolean;
  playTime: number;
  kills: number;
  maxCrit: number;
  totalGold: number;
}

export class Game {
  private ctx: Ctx;
  private input: Input;
  private fx = new Effects();
  private ui = new GameUI();
  private player = new Player();

  private map: MapDef = MAPS.town;
  private enemies: Enemy[] = [];
  private respawnQueue: { spawnIdx: number; timer: number }[] = [];
  private projs: Projectile[] = [];
  private rains: ArrowRain[] = [];
  private drops: Drop[] = [];
  private chest: Chest | null = null;

  private questIdx = 0;
  private questProg = 0;
  private chestOpened = false;
  private bossDefeated = false;
  private princessRescued = false;
  private victoryDelay = 0;

  private camX = 0;
  private camY = 0;
  private time = 0;
  private playTime = 0;
  private smokeTimer = 0;
  private brazierTimer = 0;

  // 地图淡入淡出切换
  private fade = 0;
  private fadeTarget: { mapId: MapId; portalId?: string } | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    this.canvas.width = VIEW_W * UI_SCALE;
    this.canvas.height = VIEW_H * UI_SCALE;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
    this.input = new Input(canvas, VIEW_W, VIEW_H);
    this.input.onFirstInteract = () => audio.unlock();

    this.loadMap('town');
    this.ui.modal = { kind: 'title', hasSave: this.hasSave(), showHelp: false };
    audio.playMusic('town');
  }

  private actions(): UIActions {
    return {
      startNew: () => {
        this.resetState();
        this.ui.modal = null;
        this.input.consumeAll();
        this.loadMap('town');
        this.ui.showBanner(this.map.name, this.map.sub);
        audio.playMusic(this.map.music);
        const ik = this.input.labels().interact;
        this.fx.toast(`欢迎来到星辉王国！靠近星辉长老按 ${ik} 接取任务（F2 可切换现代/经典键位）`, '#ffe47a');
      },
      continueSave: () => {
        this.ui.modal = null;
        this.input.consumeAll();
        this.loadSave();
        this.ui.showBanner(this.map.name, this.map.sub);
        audio.playMusic(this.map.music);
      },
      closeModal: () => { this.ui.modal = null; this.input.consumeAll(); },
      openInventory: () => {
        audio.sfx('click');
        this.ui.modal = { kind: 'inventory', sel: 0 };
        this.input.consumeAll();
      },
      openPause: () => {
        audio.sfx('click');
        this.ui.modal = { kind: 'pause' };
        this.input.consumeAll();
      },
      returnTown: () => {
        this.ui.modal = null;
        this.input.consumeAll();
        const st = this.player.stats();
        this.player.hp = st.maxHp;
        this.player.mp = st.maxMp;
        this.startTransition('town');
      },
      saveNow: () => {
        this.save();
        this.fx.toast('冒险进度已保存！', '#8aff9a');
      },
      revive: () => {
        this.ui.modal = null;
        this.input.consumeAll();
        const st = this.player.stats();
        this.player.hp = st.maxHp;
        this.player.hpLag = st.maxHp;
        this.player.mp = st.maxMp;
        this.player.invuln = 1.5;
        this.loadMap('town');
        audio.playMusic('town');
        this.fx.toast('星辉守护了你，已在晨风镇恢复全部状态！', '#ffd447');
      },
      continueFreePlay: () => {
        this.ui.modal = null;
        this.input.consumeAll();
        this.save();
        this.startTransition('town');
      },
      backToTitle: () => {
        this.save();
        this.ui.modal = { kind: 'title', hasSave: this.hasSave(), showHelp: false };
        this.input.consumeAll();
        this.loadMap('town');
        audio.playMusic('town');
      },
      openShop: () => this.openBlacksmithShop(),
    };
  }

  private resetState() {
    this.player = new Player();
    this.questIdx = 0;
    this.questProg = 0;
    this.chestOpened = false;
    this.bossDefeated = false;
    this.princessRescued = false;
    this.victoryDelay = 0;
    this.playTime = 0;
  }

  // ==================== 存档系统 ====================
  private hasSave() {
    try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
  }

  private save() {
    try {
      const data: SaveData = {
        mapId: this.map.id === 'tower' ? 'forest' : this.map.id,
        level: this.player.level,
        exp: this.player.exp,
        gold: this.player.gold,
        shards: this.player.shards,
        job: this.player.job,
        potHp: this.player.potHp,
        potMp: this.player.potMp,
        equip: this.player.equip,
        bag: this.player.bag,
        questIdx: this.questIdx,
        questProg: this.questProg,
        chestOpened: this.chestOpened,
        bossDefeated: this.bossDefeated,
        playTime: this.playTime,
        kills: this.player.kills,
        maxCrit: this.player.maxCrit,
        totalGold: this.player.totalGold,
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch { /* ignore storage errors */ }
  }

  private loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) { this.resetState(); this.loadMap('town'); return; }
      const d = JSON.parse(raw) as SaveData;
      this.player = new Player();
      this.player.level = d.level || 1;
      this.player.exp = d.exp || 0;
      this.player.gold = d.gold ?? 120;
      this.player.shards = d.shards ?? 0;
      this.player.job = d.job || 'sword';
      this.player.potHp = d.potHp ?? 5;
      this.player.potMp = d.potMp ?? 5;
      if (d.equip) this.player.equip = d.equip;
      if (d.bag) this.player.bag = d.bag;
      this.player.kills = d.kills ?? 0;
      this.player.maxCrit = d.maxCrit ?? 0;
      this.player.totalGold = d.totalGold ?? this.player.gold;
      // 保持 uid 递增不冲突
      let maxUid = 10;
      for (const it of [...this.player.bag, this.player.equip.weapon, this.player.equip.armor, this.player.equip.badge]) {
        if (it && it.uid >= maxUid) maxUid = it.uid + 1;
      }
      setUidBase(maxUid);
      const st = this.player.stats();
      this.player.hp = st.maxHp;
      this.player.hpLag = st.maxHp;
      this.player.mp = st.maxMp;
      this.questIdx = d.questIdx ?? 0;
      this.questProg = d.questProg ?? 0;
      this.chestOpened = !!d.chestOpened;
      this.bossDefeated = !!d.bossDefeated;
      this.playTime = d.playTime ?? 0;
      this.loadMap(d.mapId || 'town');
    } catch {
      this.resetState();
      this.loadMap('town');
    }
  }

  // ==================== 地图加载与切换 ====================
  private startTransition(mapId: MapId, portalId?: string) {
    if (this.fadeTarget) return;
    audio.sfx('portal');
    this.fadeTarget = { mapId, portalId };
  }

  private loadMap(id: MapId, entryPortalId?: string) {
    this.map = MAPS[id];
    this.fx.clearWorld();
    this.enemies.length = 0;
    this.respawnQueue.length = 0;
    this.projs.length = 0;
    this.rains.length = 0;
    this.drops.length = 0;
    this.princessRescued = false;
    this.victoryDelay = 0;

    // 玩家出生位置
    let sx = this.map.spawnPoint.x, sy = this.map.spawnPoint.y;
    if (entryPortalId) {
      const po = this.map.portals.find((p) => p.id === entryPortalId);
      if (po) {
        sx = clamp(po.x + (po.x < this.map.width / 2 ? 32 : -32), 24, this.map.width - 24);
        sy = po.y;
      }
    }
    this.player.x = sx;
    this.player.y = sy;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.climbing = false;
    this.player.climbRope = null;
    this.player.whirlTimer = 0;
    this.player.chargeTimer = 0;

    // 刷新怪物
    this.map.spawns.forEach((sp, idx) => {
      this.enemies.push(new Enemy(sp.kind, sp.x, sp.y, this.map, idx));
    });
    if (this.map.boss) {
      this.enemies.push(new Enemy('boss', 700, 320, this.map, -1));
    }

    // 隐藏宝箱
    this.chest = this.map.chest ? { x: this.map.chest.x, y: this.map.chest.y, opened: this.chestOpened } : null;

    // 立即对齐相机
    const vh = this.ui.modal?.kind === 'title' ? VIEW_H : PLAY_H;
    this.camX = clamp(this.player.x - VIEW_W / 2, 0, Math.max(0, this.map.width - VIEW_W));
    this.camY = clamp(this.player.y - vh * 0.72, 0, Math.max(0, this.map.height - vh));
    if (this.ui.modal?.kind !== 'title') {
      this.ui.showBanner(this.map.name, this.map.sub);
      audio.playMusic(this.map.music);
    }
  }

  // ==================== 战斗回调 ====================
  private combatHooks(): CombatHooks {
    return {
      meleeHit: (rect, mult, kbX, kbY, hitId, color, isSkill) => {
        let hits = 0;
        for (const e of this.enemies) {
          if (!e.alive) continue;
          if (overlap(rect, e.hitbox())) {
            this.damageEnemy(e, mult, kbX, kbY, hitId, color);
            hits++;
          }
        }
        // 攻击也可直接敲开宝箱
        if (this.chest && !this.chest.opened) {
          const cb: Rect = { x: this.chest.x - 16, y: this.chest.y - 26, w: 32, h: 28 };
          if (overlap(rect, cb)) this.triggerChest();
        }
        void isSkill;
        return hits;
      },
      spawnBolt: (x, y, vx, vy, mult, kind, color, pierce = 1) => {
        this.projs.push({
          fromPlayer: true, kind, x, y, vx, vy, mult, color,
          life: kind === 'wave' ? 0.36 : 1.15, pierce, hitId: ++this.player.hitSeq, trailT: 0,
        });
      },
      spawnMeteor: (targetX, groundY, mult, delay) => {
        const warn: WarningZone = { kind: 'circle', x: targetX, y: groundY, w: 50, h: 18, t: 0, dur: 0.42 + delay, color: '#ff8a2a' };
        this.fx.warnings.push(warn);
        this.projs.push({
          fromPlayer: true, kind: 'meteor',
          x: targetX - this.player.dir * 130, y: groundY - 290,
          vx: this.player.dir * 310, vy: 690,
          mult, color: '#ff8a2a', life: 2.2, pierce: 99, hitId: ++this.player.hitSeq,
          targetY: groundY, delay, warn, trailT: 0,
        });
      },
      spawnArrowRain: (x, y, w, dur, mult) => {
        this.rains.push({ x, y, w, life: dur, maxLife: dur, tick: 0, mult, arrows: [] });
      },
      onLevelUp: () => this.save(),
    };
  }

  private damageEnemy(e: Enemy, mult: number, kbX: number, kbY: number, hitId: number, color: string) {
    const st = this.player.stats();
    const crit = Math.random() < st.crit;
    let dmg = Math.max(1, Math.round(st.atk * mult * rand(0.92, 1.08) - e.def * 0.45));
    if (crit) {
      dmg = Math.round(dmg * st.critDmg);
      if (dmg > this.player.maxCrit) this.player.maxCrit = dmg;
    }
    const killed = e.hurt(dmg, crit, kbX, kbY, hitId, this.fx, color);
    if (killed) this.onEnemyKilled(e);
  }

  private onEnemyKilled(e: Enemy) {
    const def = ENEMIES[e.kind];
    this.player.kills++;
    this.player.gainExp(def.exp, this.fx, this.combatHooks());
    spawnEnemyDrops(e, this.drops);

    // 野外怪物定时刷新
    if (e.fromSpawnIdx >= 0) {
      this.respawnQueue.push({ spawnIdx: e.fromSpawnIdx, timer: rand(4.8, 6.2) });
    }

    // 推进主线任务
    const q = QUESTS[this.questIdx];
    if (q && q.type === 'kill' && q.target === e.kind && q.count) {
      this.questProg++;
      if (this.questProg >= q.count) this.completeQuest();
    } else if (e.kind === 'boss') {
      this.onBossDefeated();
    }
  }

  private completeQuest() {
    const q = QUESTS[this.questIdx];
    if (!q) return;
    audio.sfx('quest');
    this.fx.toast(`★ 主线任务完成：${q.title}！`, '#ffe47a');
    if (q.reward) {
      if (q.reward.exp) this.player.gainExp(q.reward.exp, this.fx, this.combatHooks());
      if (q.reward.gold) {
        this.player.gold += q.reward.gold;
        this.player.totalGold += q.reward.gold;
        this.fx.toast(`任务奖励：+${q.reward.gold} 金币`, '#ffd447');
      }
      if (q.reward.shard) {
        this.player.shards = Math.min(SHARDS_NEEDED, this.player.shards + q.reward.shard);
        this.fx.toast(`获得星辉碎片！(${this.player.shards}/${SHARDS_NEEDED})`, '#7ff8ff');
        this.fx.spawnRing(this.player.x, this.player.y - 18, 52, '#7ff8ff', 0.5, 3);
      }
      if (q.reward.item) {
        const it = genItem(q.reward.item.level, q.reward.item.rarity, q.reward.item.slot);
        this.player.addItem(it, this.fx);
        this.fx.toast(`任务奖励装备：[${RARITY_NAMES[it.rarity]}] ${it.name}！`, RARITY_COLORS[it.rarity]);
      }
    }
    this.questIdx = Math.min(QUESTS.length - 1, this.questIdx + 1);
    this.questProg = 0;
    this.save();
  }

  private onBossDefeated() {
    // 清理残余暗影小鬼与敌方投射物
    for (const e of this.enemies) {
      if (e.alive && e.kind === 'imp') {
        e.alive = false;
        this.fx.burst(e.x, e.y - 8, 10, ['#c060ff', '#ffffff'], 30, 100, 60);
      }
    }
    this.projs = this.projs.filter((p) => p.fromPlayer);
    this.bossDefeated = true;
    this.princessRescued = true;
    this.victoryDelay = 1.9;
    audio.sfx('break');
    audio.sfx('victory');
    audio.playMusic('victory');
    this.fx.shake(8, 0.7);
    this.fx.flash('#fff8d0', 0.75);
    // 黄金囚笼粉碎特效
    this.fx.burst(825, 225, 36, ['#ffd447', '#fff8b0', '#7ff8ff', '#ffffff'], 50, 200, 140);
    this.fx.spawnRing(825, 225, 95, '#ffd447', 0.7, 4);
    this.fx.toast('暗影魔王已被击败！艾莉娅公主的囚笼破碎了！', '#ffe47a');
    if (this.questIdx < QUESTS.length - 1) {
      this.questIdx = QUESTS.length - 1;
      this.questProg = 0;
    }
    this.save();
  }

  private triggerChest() {
    if (!this.chest || this.chest.opened) return;
    this.chestOpened = true;
    openChest(this.chest, this.drops, this.fx, this.player.level);
    if (this.player.shards < SHARDS_NEEDED) {
      this.drops.push({
        kind: 'shard', x: this.chest.x, y: this.chest.y - 18,
        vx: 0, vy: -290, amount: 1, age: 0, life: 60, onGround: false, bounces: 0,
      });
    }
    this.save();
  }

  // ==================== NPC 互动与传送门 ====================
  private handleInteract() {
    // 1. 隐藏宝箱
    if (this.chest && !this.chest.opened && dist(this.player.x, this.player.y, this.chest.x, this.chest.y) < 38) {
      this.triggerChest();
      return true;
    }
    // 2. NPC
    for (const npc of this.map.npcs) {
      if (dist(this.player.x, this.player.y, npc.x, npc.y) < 38) {
        audio.sfx('select');
        this.input.consumeAll();
        this.openNpc(npc);
        return true;
      }
    }
    // 3. 传送门
    for (const po of this.map.portals) {
      if (dist(this.player.x, this.player.y, po.x, po.y) < 36) {
        if (po.locked && this.player.shards < SHARDS_NEEDED) {
          audio.sfx('error');
          this.fx.toast(`蚀月高塔被暗影结界封印！还需收集 ${SHARDS_NEEDED - this.player.shards} 枚星辉碎片`, '#ff8aa0');
          return true;
        }
        this.save();
        this.startTransition(po.to, po.toPortal);
        return true;
      }
    }
    return false;
  }

  private openNpc(npc: NpcDef) {
    if (npc.kind === 'sign') {
      const kb = this.input.labels();
      this.ui.modal = {
        kind: 'dialog', speaker: '晨风镇告示牌', portrait: 'sign', idx: 0,
        lines: [
          '【王国通告】暗影魔王·莫德雷德突袭王都，囚禁了艾莉娅公主于东方的蚀月高塔！\n唯有集齐 3 枚星辉碎片，方能打破高塔暗影结界。',
          `【当前键位：${kb.name}】（按 F2 或点右下角可随时切换）\n移动：${kb.move} | 跳/空中冲刺：${kb.jump} | 下穿：${kb.drop}\n普攻：${kb.attack} | 技能：${kb.skill1} / ${kb.skill2} | 互动：${kb.interact} | 喝药：Z/X | 切职业：1/2/3`,
        ],
      };
    } else if (npc.kind === 'smith') {
      this.openBlacksmithShop();
    } else {
      // 星辉长老
      if (this.questIdx === 0) {
        this.ui.modal = {
          kind: 'dialog', speaker: '星辉长老', portrait: 'elder', idx: 0,
          lines: [
            '王子殿下，您终于醒来了！暗影魔王把艾莉娅公主掳到了最东方的蚀月高塔！\n只有沿着东方穿越【翠绿草原】与【萤火古林】，收集 3 枚星辉碎片才能破除结界。',
            '您随时可以按 1/2/3 切换【圣光剑士】【星辰法师】【疾风游侠】三大流派！\n先去东边草原清理青苔史莱姆热热身吧，老夫赠送您 100 金币作旅费！',
          ],
          actions: [
            {
              label: '接受使命！',
              fn: () => {
                this.player.gold += 100;
                this.player.totalGold += 100;
                this.completeQuest();
                this.ui.modal = null;
              },
            },
          ],
        };
      } else {
        const q = QUESTS[this.questIdx];
        const msg = this.bossDefeated
          ? '殿下凯旋而归，艾莉娅公主平安无事，整个星辉王国都在为您欢呼！\n您随时可以继续前往各地冒险、刷怪打造终极传说装备！'
          : `当前主线：【${q.title}】\n${q.desc} — ${q.hint}。需要老夫为您恢复全部精力吗？`;
        this.ui.modal = {
          kind: 'dialog', speaker: '星辉长老', portrait: 'elder', idx: 0,
          lines: [msg],
          actions: [
            {
              label: '免费回满状态',
              fn: () => {
                const st = this.player.stats();
                this.player.hp = st.maxHp;
                this.player.hpLag = st.maxHp;
                this.player.mp = st.maxMp;
                audio.sfx('potion');
                this.fx.burst(this.player.x, this.player.y - 18, 16, ['#9aff8a', '#7fe0ff', '#fff8b0'], 30, 100, -30);
                this.fx.toast('长老为您施展了星辉治愈，HP / MP 全满！', '#9aff8a');
                this.ui.modal = null;
              },
            },
            { label: '稍后再来', fn: () => { this.ui.modal = null; } },
          ],
        };
      }
    }
  }

  private openBlacksmithShop() {
    const lv = Math.max(2, this.player.level + 1);
    this.ui.modal = {
      kind: 'shop', tab: 0, msg: '', msgT: 0,
      stock: [
        genItem(lv, Math.max(1, rollRarity(0.25)), 'weapon'),
        genItem(lv, Math.max(1, rollRarity(0.25)), 'armor'),
        genItem(lv, Math.max(1, rollRarity(0.25)), 'badge'),
      ],
    };
  }

  // ==================== 主更新循环 ====================
  update(rawDt: number) {
    const dt = Math.min(rawDt, 0.05);
    this.time += dt;
    if (this.ui.bannerTimer > 0) this.ui.bannerTimer = Math.max(0, this.ui.bannerTimer - dt);

    // 静音与键位方案切换快捷键任何时刻生效
    if (this.input.pressed('mute')) audio.toggleMute();
    if (this.input.pressed('scheme')) {
      this.input.toggleScheme();
      audio.sfx('select');
      this.fx.toast(`已切换键位：${this.input.labels().name}`, '#7fe0ff');
    }

    // 标题画面：只更新背景粒子与微动效
    if (this.ui.modal?.kind === 'title') {
      const bg = background(this.map.theme);
      this.fx.updateAmbient(dt, bg.particle, this.camX, this.camY, VIEW_W, VIEW_H);
      this.fx.update(dt);
      this.camX = (this.time * 18) % Math.max(1, this.map.width - VIEW_W);
      this.camY = Math.max(0, this.map.height - VIEW_H);
      return;
    }

    // 地图淡入淡出过渡
    if (this.fadeTarget) {
      this.fade = Math.min(1, this.fade + dt * 3.8);
      if (this.fade >= 1) {
        const tgt = this.fadeTarget;
        this.fadeTarget = null;
        this.loadMap(tgt.mapId, tgt.portalId);
      }
      return;
    } else if (this.fade > 0) {
      this.fade = Math.max(0, this.fade - dt * 3.2);
    }

    // 死亡倒计时
    if (this.ui.modal?.kind === 'dead') {
      this.ui.modal.timer -= dt;
      this.fx.update(dt);
      return;
    }

    // 有弹窗打开时暂停战斗物理（仅更新特效尾帧）
    if (this.ui.modal !== null) {
      this.fx.update(dt);
      return;
    }

    // 开发者炫技快捷键 F9：一键满级试玩 Boss
    if (this.input.pressed('cheat')) {
      this.player.level = Math.max(this.player.level, 12);
      this.player.shards = SHARDS_NEEDED;
      this.player.gold += 1000;
      this.player.equip.weapon = genItem(12, 3, 'weapon');
      this.player.equip.armor = genItem(12, 2, 'armor');
      this.player.equip.badge = genItem(12, 3, 'badge');
      const st = this.player.stats();
      this.player.hp = st.maxHp;
      this.player.mp = st.maxMp;
      this.questIdx = 5;
      audio.sfx('levelup');
      this.fx.spawnLevelUp(this.player.x, this.player.y, this.player.level);
      this.fx.toast('【展示模式 F9】已获 Lv.12 传说套与 3 枚星辉碎片！', '#ffd447');
    }

    // 打开背包或暂停菜单
    if (this.input.pressed('inventory')) {
      this.actions().openInventory();
      return;
    }
    if (this.input.pressed('pause')) {
      this.actions().openPause();
      return;
    }

    // 互动键（现代模式 F/E/W/↑，经典模式 ↑/E：优先检查对话/宝箱/传送门）
    if (this.input.pressed('interact') && !this.player.climbing) {
      if (this.handleInteract()) return;
    }

    // 命中顿帧（Hit-Stop 打击感）
    if (this.fx.hitStop > 0) {
      this.fx.hitStop -= dt;
      this.fx.update(dt * 0.25);
      return;
    }

    this.playTime += dt;

    // 玩家更新（传入 camX 以支持现代模式鼠标主战区自动朝向攻击）
    const hooks = this.combatHooks();
    this.player.update(dt, this.input, this.map, this.fx, hooks, this.victoryDelay <= 0, this.camX);

    // 玩家死亡检测
    if (this.player.hp <= 0) {
      this.ui.modal = { kind: 'dead', timer: 5.5 };
      return;
    }

    // Boss 胜利后短暂欢呼再弹出拯救公主剧情
    if (this.victoryDelay > 0) {
      this.victoryDelay -= dt;
      if (this.victoryDelay <= 0) {
        this.ui.modal = { kind: 'victory', time: this.playTime, stage: 'cutscene', lineIdx: 0 };
        return;
      }
    }

    // 怪物更新与定时刷新
    const eHooks = {
      spawnEnemyProj: (x: number, y: number, vx: number, vy: number, atk: number, color: string) => {
        this.projs.push({ fromPlayer: false, kind: 'enemy', x, y, vx, vy, mult: atk, color, life: 2.8, pierce: 1, hitId: 0, trailT: 0 });
      },
      summonImp: (x: number, y: number) => {
        this.enemies.push(new Enemy('imp', x, y, this.map, -1));
      },
      countImps: () => this.enemies.filter((e) => e.alive && e.kind === 'imp').length,
      bossLightningHit: (x: number, y: number, r: number, atk: number) => {
        if (Math.abs(this.player.x - x) < r && this.player.y > y - 160) {
          this.player.takeDamage(atk, x, this.fx);
        }
      },
    };

    const pBox = this.player.hitbox();
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e.alive) { this.enemies.splice(i, 1); continue; }
      e.update(dt, this.player, this.map, this.fx, eHooks);
      // 怪物接触伤害
      const eBox = e.hitbox();
      if (overlap(pBox, eBox)) {
        const atk = e.kind === 'boss' && e.state === 'charge_go' ? Math.round(e.atk * 1.45) : e.atk;
        this.player.takeDamage(atk, e.x, this.fx);
      }
    }

    // 野外刷怪重生队列
    for (let i = this.respawnQueue.length - 1; i >= 0; i--) {
      const rq = this.respawnQueue[i];
      rq.timer -= dt;
      if (rq.timer <= 0) {
        const sp = this.map.spawns[rq.spawnIdx];
        if (sp) {
          this.enemies.push(new Enemy(sp.kind, sp.x, sp.y, this.map, rq.spawnIdx));
          this.fx.spawnRing(sp.x, sp.y - 12, 22, '#9affb0', 0.35, 2);
        }
        this.respawnQueue.splice(i, 1);
      }
    }

    // 投射物更新
    this.updateProjectiles(dt);
    // 疾风箭雨更新
    this.updateArrowRains(dt);
    // 掉落物物理与磁吸拾取
    updateDrops(dt, this.drops, this.player, this.map, this.fx);

    // 场景小动效（烟囱烟雾 / 高塔火盆紫炎）
    if (this.map.smoke) {
      this.smokeTimer -= dt;
      if (this.smokeTimer <= 0) {
        this.smokeTimer = 0.45;
        for (const s of this.map.smoke) {
          this.fx.particles.push({
            x: s.x + rand(-2, 2), y: s.y, vx: rand(4, 14), vy: rand(-22, -12),
            life: 1.6, maxLife: 1.6, size: rand(3, 6), color: '#e8e8f4', gravity: -4, shape: 'circle', alpha: 0.45,
          });
        }
      }
    }
    if (this.map.braziers) {
      this.brazierTimer -= dt;
      if (this.brazierTimer <= 0) {
        this.brazierTimer = 0.08;
        for (const b of this.map.braziers) {
          this.fx.particles.push({
            x: b.x + rand(-6, 6), y: b.y, vx: rand(-8, 8), vy: rand(-42, -18),
            life: rand(0.3, 0.55), maxLife: 0.55, size: rand(2, 4),
            color: Math.random() < 0.5 ? '#c060ff' : '#ff6aa0', gravity: -15, glow: true, shape: 'sq',
          });
        }
      }
    }

    // 相机平滑跟随（带前方微前瞻，确保地面与角色完整展示在底部 HUD 之上）
    const targetX = clamp(this.player.x + this.player.dir * 38 - VIEW_W / 2, 0, Math.max(0, this.map.width - VIEW_W));
    const targetY = clamp(this.player.y - PLAY_H * 0.72, 0, Math.max(0, this.map.height - PLAY_H));
    this.camX = lerp(this.camX, targetX, Math.min(1, dt * 6.5));
    this.camY = lerp(this.camY, targetY, Math.min(1, dt * 5.5));

    const bg = background(this.map.theme);
    this.fx.updateAmbient(dt, bg.particle, this.camX, this.camY, VIEW_W, VIEW_H);
    this.fx.update(dt);
  }

  private updateProjectiles(dt: number) {
    const pBox = this.player.hitbox();
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const p = this.projs[i];
      if ((p.delay ?? 0) > 0) {
        p.delay = (p.delay ?? 0) - dt;
        if (p.warn) p.warn.t += dt;
        continue;
      }
      if (p.warn) p.warn.t += dt;
      p.life -= dt;
      if (p.life <= 0) { this.removeProjWarn(p); this.projs.splice(i, 1); continue; }

      // 法师星光魔弹轻微追踪前方怪物
      if (p.kind === 'magic') {
        let best: Enemy | null = null, bestD = 150;
        for (const e of this.enemies) {
          if (!e.alive || e.hitIds.has(p.hitId)) continue;
          const d = dist(p.x, p.y, e.x, e.y - e.h * 0.5);
          if (d < bestD) { bestD = d; best = e; }
        }
        if (best) {
          const ang = Math.atan2((best.y - best.h * 0.5) - p.y, best.x - p.x);
          p.vx = lerp(p.vx, Math.cos(ang) * 330, dt * 5);
          p.vy = lerp(p.vy, Math.sin(ang) * 330, dt * 5);
        }
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // 拖尾粒子
      p.trailT -= dt;
      if (p.trailT <= 0) {
        p.trailT = p.kind === 'meteor' ? 0.018 : 0.035;
        this.fx.particles.push({
          x: p.x + rand(-2, 2), y: p.y + rand(-2, 2),
          vx: rand(-15, 15), vy: rand(-15, 15),
          life: p.kind === 'meteor' ? 0.32 : 0.18, maxLife: 0.32,
          size: p.kind === 'meteor' ? rand(3, 5.5) : rand(1.5, 3),
          color: p.kind === 'meteor' ? (Math.random() < 0.5 ? '#ff6a2a' : '#ffd447') : p.color,
          gravity: 0, glow: true, shape: 'circle',
        });
      }

      // 陨石落地引爆
      if (p.kind === 'meteor' && p.targetY !== undefined && p.y >= p.targetY) {
        this.removeProjWarn(p);
        audio.sfx('explode');
        this.fx.shake(6, 0.28);
        this.fx.spawnRing(p.x, p.targetY - 6, 68, '#ff8a2a', 0.4, 4);
        this.fx.spawnRing(p.x, p.targetY - 6, 46, '#ffd447', 0.3, 2.5);
        this.fx.burst(p.x, p.targetY - 10, 26, ['#ff6a2a', '#ffd447', '#c070ff', '#ffffff'], 45, 200, 140);
        const blast: Rect = { x: p.x - 66, y: p.targetY - 90, w: 132, h: 100 };
        for (const e of this.enemies) {
          if (e.alive && overlap(blast, e.hitbox())) {
            this.damageEnemy(e, p.mult, (e.x >= p.x ? 1 : -1) * 165, -165, p.hitId, '#ff8a2a');
          }
        }
        this.projs.splice(i, 1);
        continue;
      }

      if (p.fromPlayer && p.kind !== 'meteor') {
        const rad = p.kind === 'wave' ? 18 : 8;
        const r: Rect = { x: p.x - rad, y: p.y - rad, w: rad * 2, h: rad * 2 };
        let hitCount = 0;
        for (const e of this.enemies) {
          if (!e.alive || e.hitIds.has(p.hitId)) continue;
          if (overlap(r, e.hitbox())) {
            this.damageEnemy(e, p.mult, Math.sign(p.vx) * 75, -35, p.hitId, p.color);
            p.pierce--;
            hitCount++;
            if (p.pierce <= 0) break;
          }
        }
        if (this.chest && !this.chest.opened && overlap(r, { x: this.chest.x - 14, y: this.chest.y - 24, w: 28, h: 24 })) {
          this.triggerChest();
        }
        if (p.pierce <= 0 || p.x < -40 || p.x > this.map.width + 40) {
          if (hitCount > 0 && p.kind === 'magic') this.fx.spawnRing(p.x, p.y, 18, p.color, 0.2, 2);
          this.projs.splice(i, 1);
        }
      } else if (!p.fromPlayer) {
        const r: Rect = { x: p.x - 5, y: p.y - 5, w: 10, h: 10 };
        if (overlap(r, pBox)) {
          this.player.takeDamage(p.mult, p.x, this.fx);
          this.projs.splice(i, 1);
        } else if (p.x < -40 || p.x > this.map.width + 40 || p.y > this.map.height + 40) {
          this.projs.splice(i, 1);
        }
      }
    }
  }

  private removeProjWarn(p: Projectile) {
    if (!p.warn) return;
    const idx = this.fx.warnings.indexOf(p.warn);
    if (idx >= 0) this.fx.warnings.splice(idx, 1);
    p.warn = undefined;
  }

  private updateArrowRains(dt: number) {
    for (let i = this.rains.length - 1; i >= 0; i--) {
      const r = this.rains[i];
      r.life -= dt;
      if (r.life <= 0) { this.rains.splice(i, 1); continue; }
      // 持续生成从天而降的箭矢视觉
      for (let k = 0; k < 2; k++) {
        r.arrows.push({ x: r.x + rand(-r.w / 2, r.w / 2), y: r.y - rand(150, 220), vy: rand(460, 580) });
      }
      for (let j = r.arrows.length - 1; j >= 0; j--) {
        const a = r.arrows[j];
        a.y += a.vy * dt;
        if (a.y >= r.y) {
          this.fx.particles.push({
            x: a.x, y: r.y, vx: rand(-30, 30), vy: rand(-55, -15),
            life: 0.2, maxLife: 0.2, size: 2, color: '#6af09a', gravity: 180,
          });
          r.arrows.splice(j, 1);
        }
      }
      r.tick -= dt;
      if (r.tick <= 0) {
        r.tick = 0.24;
        audio.sfx('arrow');
        const zone: Rect = { x: r.x - r.w / 2, y: r.y - 140, w: r.w, h: 148 };
        const hid = ++this.player.hitSeq;
        for (const e of this.enemies) {
          if (e.alive && overlap(zone, e.hitbox())) {
            this.damageEnemy(e, r.mult, 0, -25, hid, '#6af09a');
          }
        }
      }
    }
  }

  // ==================== 渲染管线 ====================
  render() {
    const g = this.ctx;
    const isTitle = this.ui.modal?.kind === 'title';
    const maxCamY = Math.max(0, this.map.height - (isTitle ? VIEW_H : PLAY_H));
    const cx = Math.round(this.camX + this.fx.shakeX);
    const cy = Math.round(this.camY + this.fx.shakeY);

    // 1. 世界层（640x360 锐利像素放大 2x 到 1280x720）
    g.save();
    g.scale(UI_SCALE, UI_SCALE);
    g.imageSmoothingEnabled = false;

    const bg = background(this.map.theme);
    drawBackground(g, bg, cx, cy, maxCamY, this.time);

    g.save();
    g.translate(-cx, -cy);

    // 地面与薄平台
    for (const p of this.map.platforms) {
      if (p.x + p.w < cx - 32 || p.x > cx + VIEW_W + 32) continue;
      if (p.solid) drawGround(g, this.map.theme, p.x, p.y, p.w, this.map.height - p.y + 80, cx, VIEW_W);
      else drawPlatform(g, this.map.theme, p.x, p.y, p.w);
    }

    // 绳索与梯子
    for (const r of this.map.ropes) drawRope(g, r.x, r.top, r.bottom, !!r.ladder);

    // 后景装饰物 + 光源
    for (const d of this.map.decos) {
      if (d.front) continue;
      this.drawDeco(g, d.kind, d.x, d.y);
    }
    if (this.map.windmills) {
      for (const wm of this.map.windmills) drawWindmillBlades(g, wm.x, wm.y, this.time * 0.75);
    }

    // 传送门
    for (const po of this.map.portals) this.drawPortal(g, po);

    // 蚀月高塔：被囚禁（或刚获救）的艾莉娅公主
    if (this.map.boss) this.drawTowerPrincess(g);

    // 通关后艾莉娅公主回到晨风镇长老身旁！
    if (this.map.id === 'town' && this.bossDefeated) {
      const pf = npcSprites('princess')[Math.floor(this.time * 2) % 2].l;
      g.drawImage(pf, Math.round(485 - HERO_SIZE / 2), Math.round(352 - HERO_FEET));
    }

    // 隐藏宝箱
    if (this.chest) drawChest(g, this.chest, this.time);

    // 预警红圈 / 红线
    this.fx.drawWarnings(g);

    // NPC
    for (const npc of this.map.npcs) this.drawNpc(g, npc);

    // 残影
    this.fx.drawAfterimages(g);

    // 怪物 & Boss
    for (const e of this.enemies) e.draw(g);

    // 玩家（非标题画面显示）
    if (this.ui.modal?.kind !== 'title') this.player.draw(g, this.time);

    // 箭雨 & 投射物
    for (const r of this.rains) drawArrowRain(g, r);
    for (const p of this.projs) drawProjectile(g, p);

    // 抛物线掉落物
    drawDrops(g, this.drops, this.time);

    // 战场特效（斩击、圣光柱、落雷、冲击波、粒子）
    this.fx.drawWorldFx(g);

    // 前景装饰（草丛、发光菇）
    for (const d of this.map.decos) {
      if (!d.front) continue;
      this.drawDeco(g, d.kind, d.x, d.y);
    }

    // 飘浮环境粒子（花瓣/萤火虫/火星）
    this.fx.drawAmbient(g);

    // 伤害跳字 & LEVEL UP!
    this.fx.drawNumbers(g);

    g.restore();

    // 最前景视差草丛层（游戏内贴齐底部 HUD 上缘）
    drawForeground(g, bg, cx, cy, maxCamY, this.time, isTitle ? 0 : -48);

    // 屏幕闪白/闪金
    if (this.fx.flashAlpha > 0) {
      g.fillStyle = rgba(this.fx.flashColor, this.fx.flashAlpha);
      g.fillRect(0, 0, VIEW_W, VIEW_H);
    }

    g.restore();

    // 2. 世界头顶高清中文互动提示气泡（在 1280x720 原生层画，确保中文清晰！）
    if (this.ui.modal === null) this.drawWorldPrompts(g, cx, cy);

    // 3. 经典 RPG HUD（非标题画面显示）
    const acts = this.actions();
    if (this.ui.modal?.kind !== 'title') {
      this.ui.drawHUD(g, this.player, this.map, this.enemies, this.chest, this.fx, this.questIdx, this.questProg, this.input, acts, this.time);
    }

    // 4. 弹窗与全屏菜单
    this.ui.updateAndDrawModal(g, this.player, this.input, this.fx, acts, this.time);

    // 5. 地图切换黑幕
    if (this.fade > 0) {
      g.fillStyle = `rgba(8,5,18,${this.fade})`;
      g.fillRect(0, 0, VIEW_W * UI_SCALE, VIEW_H * UI_SCALE);
    }

    this.input.endFrame();
  }

  private drawDeco(g: Ctx, kind: string, x: number, y: number) {
    const d = decoSprite(kind);
    g.drawImage(d.c, Math.round(x - d.ax), Math.round(y - d.ay));
    if (d.glow) {
      for (const gl of d.glow) {
        const pulse = 1 + Math.sin(this.time * 3 + x) * 0.12;
        radial(g, x + gl.x, y + gl.y, gl.r * pulse, rgba(gl.color, 0.32));
      }
    }
  }

  private drawNpc(g: Ctx, npc: NpcDef) {
    if (npc.kind === 'sign') {
      this.drawDeco(g, 'sign', npc.x, npc.y);
      return;
    }
    const frames = npcSprites(npc.kind);
    const fr = frames[Math.floor(this.time * 2.2) % frames.length];
    const dir = this.player.x >= npc.x ? 1 : -1;
    const img = dir > 0 ? fr.r : fr.l;
    g.fillStyle = 'rgba(15,8,30,0.3)';
    g.beginPath();
    g.ellipse(npc.x, npc.y + 1, 10, 3, 0, 0, Math.PI * 2);
    g.fill();
    g.drawImage(img, Math.round(npc.x - HERO_SIZE / 2), Math.round(npc.y - HERO_FEET));
    // 长老接任务头顶金色叹号
    if (npc.kind === 'elder' && this.questIdx === 0) {
      const bob = Math.sin(this.time * 6) * 2.5;
      g.fillStyle = '#ffd447';
      g.fillRect(Math.round(npc.x - 2), Math.round(npc.y - 48 + bob), 4, 9);
      g.fillRect(Math.round(npc.x - 2), Math.round(npc.y - 37 + bob), 4, 3);
    }
  }

  private drawPortal(g: Ctx, po: PortalDef) {
    const locked = po.locked && this.player.shards < SHARDS_NEEDED;
    const col = locked ? '#ff4a6a' : '#5ce8ff';
    const col2 = locked ? '#902040' : '#a070ff';
    const cy = po.y - 24;
    const pulse = 1 + Math.sin(this.time * 4) * 0.08;
    radial(g, po.x, cy, 34 * pulse, rgba(col, 0.35));
    // 外旋涡光环
    g.save();
    g.strokeStyle = col;
    g.lineWidth = 2.5;
    g.beginPath();
    g.ellipse(po.x, cy, 15 * pulse, 24 * pulse, 0, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = rgba(col2, 0.45);
    g.beginPath();
    g.ellipse(po.x, cy, 12, 20, 0, 0, Math.PI * 2);
    g.fill();
    // 旋转光点
    for (let i = 0; i < 4; i++) {
      const a = this.time * 3.5 + (i * Math.PI) / 2;
      g.fillStyle = '#ffffff';
      g.fillRect(Math.round(po.x + Math.cos(a) * 10) - 1, Math.round(cy + Math.sin(a) * 18) - 1, 2, 2);
    }
    g.restore();
  }

  private drawTowerPrincess(g: Ctx) {
    const pf = npcSprites('princess')[Math.floor(this.time * 2.5) % 2].l;
    if (!this.princessRescued) {
      const cx = 815, cy = 242 + Math.sin(this.time * 2) * 2.5;
      // 锁链悬吊
      g.fillStyle = '#a08030';
      for (let y = 0; y < cy - 58; y += 6) g.fillRect(cx - 1, y, 2, 4);
      radial(g, cx, cy - 22, 34, 'rgba(255,212,140,0.28)');
      g.drawImage(pf, Math.round(cx - HERO_SIZE / 2), Math.round(cy - HERO_FEET - 2));
      const cage = decoSprite('cage');
      g.drawImage(cage.c, Math.round(cx - cage.ax), Math.round(cy - cage.ay));
    } else {
      // 获救后站在黎明圣光中
      const px = 780, py = 320;
      radial(g, px, py - 24, 52, 'rgba(255,235,150,0.45)');
      g.drawImage(pf, Math.round(px - HERO_SIZE / 2), Math.round(py - HERO_FEET));
    }
  }

  private drawWorldPrompts(g: Ctx, cx: number, cy: number) {
    const label = (wx: number, wy: number, text: string, bg: string, color = '#ffffff') => {
      const sx = (wx - cx) * UI_SCALE;
      const sy = (wy - cy) * UI_SCALE;
      if (sx < -80 || sx > VIEW_W * UI_SCALE + 80 || sy < -40 || sy > VIEW_H * UI_SCALE) return;
      g.save();
      g.font = 'bold 14px "Microsoft YaHei", "PingFang SC", sans-serif';
      const w = g.measureText(text).width + 16;
      g.fillStyle = bg;
      g.fillRect(Math.round(sx - w / 2), Math.round(sy - 11), Math.round(w), 22);
      g.strokeStyle = 'rgba(255,220,120,0.75)';
      g.lineWidth = 1.5;
      g.strokeRect(Math.round(sx - w / 2), Math.round(sy - 11), Math.round(w), 22);
      g.fillStyle = color;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(text, Math.round(sx), Math.round(sy));
      g.restore();
    };

    const ik = this.input.labels().interact;
    // NPC 名牌与互动提示
    for (const npc of this.map.npcs) {
      const near = dist(this.player.x, this.player.y, npc.x, npc.y) < 42;
      label(npc.x, npc.y - 44, near ? `[${ik}] ${npc.kind === 'smith' ? '打开铁匠铺' : '对话'} (${npc.name})` : npc.name, near ? 'rgba(42,30,86,0.92)' : 'rgba(14,12,30,0.72)', near ? '#ffe47a' : '#d8e8ff');
    }
    // 传送门目的地名牌
    for (const po of this.map.portals) {
      const locked = po.locked && this.player.shards < SHARDS_NEEDED;
      const near = dist(this.player.x, this.player.y, po.x, po.y) < 48;
      const text = locked ? `🔒 ${po.label} (需3碎片)` : near ? `[${ik}] 进入 ${po.label}` : po.label;
      label(po.x, po.y - 54, text, near ? 'rgba(24,52,88,0.92)' : 'rgba(14,12,30,0.72)', locked ? '#ff9aa8' : near ? '#8ef8ff' : '#c8e4ff');
    }
    // 宝箱提示
    if (this.chest && !this.chest.opened && dist(this.player.x, this.player.y, this.chest.x, this.chest.y) < 55) {
      label(this.chest.x, this.chest.y - 34, `[${ik}] 开启秘宝宝箱！`, 'rgba(68,42,16,0.92)', '#ffe47a');
    }
    // 通关后晨风镇公主名牌
    if (this.map.id === 'town' && this.bossDefeated) {
      label(485, 352 - 44, '艾莉娅公主', 'rgba(56,22,48,0.78)', '#ffb8e0');
    }
  }
}
