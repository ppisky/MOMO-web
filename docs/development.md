# 开发与验证

当前在 apps/momo 维护独立网页，使用 pnpm 10.33.0、Node 26.11.1 和原 Vite 7。根目录转发命令，应用有独立 workspace 与锁文件。Electron 安装和打包命令已删除，ron 暂缓。

Windows 可执行根目录 `./node_modules/.bin/pnpm.cmd`。应用脚本使用 pnpm 自动提供的 Node 26；系统 Node 22 启动 pnpm 时可能显示引擎警告，通过 `pnpm --dir apps/momo exec node --version` 核对实际脚本运行时。

| 根目录命令 | 用途 |
| --- | --- |
| pnpm setup | 安装应用依赖 |
| pnpm dev / pnpm dev:web | 原网页开发，127.0.0.1:1212 |
| pnpm typecheck | 路由生成与严格 TypeScript 检查 |
| pnpm check:web | Electron 清理边界检查 |
| pnpm test:brand | 品牌与主题测试 |
| pnpm test:roleplay | 原角色、记忆与请求回归 |
| pnpm test:settings | 自定义模型配置与语言回归 |
| pnpm build | 静态生产网页，apps/momo/dist/web |
| pnpm preview | 在 1212 预览生产文件 |

应用目录的 `pnpm check:shared-boundaries` 和 `pnpm check:packages` 分别检查包边界与共享包类型。修改代码按范围运行类型、相关测试、边界、Biome 和生产构建，不为纯文档加应用测试。

不自动运行 live model-provider 测试，不使用真实密钥。原上游全量测试包含已停用能力，局部通过不代表全产品通过。真实模型和翻译工具单独验证。

## 隔离浏览器验收

在应用目录分别启动：

```sh
pnpm build
pnpm preview --port 12209
pnpm exec node scripts/web-smoke-fixture.mjs
```

在 http://127.0.0.1:12209/ 添加测试服务商，OpenAI Chat Completions 地址 http://127.0.0.1:19421/v1，不填密钥，获取并添加 momo-web-fixture。创建测试角色、选择模型、发送和刷新、归档/恢复，检查相同消息只保存一次。

fixture 仅监听 loopback，只允许此测试 origin，返回确定的 SSE；不转发请求、不记录凭据/正文。它证明浏览器通路，不能证明真实模型输出或 Core 接入。使用独立端口隔离 IndexedDB，不修改用户在 1212 的角色、模型和聊天。验收深层会话/设置路由刷新及控制台错误，结束后停止测试服务。

## 提交

每次修改在所属仓库形成单一目的 Git 提交。Core 和 ron 保持独立，本轮不修改。保留现有数据、署名、历史原型和许可，不提交密钥、聊天记录、数据库、日志或构建产物，不自动推送或发布。
