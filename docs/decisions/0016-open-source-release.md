# 0016：Core RC6 与网页开源准备

2026-10-11。用户授权两部分整合开源，先在现有 `ppisky/MOMO-core` 发布 `v1.0.0-rc.6`，再将当前网页源码公开到独立的 `ppisky/MOMO-web`。

- Core 和网页保持独立仓库，整合体现为配套提交、原生 HTTP/SSE 接口和可复现的启动说明。Core 不嵌入网页组件，网页不复制内核。
- Core 保持 Apache-2.0；网页保留 Chatbox 上游 GPL-3.0、署名和完整对应源码。双圆重合原图、简化矢量版及其图标容器按用户授权单独采用 CC BY-SA 4.0，逐文件列明范围，不把第三方图像重新授权。
- 输入占位符改为“输入消息…”，空对话提示改为“输入消息开始对话。”，五种语言同步使用中性文案。保留现有 Enter/Shift+Enter 和输入法行为。
- Core RC6 先完成本机完整发布检查及精确提交的 Linux、Windows、安全 CI，再创建预发布 tag/Release。网页公开发布仍须有独立的源码/依赖边界检查、文档和配套 Core revision，不把桌面能力当作已通过。
- 网页开源目标由当前源码仓库单独承载，不更改其他仓库的可见性，不混入暂停中的 App 或 ron。

网页准备独立的 Linux/Windows CI：固定 pnpm 10.33.0 与 Node 26.11.1，冻结锁安装后检查类型、浏览器边界、产品契约/HTTP 宿主、五种语言及生产构建。它不连接付费服务商；真实 Core 离线联调继续按开发文档单独验证，不能把源码 CI 当作桌面验收。

Core RC6 已发布为 [GitHub 预发布](https://github.com/ppisky/MOMO-core/releases/tag/v1.0.0-rc.6)，不可变 tag 指向 `c61a7419dac1cbf1421e0b4bd4e35a3944d4c0f5`。该提交的 [Linux、Windows 与安全 CI](https://github.com/ppisky/MOMO-core/actions/runs/38119576818) 全部通过；网页配套记录本次实际 release 二进制联调，不以其他仓库的脏工作区 HEAD 作为依赖。
