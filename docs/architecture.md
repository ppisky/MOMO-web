# 当前架构

用户明确要求采用 Chatbox 完整源码，此决定替代此前 Remix + assistant-ui 当前构建基线。旧实现保存在 [legacy/ui-prototype](../legacy/ui-prototype)。

应用位于 apps/momo：

- src/main：Electron 生命周期、IPC、本地文件、模型请求与角色记忆。
- src/preload：桌面桥接。
- src/renderer：React、Mantine/MUI、TanStack Router 页面。
- src/shared：类型、主题与工具契约。
- packages/chatbox-core、chatbox-react：对话领域及 React 适配。
- release/app：生产入口与运行时依赖清单。

沿用上游存储、模型与平台接口，不叠加第二套消息状态。上游凭据和业务边界与旧 Remix 服务端方案不同，不能把旧服务端隔离描述为当前已实现。

品牌集中在 src/shared/theme-colors.ts、src/renderer/static/momo-mark.svg 与 assets/icon.png/icon.ico。首页和启动屏使用同形双圆，CSS 变量保留上游名称以便合并更新。

src/main/momo-identity.ts 在存储初始化前设置独立数据目录；显式 --user-data-dir 参数优先。未来运行时与内核替换仍为规划。

角色沿用本地 Copilot 存储模型，创建对话时将人物设定保存为系统消息并关联角色 ID。角色记忆在角色页手动管理，开启后通过会话提示上下文快照读取；新篇章会重新读取记忆，当前生成不受编辑影响。

src/shared/momo-policy.ts 定义产品边界：停用登录供应商，所有对话强制使用普通聊天模式。模型工厂、请求适配层、共享 fetch 和 Electron 网络边界拒绝 Chatbox 服务域名。启动流程不注册 OAuth、MCP、技能、沙盒及知识库服务。

src/renderer/setup/momo-migration.ts 在上游存储升级后、设置与会话载入前执行一次清理。只有消息摘要一致且没有用户设定、线程、分支或附件的旧文本示例才会移除；先将原始记录保存到 momo:retired-examples-backup:v1。备份写入或后续操作失败时不写完成标记，允许下次启动重试。

旧路由重定向到角色或模型设置页，保留历史数据字段和部分上游模块只用于兼容；已移除能力的界面、工具与后台初始化不参与当前工作流。详情见 [精简决策](decisions/0004-roleplay-scope.md)。

模型入口只读取 settings.customProviders 中由用户创建的描述及 settings.providers 中对应配置。系统供应商不注册、不展示；模型工厂拒绝非自定义供应商、空地址及未配置模型 ID。协议适配保留，Chat Completions 和 Responses 使用通用路径规则，不按供应商域名改写地址或附加推广请求头。模型获取不查询 Chatbox 清单或远程目录。

src/shared/momo-settings.ts 统一新对话请求默认值和五种界面语言。模型参数路由为 /settings/model-parameters，旧 /settings/default-models 重定向。请求参数与服务商配置分开，0 值保留，当前会话单独覆盖；defaultChatModel 仅作为历史字段读取，载入后移除偏好，不删除聊天记录。

五种语言资源是简体中文、繁体中文、日语、韩语和英文；MOMO 新界面在 i18n/momo-resources.ts 维护人工校对文案。退休语言资源移出构建，旧偏好与不支持的操作系统语言回退为英文。
