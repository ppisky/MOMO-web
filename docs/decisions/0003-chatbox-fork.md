# 0003：采用 Chatbox 完整源码

状态：2026-10-08 已决定。

用户明确要求“先全抄了，换个颜色和图标就行”，因此采用 Chatbox 全量源码，替代独立仿制 UI。来源与许可见 [UPSTREAM.md](../../UPSTREAM.md)。

保留上游 Electron、React、TypeScript、pnpm、Mantine/MUI、TanStack Router 与对话实现。本次用户决定授权了原 Remix/assistant-ui 基线替换；旧原型移入 legacy 保留。

修改 MOMO 品牌、紫色主题、无描边双圆和 Windows 封装图标，同时隔离分叉身份、统计和升级。完整源码不等于所有平台、供应商和在线服务已经验证。后续运行时和对话内核替换仍为规划。

