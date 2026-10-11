# 源码来源与定制记录

- 上游：https://github.com/chatboxai/chatbox
- 基准提交：0ac6385ae1ff5bf778777826da3c5edcd55b61b8
- 接入日期：2026-10-08
- 源码位置：apps/momo
- 许可：GPL-3.0，保留 LICENSE、原作者与上游 README。
- 本地完整源码基线：5f37630dfbb4d7007ea8b1abddfdce1721b117a9。2026-10-09 将已有快照接为 main 基线后单独实施网页清理。

这是上游源码修改版，不是 Chatbox 官方发行包。分发时保留许可、署名，并按 GPL 提供对应源码。MOMO 品牌图片由用户提供，位于 public/brand。

2026-10-11：用户授权双圆重合图标和简化版采用 CC BY-SA 4.0，范围及署名见 [图标许可](public/brand/README.md)，完整条款在 `LICENSES/CC-BY-SA-4.0.txt`。网页源码仍为 GPL-3.0，其他上游图片/图标维持其原许可；此授权不覆盖第三方资源。

## 当前定制

保留 MOMO 名称、紫色主题、双圆标识、原角色对话和设置页面、五种语言、自定义 API 协议接入。关闭上游统计、错误上报和更新，停用登录、订阅、在线角色市场、内置云模型和工作工具。现有网页存储升级与示例备份清理保留。

2026-10-09 用户决定回到原仓库，移除 Electron，先完成网页。删除 main/preload、桌面 IPC 和存储、electron-vite/electron-builder/webpack 工具链、生产包清单及相关依赖。网页用原 Vite 独立构建；旧桌面源码在 Git 历史中可追溯，忽略的旧构建目录不纳入当前构建。

随后按用户纠正，从 MOMO-app e664a9007fe523d1c3c24e9ad1edc7ce401e57ef 迁回 Core 接入和已适配的原 Web UI，放在 apps/momo/src/product，来源文件哈希见 [清单](docs/sources/core-ui-restoration.json)。运行时采用 Core 32c2088d96b93d2d985950c5898fbe556f373d24；Node Web 宿主独立维护，未迁入 ron/Remix 运行时。旧 renderer 和旧 IndexedDB 数据保留，但不参与活动聊天。见 [0007](docs/decisions/0007-preserve-core-progress.md)。Core wire fixture 与许可证保留在 apps/momo/test/contracts 和 test/licenses。

## 工具兼容

使用 pnpm 10.33.0，应用运行时固定 Node 26.11.1。旧翻译工具仍有 engine 警告；不为清理 Electron 顺带升级框架。测试进程关闭 Node 26 实验性 Web Storage，让 jsdom 提供 localStorage。

锁文件中的 electron-to-chromium 是 Browserslist 的浏览器版本映射数据，不含 Electron 二进制或桌面运行时。实际依赖边界和生产构建均另行检查。

0008 将网页配置对齐 Core，并通过独立上游提交补通用缺口。当前 Core revision 为 60ae97aff99398b835311c716759d59d06dbce67，组合见 docs/sources/runtime-combination.json。core-ui-restoration.json 保留迁入当时的来源哈希与历史 Core revision，不再代表当前运行依赖。

2026-10-09 设置增补：独立 Core revision c44f5ffee737f5915f9baae20b49a33717eaced1 支持未声明上下文长度与受策略管理的路由 JSON 参数。Web 配置 MOC 导出复用已有宿主扩展，未改变 Core 模块所有权。原冻结来源清单仍为历史记录。
