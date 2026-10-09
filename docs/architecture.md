# 当前架构

2026-10-09 用户选择回到原 MOMO-web，移除 Electron，网页调好后再兼容 ron。本决定覆盖旧文档中的桌面构建路线，见 [0006](decisions/0006-web-first.md)。MOMO-app 已有 Core 适配和 ron 成果保留，暂不继续扩大。

## 活动结构

- `apps/momo/src/renderer`：原 React 页面、Mantine/MUI、TanStack Router、主题、语言和浏览器适配。
- `apps/momo/src/shared`：类型、协议适配和平台无关契约。
- `apps/momo/packages/chatbox-core`、`chatbox-react`：原网页的 Chatbox 业务服务与 React 绑定；它们不是 MOMO-core。
- `apps/momo/vite.config.web.ts`：独立网页开发与生产构建，不导入桌面配置。
- `apps/momo/dist/web`：忽略的静态构建产物。

Electron main/preload、桌面平台与存储、IPC stdio、桌面构建/打包/发布工具链及 release/app 清单已移除。源码可从 Git 基线 `5f37630d` 恢复；忽略的旧产物和用户数据没有批量清理。品牌资源、上游署名和 legacy/ui-prototype 保留。

## 浏览器边界

平台入口固定选择 WebPlatform，测试使用 TestPlatform。设置、角色与会话继续使用原 IndexedDB 实现，图片使用浏览器 blob 存储，不增加第二套业务状态。主题监听通过 matchMedia，模型 HTTP/SSE 通过 fetch，文件选择/下载与剪贴板使用现有网页实现。

浏览器不提供桌面文件系统、托盘、自动更新、命令执行或 stdio。已停用工具控制器保留必要类型接口，但原生调用明确返回不支持，不伪造 IPC 或成功结果。遗留移动端和已停用的上游模块不代表新的交付承诺。

模型只访问用户配置的地址。共享模型工厂和请求边界继续阻断 Chatbox 服务域名，不引入公共代理。浏览器凭据存储边界与未来 Core 服务端隔离不同，不能将未来方案写成当前已实现。

## 保留的原业务

角色目前沿用 Copilot 存储，创建对话时关联角色 ID 并保存人物设定。手动故事记忆仍在原角色页，通过原上下文快照参与对话。归档/恢复沿用 SessionService 与现有界面，归档不删除历史。已有网页的存储版本升级和未修改示例备份清理保留，不新增桌面导入兼容。

这些是本轮保留的实际行为；完整 Core 角色卡、真实开场、独立记忆/NSG、空间和参数组按 [计划](roadmap.md) 接替。不能把 Electron 清理登记为 Core 接入完成。

## 验证

check:web 检查依赖、脚本、原生桥接和代码导入；生产构建另外检查实际模块图不含 Electron/main/preload。check:shared-boundaries 检查 shared、chatbox-core、chatbox-react 不反向依赖界面和宿主。浏览器验收不能代替 ron 桌面验收。
