// 地图定义：平台、绳索、传送门、NPC、怪物刷新点、装饰
import type { Theme } from '../gfx/world';
import type { EnemyKind } from './data';

export type MapId = 'town' | 'meadow' | 'forest' | 'tower';

export interface Platform { x: number; y: number; w: number; solid?: boolean }
export interface Rope { x: number; top: number; bottom: number; ladder?: boolean }
export interface PortalDef { id: string; x: number; y: number; to: MapId; toPortal: string; label: string; locked?: boolean }
export interface NpcDef { kind: 'elder' | 'smith' | 'sign'; x: number; y: number; name: string }
export interface SpawnDef { kind: EnemyKind; x: number; y: number }
export interface DecoDef { kind: string; x: number; y: number; front?: boolean }

export interface MapDef {
  id: MapId;
  name: string;
  sub: string;
  theme: Theme;
  music: string;
  width: number;
  height: number;
  rec: string;
  platforms: Platform[];
  ropes: Rope[];
  portals: PortalDef[];
  npcs: NpcDef[];
  spawns: SpawnDef[];
  decos: DecoDef[];
  chest?: { x: number; y: number };
  windmills?: { x: number; y: number }[];
  smoke?: { x: number; y: number }[];
  braziers?: { x: number; y: number }[];
  spawnPoint: { x: number; y: number };
  boss?: boolean;
}

const town: MapDef = {
  id: 'town', name: '晨风镇', sub: 'Morningbreeze Village · 安全区', theme: 'town', music: 'town',
  width: 1600, height: 400, rec: '安全区',
  platforms: [
    { x: 0, y: 352, w: 1600, solid: true },
    { x: 540, y: 300, w: 80 },
    { x: 600, y: 250, w: 90 },
    { x: 1090, y: 296, w: 120 },
    { x: 1160, y: 240, w: 90 },
  ],
  ropes: [{ x: 1180, top: 240, bottom: 296, ladder: true }],
  portals: [{ id: 'east', x: 1550, y: 352, to: 'meadow', toPortal: 'west', label: '翠绿草原' }],
  npcs: [
    { kind: 'sign', x: 210, y: 352, name: '告示牌' },
    { kind: 'elder', x: 430, y: 352, name: '星辉长老' },
    { kind: 'smith', x: 840, y: 352, name: '铁匠 格林' },
  ],
  spawns: [],
  decos: [
    { kind: 'tree', x: 40, y: 352 },
    { kind: 'house_red', x: 120, y: 352 },
    { kind: 'flowers', x: 200, y: 352, front: true },
    { kind: 'lamp', x: 270, y: 352 },
    { kind: 'house_blue', x: 340, y: 352 },
    { kind: 'fence', x: 470, y: 352 },
    { kind: 'well', x: 580, y: 352 },
    { kind: 'crate', x: 545, y: 300 },
    { kind: 'tree2', x: 660, y: 352 },
    { kind: 'smithy', x: 760, y: 352 },
    { kind: 'anvil', x: 880, y: 352 },
    { kind: 'lamp', x: 930, y: 352 },
    { kind: 'windmill', x: 1010, y: 352 },
    { kind: 'house_green', x: 1260, y: 352 },
    { kind: 'flowers', x: 1180, y: 352, front: true },
    { kind: 'tree', x: 1360, y: 352 },
    { kind: 'house_purple', x: 1440, y: 352 },
    { kind: 'bush', x: 1510, y: 352 },
    { kind: 'flowers', x: 700, y: 352, front: true },
    { kind: 'bush', x: 980, y: 352, front: true },
  ],
  windmills: [{ x: 1010, y: 352 - 104 }],
  smoke: [{ x: 836, y: 352 - 82 }, { x: 182, y: 352 - 82 }],
  spawnPoint: { x: 100, y: 352 },
};

