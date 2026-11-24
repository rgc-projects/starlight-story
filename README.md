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

## 操作说明

| 操作 | 按键 |
| --- | --- |
| 左右移动 / 攀爬绳索梯子 | `←` `→` `↑` `↓` |
| 跳跃 / 二段跳 & 空中冲刺（Flash Jump） | `Space` / `C` / `Alt` |
| 穿透薄平台 | `↓` + `Space` |
| 普攻（剑士三连斩 / 法师魔弹 / 游侠连射） | `A` / `J` / `Ctrl` |
| 职业技能 Q / W | `Q` / `W` |
| 随时自由切换职业（圣光剑士 / 星辰法师 / 疾风游侠） | `1` / `2` / `3` |
| 喝红药水 / 喝蓝药水 | `Z` / `X` |
| NPC 对话 / 铁匠铺 / 传送门 / 开启宝箱 | `↑` |
| 打开背包与装备界面 | `I` / `B` |
| 静音切换 / 暂停菜单 | `M` / `Esc` 或 `P` |
| 展示模式（快速体验 Boss 战：Lv.12 + 传说装备 + 3 碎片） | `F9` |
