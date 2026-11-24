// 游戏数据：职业、技能、怪物、装备、任务
import { rand, randInt, choice } from '../core/utils';
import type { JobId } from '../gfx/characters';
import type { EnemyKind } from '../gfx/monsters';

export type { JobId, EnemyKind };

// ======================== 职业 ========================
export interface SkillDef {
  key: 'Q' | 'W';
  name: string;
  desc: string;
  mp: number;
  cd: number;
  icon: string;
}
export interface JobDef {
  id: JobId;
  name: string;
  short: string;
  desc: string;
  hp: number; // 生命倍率
  mp: number; // 法力倍率
  atk: number; // 攻击倍率
  def: number; // 额外防御
  crit: number; // 额外暴击
  attackName: string;
  skills: [SkillDef, SkillDef];
}
export const JOBS: Record<JobId, JobDef> = {
  sword: {
    id: 'sword', name: '圣光剑士', short: '剑士', desc: '近战三连斩，攻守兼备的王家剑术。',
    hp: 1.25, mp: 0.9, atk: 1.0, def: 6, crit: 0,
    attackName: '三连斩',
    skills: [
      { key: 'Q', name: '旋风斩', desc: '高速旋转，对周围敌人造成多段伤害', mp: 18, cd: 6, icon: 'whirl' },
      { key: 'W', name: '圣光冲锋', desc: '霸体突进，贯穿路径上所有敌人', mp: 14, cd: 4.5, icon: 'charge' },
    ],
  },
  mage: {
    id: 'mage', name: '星辰法师', short: '法师', desc: '远程魔法弹与毁天灭地的星辰魔法。',
    hp: 0.9, mp: 1.5, atk: 1.15, def: 0, crit: 0.03,
    attackName: '星光魔弹',
    skills: [
      { key: 'Q', name: '天降陨石', desc: '召唤陨石轰击前方，造成巨额范围伤害', mp: 32, cd: 7, icon: 'meteor' },
      { key: 'W', name: '星界瞬移', desc: '向前方闪烁并留下残影（可配合↑）', mp: 8, cd: 2, icon: 'blink' },
    ],
  },
  ranger: {
    id: 'ranger', name: '疾风游侠', short: '游侠', desc: '高速连射，暴击率极高的灵巧射手。',
    hp: 1.0, mp: 1.1, atk: 0.95, def: 2, crit: 0.12,
    attackName: '疾风连射',
    skills: [
      { key: 'Q', name: '疾风箭雨', desc: '在前方降下持续的箭雨覆盖打击', mp: 28, cd: 9, icon: 'rain' },
      { key: 'W', name: '后跳射击', desc: '向后跃起拉开距离，同时射出三连箭', mp: 10, cd: 3.5, icon: 'backshot' },
    ],
  },
};
export const JOB_ORDER: JobId[] = ['sword', 'mage', 'ranger'];

export function expToNext(level: number) {
  return Math.round(20 + 12 * Math.pow(level, 1.75));
}

// ======================== 怪物 ========================
export interface EnemyDef {
  kind: EnemyKind;
  name: string;
  lv: number;
  hp: number;
  atk: number;
  def: number;
  exp: number;
  gold: [number, number];
  speed: number;
  w: number;
  h: number;
  equipRate: number;
}
export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  slime: { kind: 'slime', name: '青苔史莱姆', lv: 2, hp: 60, atk: 9, def: 0, exp: 9, gold: [3, 8], speed: 34, w: 20, h: 16, equipRate: 0.07 },
  mushroom: { kind: 'mushroom', name: '红伞蘑菇怪', lv: 4, hp: 125, atk: 14, def: 2, exp: 17, gold: [6, 14], speed: 40, w: 20, h: 26, equipRate: 0.1 },
  knight: { kind: 'knight', name: '发条铁皮骑士', lv: 8, hp: 320, atk: 26, def: 8, exp: 44, gold: [15, 30], speed: 42, w: 22, h: 32, equipRate: 0.14 },
  sorcerer: { kind: 'sorcerer', name: '幽光术士', lv: 9, hp: 250, atk: 30, def: 4, exp: 50, gold: [18, 34], speed: 34, w: 18, h: 30, equipRate: 0.14 },
  imp: { kind: 'imp', name: '暗影小鬼', lv: 12, hp: 380, atk: 32, def: 6, exp: 28, gold: [8, 16], speed: 75, w: 16, h: 16, equipRate: 0.05 },
  boss: { kind: 'boss', name: '暗影魔王·莫德雷德', lv: 15, hp: 12000, atk: 46, def: 10, exp: 3000, gold: [800, 1200], speed: 46, w: 44, h: 80, equipRate: 1 },
};

// ======================== 装备 ========================
export type Slot = 'weapon' | 'armor' | 'badge';
export interface Item {
  uid: number;
  slot: Slot;
  name: string;
  rarity: number; // 0 白 1 蓝 2 紫 3 金
  level: number;
  atk: number;
  def: number;
  hp: number;
  mp: number;
  crit: number;
  critDmg: number;
  enh: number;
  price: number;
}
export const RARITY_NAMES = ['普通', '稀有', '史诗', '传说'];
export const SLOT_NAMES: Record<Slot, string> = { weapon: '武器', armor: '防具', badge: '星辉徽章' };

