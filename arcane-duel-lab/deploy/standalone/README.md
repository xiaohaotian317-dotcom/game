# 独立部署游戏与房间服务

状态：迁移准备包，未部署到新公网服务器。用户目前没有服务器或托管账号。只有好友实际打开新入口并完成双人对局，才算解决外部访问问题。

该包包含现有六职业、三境、全部美术、原生网页、WebRTC/HTTP房间服务及SQLite迁移。运行不依赖ChatGPT登录、Sites插件或云端D1。单实例SQLite用于房间/中转状态；正式账号与云存档仍未实现。不要在多个独立实例间轮流分配同一个房间的请求。

## 具备服务器后

需要：可被玩家访问的Linux服务器、Docker Compose、已解析到服务器的域名，以及可用的80/443端口。服务器和域名尚未购买；费用和服务条款须在选定平台后另行确认。不要只迁移静态页面并继续请求原chatgpt.site接口。

解压到任意目录，进入包根的deploy/standalone/：

```sh
cp .env.example .env
# 编辑.env，把GAME_DOMAIN改为自己的实际域名；不要保留game.example.com
docker compose up -d --build
docker compose ps
```

Caddy在域名/DNS/端口正确时管理HTTPS证书，并将网站和/api/duel反向代理到同一个游戏服务。这里是另一台独立服务器，不是改变原chatgpt.site域名或绕过其防护。生产环境必须使用有效HTTPS；普通公网HTTP不能作为浏览器联机功能已可用的验收依据。

Docker卷game_data保存房间SQLite，caddy_data/caddy_config保存证书状态。更新程序用docker compose up -d --build；正常重建保留卷。备份前先停止game服务，再备份数据库卷；不要执行带-v的down命令清空卷。

## 不用Docker

安装Node.js 24，站点根运行：

```sh
HOST=127.0.0.1 PORT=4173 PUBLIC_ORIGIN=https://game.example.com DUEL_DB_PATH=/var/lib/arcane-duel/duel.sqlite node scripts/serve.mjs
```

另用自己的HTTPS反向代理转发到127.0.0.1:4173。PUBLIC_ORIGIN必须是玩家访问的准确来源（协议、域名和非默认端口），不能有路径或账号信息；服务器据此校验浏览器Origin。默认HOST仍为127.0.0.1，本机预览用npm start即可。

## 验收

1. /healthz返回200；/lobby、/duel及PNG/ESM资源正常。
2. 两台真实设备创建/输入房间号、准备、选人、倒计时、技能伤害、先到3分及返回房间通过。
3. 在好友实际网络测试HTTPS、WebRTC/HTTP通道和RTT。迁移不保证所有网络可达，也不能保证WebRTC穿透；受限网络仍需观察HTTP兜底。
4. 重启服务后数据库仍保留；公共接口不能跨其他站点来源请求。

从完整包根目录可运行两个临时协议客户端检查房间生命周期：`node scripts/audit-duel-online.mjs https://你的实际域名 validation/standalone-public-audit.json`。这会创建临时房间、模拟三局并结束，不等于两名真实玩家的异地WebRTC验收。

容器配置尚未在本机执行Docker构建（本机未提供Docker），HTTPS签证/DNS/公网和好友网络尚未验证。Node服务及代理来源校验的本机测试结果见项目记忆和validation/standalone-audit.json。

## 原项目/文档

原公开试玩保留不变；完整开发源码与三份集中记忆在https://github.com/xiaohaotian317-dotcom/game。

技术依据：[Node.js SQLite](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html)、[Node官方Docker镜像](https://github.com/nodejs/docker-node)、[Caddy HTTPS反向代理](https://caddyserver.com/docs/quick-starts/reverse-proxy)。此归档用于独立托管，不能作为Sites上传归档使用。
