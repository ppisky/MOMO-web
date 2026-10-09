# 源码来源与定制记录

- 上游：https://github.com/chatboxai/chatbox
- 基准提交：0ac6385ae1ff5bf778777826da3c5edcd55b61b8
- 接入日期：2026-10-08
- 源码位置：apps/momo
- 许可：GPL-3.0，保留 LICENSE、原作者与上游 README。
- 本地完整源码基线：5f37630dfbb4d7007ea8b1abddfdce1721b117a9。2026-10-09 将已有快照接为 main 基线后单独实施网页清理。

这是上游源码修改版，不是 Chatbox 官方发行包。分发时保留许可、署名，并按 GPL 提供对应源码。MOMO 品牌图片由用户提供，位于 public/brand。

## 当前定制

保留 MOMO 名称、紫色主题、双圆标识、原角色对话和设置页面、五种语言、自定义 API 协议接入。关闭上游统计、错误上报和更新，停用登录、订阅、在线角色市场、内置云模型和工作工具。现有网页存储升级与示例备份清理保留。

2026-10-09 用户决定回到原仓库，移除 Electron，先完成网页。删除 main/preload、桌面 IPC 和存储、electron-vite/electron-builder/webpack 工具链、生产包清单及相关依赖。网页用原 Vite 独立构建；旧桌面源码在 Git 历史中可追溯，忽略的旧构建目录不纳入当前构建。

当前原网页仍使用 Chatbox 业务包和浏览器存储，MOMO-core 接入待实施；MOMO-app 和 ron 保留成果、暂停新增开发。见 [0006](docs/decisions/0006-web-first.md)。旧原型在 legacy/ui-prototype，不参与构建。

## 工具兼容

使用 pnpm 10.33.0，应用运行时固定 Node 26.11.1。旧翻译工具仍有 engine 警告；不为清理 Electron 顺带升级框架。测试进程关闭 Node 26 实验性 Web Storage，让 jsdom 提供 localStorage。

锁文件中的 electron-to-chromium 是 Browserslist 的浏览器版本映射数据，不含 Electron 二进制或桌面运行时。实际依赖边界和生产构建均另行检查。