const NAMES: Record<Slot, string[][]> = {
  weapon: [
    ['橡木兵刃', '铁制兵刃', '旅者之刃'],
    ['秘银锋刃', '蓝晶之刃', '潮汐兵刃'],
    ['星辉魔刃', '紫晶咏叹', '夜幕裁决'],
    ['圣耀·光誓', '龙炎·破晓', '星界·永恒'],
  ],
  armor: [
    ['布制外衣', '皮革护甲', '旅人披风'],
    ['秘银锁甲', '蓝羽战袍', '晨露法衣'],
    ['星辉胸甲', '暮光战铠', '紫晶法袍'],
    ['圣耀·天使之铠', '龙鳞·不朽', '星界·守护者'],
  ],
  badge: [
    ['铜制徽章', '木质护符', '旅行纪念章'],
    ['蓝晶徽章', '月光护符', '勇气勋章'],
    ['星辉徽章', '紫焰纹章', '占星者之印'],
    ['圣耀·星辉之心', '王家·晨曦纹章', '星界·命运之轮'],
  ],
};

let uidCounter = 1;
export function nextUid() {
  return uidCounter++;
}
export function setUidBase(n: number) {
  uidCounter = Math.max(uidCounter, n);
}

export function rollRarity(luck = 0): number {
  const r = Math.random();
  if (r < 0.02 + luck * 0.25) return 3;
  if (r < 0.12 + luck * 0.6) return 2;
  if (r < 0.4 + luck) return 1;
  return 0;
}

export function genItem(level: number, rarity: number, slot?: Slot): Item {
  const s: Slot = slot ?? choice<Slot>(['weapon', 'weapon', 'armor', 'badge']);
  const m = [1, 1.35, 1.8, 2.5][rarity];
  const L = Math.max(1, level);
  const it: Item = {
    uid: nextUid(), slot: s, name: choice(NAMES[s][rarity]), rarity, level: L,
    atk: 0, def: 0, hp: 0, mp: 0, crit: 0, critDmg: 0, enh: 0, price: 0,
  };
  const v = () => rand(0.88, 1.12);
  if (s === 'weapon') {
    it.atk = Math.round((4 + L * 2.2) * m * v());
    if (rarity >= 1) it.crit = +(0.01 * rarity * v()).toFixed(3);
    if (rarity >= 2) it.critDmg = +(0.1 * (rarity - 1) * v()).toFixed(2);
  } else if (s === 'armor') {
    it.def = Math.round((2 + L * 1.1) * m * v());
    it.hp = Math.round((12 + L * 8) * m * v());
    if (rarity >= 2) it.mp = Math.round((L * 3) * m * v());
  } else {
    it.crit = +((0.02 + 0.003 * L) * m * v()).toFixed(3);
    it.mp = Math.round((8 + L * 4) * m * v());
    if (rarity >= 1) it.atk = Math.round(L * 0.6 * m * v());
    if (rarity >= 3) it.critDmg = +(0.2 * v()).toFixed(2);
  }
  it.price = Math.round((10 + L * 5) * m * m);
  return it;
}

export function itemAtk(it: Item) {
  return Math.round(it.atk * (1 + 0.12 * it.enh));
}
export function displayName(it: Item) {
  return it.enh > 0 ? `${it.name} +${it.enh}` : it.name;
}
/** 综合战力评分（用于装备比较） */
export function itemScore(it: Item | null | undefined) {
  if (!it) return 0;
  return itemAtk(it) * 3 + it.def * 2 + it.hp * 0.25 + it.mp * 0.2 + it.crit * 400 + it.critDmg * 150;
}

export function enhanceCost(it: Item) {
  return Math.round(80 * Math.pow(it.enh + 1, 1.6) * (1 + it.level / 8) * (1 + it.rarity * 0.3));
}

// ======================== 主线任务 ========================
export interface QuestDef {
  title: string;
  desc: string;
  type: 'talk' | 'kill' | 'boss' | 'done';
  target?: string;
  count?: number;
  reward?: { exp: number; gold: number; shard?: number; item?: { rarity: number; slot: Slot; level: number } };
  hint: string;
}
export const QUESTS: QuestDef[] = [
  { title: '星辉的召唤', desc: '与晨风镇的星辉长老对话', type: 'talk', target: 'elder', hint: '靠近长老按 F / W / ↑ 对话' },
  { title: '草原的黏糊麻烦', desc: '击败青苔史莱姆', type: 'kill', target: 'slime', count: 8, reward: { exp: 60, gold: 150, shard: 1 }, hint: '前往东边的翠绿草原' },
  { title: '红伞的威胁', desc: '击败红伞蘑菇怪', type: 'kill', target: 'mushroom', count: 6, reward: { exp: 160, gold: 300, item: { rarity: 1, slot: 'weapon', level: 6 } }, hint: '蘑菇怪多在草原高处平台' },
  { title: '古林的发条声', desc: '击败发条铁皮骑士', type: 'kill', target: 'knight', count: 6, reward: { exp: 420, gold: 500, shard: 1 }, hint: '穿过草原东侧传送门进入萤火古林' },
  { title: '幽光的低语', desc: '击败幽光术士', type: 'kill', target: 'sorcerer', count: 5, reward: { exp: 520, gold: 600, shard: 1, item: { rarity: 2, slot: 'badge', level: 10 } }, hint: '术士漂浮在古林高处，小心魔法弹' },
  { title: '决战蚀月高塔', desc: '前往蚀月高塔拯救艾莉娅公主', type: 'boss', target: 'boss', hint: '集齐 3 枚星辉碎片，从古林东侧进入高塔' },
  { title: '星辉永耀', desc: '王国重归和平 · 自由冒险', type: 'done', hint: '继续刷怪、收集传说装备吧！' },
];
export const SHARDS_NEEDED = 3;

export function randGold(r: [number, number]) {
  return randInt(r[0], r[1]);
}
