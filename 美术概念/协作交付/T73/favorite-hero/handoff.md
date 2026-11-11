# T73 六职业本命英雄名牌素材

仅素材交付，未改游戏代码、运行素材、项目记忆或手机。

推荐原图：

| 职业 | PNG | 结构 |
| --- | --- | --- |
| 焰术师 | favorite-hero-fire-v2.png | 金黑火舌、赤红熔纹 |
| 森灵 | favorite-hero-nature-v2.png | 古木藤蔓、宽叶、叶形端扣 |
| 霜语者 | favorite-hero-frost-v1.png | 银金霜纹、冰晶尖饰 |
| 雷行者 | favorite-hero-lightning-v1.png | 金色折雷甲片、端部细电弧 |
| 影刃 | favorite-hero-shadow-v1.png | 乌紫鸦羽、弧形暗刃 |
| 星术师 | favorite-hero-star-v1.png | 古金星轨、星形蓝宝石 |

以上均为 2172×724 RGBA，内置 image_gen 各职业独立生成；火/森另有一次定向清理，v1 仅归档。所有 PNG 与生成源字节 SHA256 完全一致，没有后处理抠图、涂改、缩放或图集拼接。

中央约 x=470～1702、y=265～455 为可叠字的暗色区域，无人物、文字与头像；外部有真实 alpha。中心 alpha 253/255 或相近，视觉近于不透明；精确统计见 manifest.json。部分边缘极低 alpha 像素让全 alpha bbox 接近画布，不应把非零 alpha bbox 当主体框。

建议在 180×48 按钮中用等比 cover 居中裁去上下透明留白，或用 manifest 中 suggestedViewBox=[0,80,2172,564] 再等比 contain；这仅是显示取景，不拉伸 PNG。六图文字床的中心一致，建议标题字号约 12～14px，保持端饰不遮字。最终由主 Agent 核对实际手机入口文字/箭头的位置。

完整实际提示词逐次在 prompt-*.txt，来源、尺寸、哈希、alpha 统计在 manifest.json。仅完成生成与素材审查；美术仍待主 Agent 接入及用户验收。