const meadow: MapDef = {
  id: 'meadow', name: '翠绿草原', sub: 'Verdant Meadow · 推荐 Lv.1-7', theme: 'meadow', music: 'field',
  width: 2400, height: 560, rec: 'Lv.1-7',
  platforms: [
    { x: 0, y: 520, w: 2400, solid: true },
    { x: 260, y: 460, w: 220 }, { x: 520, y: 400, w: 200 }, { x: 300, y: 340, w: 180 }, { x: 540, y: 280, w: 220 },
    { x: 900, y: 460, w: 160 }, { x: 1080, y: 400, w: 240 }, { x: 880, y: 300, w: 180 },
    { x: 1380, y: 460, w: 260 }, { x: 1440, y: 380, w: 160 }, { x: 1660, y: 320, w: 200 }, { x: 1400, y: 240, w: 220 },
    { x: 1900, y: 460, w: 200 }, { x: 2050, y: 400, w: 180 },
  ],
  ropes: [
    { x: 700, top: 280, bottom: 404 },
    { x: 960, top: 300, bottom: 464 },
    { x: 1500, top: 380, bottom: 464, ladder: true },
    { x: 1760, top: 320, bottom: 524 },
    { x: 1480, top: 240, bottom: 384 },
  ],
  portals: [
    { id: 'west', x: 40, y: 520, to: 'town', toPortal: 'east', label: '晨风镇' },
    { id: 'east', x: 2360, y: 520, to: 'forest', toPortal: 'west', label: '萤火古林' },
  ],
  npcs: [],
  spawns: [
    { kind: 'slime', x: 200, y: 520 }, { kind: 'slime', x: 700, y: 520 }, { kind: 'slime', x: 1200, y: 520 },
    { kind: 'slime', x: 1300, y: 520 }, { kind: 'slime', x: 2000, y: 520 }, { kind: 'slime', x: 350, y: 460 },
    { kind: 'slime', x: 1150, y: 400 }, { kind: 'slime', x: 950, y: 460 },
    { kind: 'mushroom', x: 600, y: 400 }, { kind: 'mushroom', x: 640, y: 280 }, { kind: 'mushroom', x: 950, y: 300 },
    { kind: 'mushroom', x: 1450, y: 460 }, { kind: 'mushroom', x: 1750, y: 320 }, { kind: 'mushroom', x: 1500, y: 240 },
    { kind: 'mushroom', x: 1600, y: 520 }, { kind: 'mushroom', x: 2120, y: 400 },
  ],
  decos: [
    { kind: 'signpost', x: 110, y: 520 },
    { kind: 'tree', x: 180, y: 520 }, { kind: 'bush', x: 420, y: 520 }, { kind: 'pine', x: 520, y: 520 },
    { kind: 'tree2', x: 820, y: 520 }, { kind: 'rock', x: 760, y: 520 }, { kind: 'flowers', x: 640, y: 520, front: true },
    { kind: 'tree', x: 1250, y: 520 }, { kind: 'bush', x: 1100, y: 520 }, { kind: 'pine', x: 1340, y: 520 },
    { kind: 'flowers', x: 1700, y: 520, front: true }, { kind: 'tree2', x: 1850, y: 520 }, { kind: 'fence', x: 2000, y: 520 },
    { kind: 'rock', x: 2200, y: 520 }, { kind: 'bush', x: 2280, y: 520 }, { kind: 'flowers', x: 300, y: 520, front: true },
    { kind: 'flowers', x: 1010, y: 520, front: true }, { kind: 'bush', x: 1560, y: 520, front: true },
    { kind: 'flowers', x: 600, y: 280 }, { kind: 'bush', x: 1480, y: 240 },
  ],
  spawnPoint: { x: 100, y: 520 },
};

