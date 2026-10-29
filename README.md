# 秘境决斗

暗色奇幻 2D 横版平台对战游戏，目前为六职业单人动作与机关试炼版本。最终目标是短局双人联机决斗，正式大厅、抽卡池和单机闯关尚待实现。

## 项目内容

- 六位英雄：焰术师、森灵、霜语者、雷行者、影刃、星术师，含职业动作、普攻、Q/E/R、被动和限时二段技能。
- 三张交互地图：月光遗迹、熔岩祭坛、浮空花园，含可破坏桥、升降台、月镜、地火、导流、摆锤、风道、藤桥与弹跳花。
- 角色放大检视、训练木桩、反击、慢动作、画面定格、跟随/全景镜头。
- 运行代码、美术概念、原始参考、提示词、测试及验证记录。

[在线试玩](https://arcane-duel-motion-lab-1028-a5324e.sassysquid.chatgpt.site/?play=1) · [六位角色检视](https://arcane-duel-motion-lab-1028-a5324e.sassysquid.chatgpt.site/characters.html)

## 本地运行

安装 Node.js 后，在仓库根目录执行：

```powershell
cd arcane-duel-lab
npm start
```

打开 <http://127.0.0.1:4173/>；加 `?play=1` 可直接进入训练，`characters.html` 为放大角色检视。项目直接运行静态 HTML/CSS/JavaScript，无需构建。

```powershell
# 在 arcane-duel-lab 中运行自动检查
npm test

# 重新生成六职业三地图跳跃通行报告
node scripts/audit-scene-routes.mjs
```

主要操作：A/D 移动，空格二段跳，S+空格下穿台面，鼠标瞄准和左键普攻，Q/E/R 技能，Shift 冲刺，1～6 切换英雄，P 暂停，V 定格。

## 工作前先阅读

1. [项目需求](AGENTS.md/项目需求.md)
2. [项目架构](AGENTS.md/项目架构.md)
3. [历史要求、约束与待完成事项](AGENTS.md/历史要求与约束及待完成事项.md)

用户指定 `AGENTS.md` 为文件夹；根目录 `AGENTS.override.md` 和代码目录 `arcane-duel-lab/AGENTS.md` 提供读取入口。每次工作前先读三份原文，需求、架构或进度有变化时及时更新。

## 目录

| 路径 | 内容 |
| --- | --- |
| `arcane-duel-lab/dist/` | 实际网页、Canvas 游戏模块与运行素材 |
| `arcane-duel-lab/tests/`、`scripts/` | 自动检查、静态预览、素材边界读取与路线审计 |
| `arcane-duel-lab/art-source/`、`feedback/`、`validation/` | 参考与生成记录、用户截图、实机验证 |
| `美术概念/` | 六职业、技能、场景和 UI 概念稿 |
| `试玩截图/` | 既有试玩截图 |
| `AGENTS.md/` | 三份持续维护的项目记忆 |

GitHub 仓库保留完整目录结构。重复的 ZIP/TAR 发布包、依赖缓存和本地 Git 元数据不入库。概念图与旧修订记录不代表正式功能已经实现，当前有效需求和待办以三份集中记忆为准。
