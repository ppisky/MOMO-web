# 0002：Chatbox 交互参考与紫色桌面方案

日期：2026-10-08。状态：按用户要求实现。

## 来源与取舍

用户指定参考 [Chatbox](https://github.com/chatboxai/chatbox)，使用 pnpm、尽量新的 Node，继续 Electron，并采用用户提供的蓝紫毛玻璃图标。

参考范围为 Chatbox 的侧栏会话组织、顶部标题、底部稳定输入区及设置入口。检视其 Sidebar、Header 与 InputBox 结构后，在现有栈独立实现，不引入其源码、商标、订阅系统或其他框架。上游仓库声明 GPL-3.0；本次未复制上游源文件。

继续使用 Electron + Remix v2 + React + assistant-ui + TypeScript。Chatbox 自身的框架组合与 Node 约束不作为本项目迁移依据。

## 视觉与动效

- `public/brand/momo.png` 原样使用用户提供的图标，欢迎页、侧栏、回复头像与网页图标共用。
- 浅色使用淡紫侧栏、近白内容区、紫色操作；深色使用深紫灰背景和淡紫操作。蓝色保留在品牌图标中。
- 主界面保持平整、清楚的分栏；毛玻璃用于设置遮罩，文字区保持实色。
- 不旋转品牌、不移动按钮、不让占位符呼吸。只有 100ms 的颜色状态变化；减少动态效果偏好关闭过渡。
- 重命名、搜索、主题、停止、重试与复制均有实际实现，不展示未接入的附件、联网搜索或付费按钮。

## 桌面边界

主进程生成每次启动独立的随机凭证，经专用进程通道交给 utilityProcess。服务监听回环随机端口，先校验 Cookie、Host 与变更请求 Origin，再处理资源或 Remix 路由。

preload 仅提供 `copyText`；主进程校验调用窗口、主 frame、origin 和文本大小。窗口启用 contextIsolation、sandbox，关闭 Node 集成、任意导航、新窗口和权限请求。生产 CSP 禁止远程脚本、对象与嵌入；Remix 引导脚本暂使用 inline 许可，后续生产加固应接入 nonce。

当前使用非持久 Electron session，退出时终止服务。服务异常会通知用户并退出；自动恢复与持久化仍为规划。

## 运行时与打包

pnpm 11.25.0 管理项目 Node 26.11.1；使用官方 Node dist 地址及 pnpm 的校验机制，不修改机器全局版本。Electron 44.7.0 自带运行时。

Remix 先生成客户端和服务端，esbuild 再将主进程、preload 与服务入口分别打包。packager 只收集明确的产物，避免把仓库、测试数据或开发依赖打入应用。Windows 便携版使用 asar；安装器、签名、自动更新和其他平台支持尚未实现。
