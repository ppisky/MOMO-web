# 0001：先稳定 UI，通过能力契约替换内核

日期：2026-10-08。状态：按用户明确方向执行。

## 背景

用户希望优先调试画面，并指出桌面运行时和核心对话内核后续可能替换，整体 UI 保持稳定。

## 决策

- 保留 React + assistant-ui 的界面层，以 Remix 提供当前页面宿主与模拟聊天接口。
- `ChatWorkspace` 接收 `engine` 和 `host`，组合入口放在 Remix 页面路由。工作区不自行选择底层实现。
- `ConversationEngine` 接收应用消息与 AbortSignal，输出增量事件。其类型不依赖 React、assistant-ui、Electron 或模型供应商。
- `ChatRuntime` 负责把领域事件转换为 assistant-ui 累计消息。未来更换模型 SDK、代理框架、HTTP 或 IPC 传输，只需改变能力适配实现；若更换 assistant-ui，则集中修改该运行时边界与 primitives 组合。
- `HostAdapter` 当前只暴露复制文本；未来按具体需求增加文件选择等窄能力，不提前开放任意系统调用。
- 浏览器与 Electron 共用 UI；Electron 使用独立服务宿主与 preload 复制接口。

## 当前组合

```text
Remix 页面组合入口
  └─ ChatWorkspace(host, engine)
       ├─ HostAdapter ← browserHost / desktopHost（剪贴板）
       └─ ChatRuntime ← httpEngine
                         └─ Remix resource route
                              └─ demoEngine（预设回复）
```

## 代价与下一步

已补齐基本桌面鉴权和便携版构建；持久化、真实模型连接与安装器仍未交付。当前会话保存在 assistant-ui runtime 的内存中，不作为持久化实现。

接入真实内核前需扩展协议的版本、运行标识与错误分类，完善服务鉴权、请求限制和取消测试。接入桌面宿主时实现受控 preload 桥与 HostAdapter，保留 UI 布局和语义设计变量。
