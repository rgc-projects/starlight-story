# 《星辉物语（Starlight Story）》

一款致敬经典《冒险岛（MapleStory）》的原创 **2D 横版像素风动作角色扮演游戏（ARPG）**。
全作采用 **Vite + TypeScript + HTML5 Canvas + Web Audio API** 打造，所有像素角色、怪物、视差背景、中世纪建筑与 8-bit/16-bit 配乐/音效均为纯代码程序化生成，**零外部图片/音频依赖**。

## 一键启动

```bash
cd starlight-story
npm install
npm run dev
```

或构建生产版本并预览：

```bash
npm run build
npm run preview
```

## 部署到 Cloudflare Workers

本项目已配置 `wrangler.jsonc`（使用 Cloudflare Workers Static Assets 托管 `dist` 静态产物，并开启 SPA 回退与可观测性）：

```bash
# 本地使用 Wrangler 模拟 Workers 环境运行
npm run cf:dev

# 干跑检查打包配置
npm run deploy:dry

# 一键部署到 Cloudflare Workers
npm run deploy
```

也支持在 Cloudflare Dashboard 中直接连接 GitHub 仓库（Workers Builds），构建命令 `npm run build`，部署命令 `npx wrangler deploy`。

## 操作说明（内置双人体工学键位，按 `F2` 或点击 HUD 按钮随时一键切换）

### 方案一：现代动作键位（默认推荐：`WASD + JKL / 鼠标`）

参考《死亡细胞》《空洞骑士》《DNF》等现代横版动作佳作，左手自然放松在 `WASD`，大拇指管空格跳跃，右手 `JKL` 或鼠标负责普攻与位移：

| 操作 | 按键 |
| --- | --- |
| 移动 / 攀爬绳索梯子 | `W` `A` `S` `D`（同时兼容 `↑` `←` `↓` `→`） |
| 跳跃 / 二段跳 & 空中冲刺 | `Space` / `K` |
| 穿透薄平台 | `S` + `Space`（或快速双击 `S`） |
| 普攻连击（支持按住连打） | `J` / 主战区鼠标左键 |
| 技能 1（旋风斩 / 天降陨石 / 疾风箭雨） | `Q` / `U` |
| 技能 2 位移闪避（冲锋 / 瞬移 / 后跳，可取消后摇） | `L` / `Shift` / 主战区鼠标右键 |
| 对话 / 铁匠铺 / 进传送门 / 开宝箱 | `F` / `E` / `W` / `↑` |
| 喝红药 / 喝蓝药 | `Z` / `X`（兼容 `4` / `5`） |
| 自由切换职业（圣光剑士 / 星辰法师 / 疾风游侠） | `1` / `2` / `3` |
| 背包装备 / 切换键位 / 静音 / 暂停 | `Tab` 或 `I` 或 `B` / `F2` / `M` / `Esc` 或 `P` |
| 展示模式（快速体验 Boss 战：Lv.12 + 传说套 + 3 碎片） | `F9` |

### 方案二：冒险岛经典人体工学键位（`方向键 + 左手 D/Q/W/Space`）

适合习惯右手方向键精准走位的老冒险岛玩家，将高频跳跃下放至大拇指 `Space`/`C`，主力攻击移至左手食指 `D`/`A`，大幅减少手腕与小指疲劳：

- 移动/攀爬：`←` `→` `↑` `↓` ｜ 跳跃/空中冲刺：`Space` / `C` / `Alt` ｜ 下穿：`↓`+`Space` 或双击 `↓`
- 普攻：`D` / `A` / `Ctrl` ｜ 技能 1：`Q` / `S` ｜ 位移技：`W` / `F` / `Shift` ｜ 互动：`↑` / `E`

> **进阶技巧**：星辰法师按住 `W`/`↑` 再放【星界瞬移】可**垂直向上瞬移登台**；所有职业的位移技能均可**强制取消普攻/旋风斩后摇**，便于 Boss 战极限闪避！
