# T44 第二章小兵原始素材交付

本目录仅为待主 Agent 接入的原始美术与只读测量，不是运行资源，不代表用户最终验收。没有修改 dist、代码、项目记忆、发布物或存档。

已选 10 角色：M11/M12/M13/M14/M16/M18/M19/M20 使用 `*-motion-v1.png`；M15 使用 `M15-motion-v3.png`，M17 使用 `M17-motion-v2.png`。每张原图 1254×1254 RGBA，4×4 共 16 姿势，前六帧为各自六个不同的步态/漂浮姿态。M19 是低空有机孢囊灯与拖曳根须，可使用地面 AI；没有复制蝙蝠造型。

已选 FX：`minion-melee-fx-v2.png`（887×1774，7 族×4=28 相位）和 `minion-ranged-fx-v2.png`（1254×1254，4 族×4=16 相位）。两张都是内置 image_gen 原生输出字节，未用脚本重绘、清底、拼图或重采样。

`minion-meta-v1.json` 是唯一裁切/接入清单：

- `rect` 是逻辑帧的源坐标空间，**不要把它当最终裁切窗口**。部分向右攻击伸出逻辑格，但仍与下一主体隔着透明间隙；必须用显式 `spriteRect` 保全原图。
- 角色 `groundContactY`、`bottomNormalized` 和 `pivot` 按每帧材料底点测量；尸体与抬腿不能统一套一个源底点。`idleHeight/idleCenterX` 可用于各物种固定参考缩放，M15/M16为了完整武器有较多留白。
- `portrait.rect` 是第 0 帧的原图绝对像素脸部特写，不是把整格缩为头像。`socket` 使用第 10 帧逻辑格归一化坐标，并保留人工视觉估计的绝对发射点；接入时结合真实发射高度复核。
- 近战族顺序 M11/M12/M13/M14/M15/M16/M20，语义是 windup→strike→impact→fade，方向朝右。M11、M13 为 `ground:true`，其余按角色武器高度锚定。
- 远程族顺序 M17/M18/M19/M20，语义是 charge→launch→flight→impact，全部 `ground:false`。每相位有人工校准的核心/钩头 `projectileHeadPivot`，不要按含链条、尾迹的整幅包围盒中心定位弹体。
- FX 实际行间距不等分，`logicalRowCutsY` 和 `measuredMaterialBandsY` 来自透明间隙/主体测量。相位混合时保持同族统一参考尺度，不能逐帧把主体包围盒强行放到同宽。

全部入选 160 角色帧 + 44 FX 相位在 alpha>32 的主体边缘测量中无隔离边缘触碰。原图仍有少量 alpha 1～16 的天然抗锯齿/黑噪/局部辉光，统计如实保留；没有把低透明像素清除后冒充生成原件。运行暗场观感、主观流畅度、头像取景和发射点仍需主 Agent 接入复核与用户验收。

17 次独立内置 image_gen 调用，保留 12 张入选原图及 5 张拒绝/候选原图。M15 v1 灰底、v2 过宽刀势，M17 v1 密集背景残余，两张 FX v1 背景/边缘残余均有记录。完整 prompt、源路径、SHA256 和拒绝原因在目录及 manifest；字节校核不代表画面主观认可。

只读分析脚本：先 `analyze-minions.py`，再 `analyze-fx.py`；仅读取原图并写 JSON，不保存或修改 PNG。