const forest: MapDef = {
  id: 'forest', name: '萤火古林', sub: 'Firefly Ancient Woods · 推荐 Lv.7-13', theme: 'forest', music: 'forest',
  width: 2600, height: 640, rec: 'Lv.7-13',
  platforms: [
    { x: 0, y: 600, w: 2600, solid: true },
    { x: 200, y: 540, w: 200 }, { x: 440, y: 480, w: 180 }, { x: 180, y: 420, w: 200 }, { x: 420, y: 360, w: 200 },
    { x: 160, y: 300, w: 160 }, { x: 80, y: 200, w: 140 },
    { x: 760, y: 540, w: 240 }, { x: 820, y: 440, w: 200 },
    { x: 1100, y: 540, w: 200 }, { x: 1150, y: 480, w: 220 }, { x: 1300, y: 400, w: 200 }, { x: 1080, y: 340, w: 200 }, { x: 1300, y: 280, w: 220 },
    { x: 1650, y: 540, w: 280 }, { x: 1720, y: 460, w: 200 }, { x: 1950, y: 400, w: 220 }, { x: 1700, y: 340, w: 200 },
    { x: 2200, y: 540, w: 200 },
  ],
  ropes: [
    { x: 190, top: 200, bottom: 304 },
    { x: 540, top: 480, bottom: 604 },
    { x: 900, top: 440, bottom: 544 },
    { x: 1180, top: 340, bottom: 484 },
    { x: 1360, top: 280, bottom: 404 },
    { x: 1800, top: 460, bottom: 544, ladder: true },
    { x: 1780, top: 340, bottom: 464 },
  ],
  portals: [
    { id: 'west', x: 40, y: 600, to: 'meadow', toPortal: 'east', label: '翠绿草原' },
    { id: 'east', x: 2560, y: 600, to: 'tower', toPortal: 'west', label: '蚀月高塔', locked: true },
  ],
  npcs: [],
  spawns: [
    { kind: 'knight', x: 640, y: 600 }, { kind: 'knight', x: 1000, y: 600 }, { kind: 'knight', x: 1500, y: 600 },
    { kind: 'knight', x: 2100, y: 600 }, { kind: 'knight', x: 850, y: 540 }, { kind: 'knight', x: 1750, y: 540 },
    { kind: 'knight', x: 1380, y: 400 }, { kind: 'knight', x: 2300, y: 540 },
    { kind: 'sorcerer', x: 500, y: 360 }, { kind: 'sorcerer', x: 1150, y: 340 }, { kind: 'sorcerer', x: 1400, y: 280 },
    { kind: 'sorcerer', x: 2050, y: 400 }, { kind: 'sorcerer', x: 1780, y: 340 }, { kind: 'sorcerer', x: 260, y: 420 },
  ],
  decos: [
    { kind: 'bigtree', x: 330, y: 600 }, { kind: 'column', x: 700, y: 600 }, { kind: 'glowshroom', x: 760, y: 600, front: true },
    { kind: 'column_broken', x: 1040, y: 600 }, { kind: 'bigtree', x: 1250, y: 600 }, { kind: 'fern', x: 1400, y: 600, front: true },
    { kind: 'column', x: 1600, y: 600 }, { kind: 'glowshroom', x: 1680, y: 600 }, { kind: 'bigtree', x: 2050, y: 600 },
    { kind: 'column_broken', x: 2400, y: 600 }, { kind: 'glowshroom', x: 2480, y: 600, front: true }, { kind: 'fern', x: 140, y: 600, front: true },
    { kind: 'darktree', x: 560, y: 600 }, { kind: 'darktree', x: 1880, y: 600 }, { kind: 'fern', x: 960, y: 600, front: true },
    { kind: 'glowshroom', x: 1200, y: 480 }, { kind: 'glowshroom', x: 300, y: 300 }, { kind: 'fern', x: 1780, y: 340 },
    { kind: 'glowshroom', x: 2280, y: 540 },
  ],
  chest: { x: 130, y: 200 },
  spawnPoint: { x: 100, y: 600 },
};

const tower: MapDef = {
  id: 'tower', name: '蚀月高塔之巅', sub: 'Eclipse Spire Summit · 推荐 Lv.12+', theme: 'tower', music: 'boss',
  width: 960, height: 360, rec: 'Lv.12+',
  platforms: [
    { x: 0, y: 320, w: 960, solid: true },
    { x: 150, y: 246, w: 130 },
    { x: 680, y: 246, w: 130 },
    { x: 400, y: 178, w: 160 },
  ],
  ropes: [],
  portals: [{ id: 'west', x: 36, y: 320, to: 'forest', toPortal: 'east', label: '萤火古林' }],
  npcs: [],
  spawns: [],
  decos: [
    { kind: 'banner', x: 120, y: 320 }, { kind: 'banner', x: 840, y: 320 },
    { kind: 'brazier', x: 300, y: 320 }, { kind: 'brazier', x: 660, y: 320 },
    { kind: 'spire', x: 20, y: 330 }, { kind: 'spire', x: 940, y: 330 },
  ],
  braziers: [{ x: 300, y: 320 - 32 }, { x: 660, y: 320 - 32 }],
  spawnPoint: { x: 90, y: 320 },
  boss: true,
};

export const MAPS: Record<MapId, MapDef> = { town, meadow, forest, tower };
