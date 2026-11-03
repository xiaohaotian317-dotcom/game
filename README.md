# 秘境决斗

当前源码为 **campaign7 Windows 单机版**：全屏世界选关、首领/小兵头像详情、独立双英雄选择与1/2切换、主题血蓝条、低血屏幕边缘、暂停及实际战利品结算。六职业绘制血蓝外框、灵兽幼形/头像与高低台群已接入；273项检查通过、2304条阶梯跳跃路线可达。Windows campaign7目录/ZIP已生成，23项隔离启动资源检查通过；源码与原创美术已同步GitHub `46f5c72`；美术与真人难度待用户验收。

每次重新进入关卡或重试，灵宠恢复满生命和法力；同一次关卡内回收、换宠再出战仍保留各自受伤状态。三只灵兽重绘幼形与专用头像、适当放大本体，最终形态仍低于人物。新美术外观待用户验收。

第4关首领掉落收妖镜，C拾取；装备加生命，金币升级同时加强生命/捕捉。第6关首领掉落御天剑，装备加攻击，按住Q在鼠标范围持续落剑，升级增加装备攻击与落剑伤害。一个法器槽一次装备一件。灵宠仅一只出战，独立等级/血蓝/技能，5级/10级手动进化；第5/7/9关灵宠强度递增。

锻造升一/二/三品均为10枚对应小/中/高阶灵石；三槽合成、成长/背包/36技能/11关与宠物副本保留。原网站、旧发行包和存档保留，不部署Sites；主观美术、真人平衡和两设备局域网体验待验收。

Windows构建：在arcane-duel-lab/desktop执行`node build.mjs --campaign-preview`，在游戏目录执行`python scripts/package-campaign.py --version campaign7`。完整解压后运行ArcaneDuelCampaign.exe；无需GPT、插件、Node或网络。发行包不入Git。源码、美术原图/完整提示词/哈希、集中三份记忆与validation验证证据随仓库维护。以下早期内容作为历史记录，当前实现以根AGENTS.md三文档为准。

## 项目内容

- 六位英雄：焰术师、森灵、霜语者、雷行者、影刃、星术师，含职业动作、普攻、F/E/R、被动和限时二段技能。
- 三张交互地图：月光遗迹、熔岩祭坛、浮空花园，含可破坏桥、升降台、月镜、地火、导流、摆锤、风道、藤桥与弹跳花。
- 角色放大检视、训练木桩、反击、慢动作、画面定格、跟随/全景镜头。
- 运行代码、美术概念、原始参考、提示词、测试及验证记录。

[在线试玩](https://arcane-duel-motion-lab-1028-a5324e.xiaohaotian317.chatgpt.site/?play=1) · [六位角色检视](https://arcane-duel-motion-lab-1028-a5324e.xiaohaotian317.chatgpt.site/characters.html)

2026-10-29 combat7：雷行者改为近战雷拳并小幅抬头；影刃修正正向刀光、加入整身残影；霜、雷、影、星四位特效细化。全员原 Q 改 F，机关交互改 G，二段窗口延长至 2.5～3.5 秒。修订说明见 [近战雷拳与特效修订](arcane-duel-lab/近战雷拳与特效修订.md)。

combat8：雷拳电光已跟随真实出拳手端，修短并后收头颈，重新裁切头像；97 项检查通过。见 [雷行者拳端与头颈修复](arcane-duel-lab/雷行者拳端与头颈修复.md)。

## 本地运行

安装Node.js >=22.13后，在仓库根目录执行：

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

主要操作：A/D 移动，空格二段跳，S+空格下穿台面，鼠标瞄准和左键普攻，F/E/R 技能，Shift 冲刺，G 交互，1～6 切换英雄，P 暂停，V 定格。

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

combat9：六职业 36 枚手绘技能图标、影刃收颈、近战 +25%、霜环减速和背景层次调整，见 [最新修订](arcane-duel-lab/影刃霜环与技能图标修订.md)。

## UI10 主大厅与英雄召唤

启动页点击开始进入大厅；`lobby.html` 为主大厅，`lobby.html?view=summon` 为召唤，`lobby.html?view=codex` 为图鉴。六位大立绘、三张模式卡、黑金界面、单抽/十连和结果展示已接入；体验金币、解锁、展示英雄和声音保存在本机。正式联机与闯关入口有开放状态说明，可先进入现有三境试炼。110 项检查通过，详见 [界面说明](arcane-duel-lab/主大厅与英雄召唤界面.md)。

[主大厅](https://arcane-duel-motion-lab-1028-a5324e.xiaohaotian317.chatgpt.site/lobby.html) · [英雄召唤](https://arcane-duel-motion-lab-1028-a5324e.xiaohaotian317.chatgpt.site/lobby.html?view=summon)

## DUEL12 双人联机

大厅进入duel.html创建或加入房间。加入者先准备，房主开始；六人全开放，双方选完确认后随机三境、倒计时3秒，先到3分获胜，结算可返回房间。WebRTC直连优先、HTTP转发兜底，显示真实RTT。141项检查与本机/公网双客户端通过，公开部署状态以三份集中记忆最新记录为准。

本地npm start（Node>=22.13）同时提供游戏/API；生产先在network-host安装依赖，再从游戏根npm run build。原生源仍在dist顶层，client/server与network-host/public为生成副本。

公开联机入口：<https://arcane-duel-motion-lab-1028-a5324e.xiaohaotian317.chatgpt.site/duel>。部署源码f11789f，详细验证与限制见三份项目记忆及双人决斗修订说明。
