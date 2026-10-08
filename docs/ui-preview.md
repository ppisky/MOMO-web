# UI 定制与验证

保留 Chatbox 实际组件、会话导航、主会话区、输入框与设置。浅色默认淡紫白，深色暗紫；品牌色分别为 #7956cd 和 #b398ee。

内部标识为无描边的重叠蓝紫实心圆；Windows 应用和任务栏使用原始毛玻璃图标。没有新增呼吸、弹跳等装饰动画，保留上游功能性加载反馈。

## 2026-10-08 验证记录

- TypeScript 检查通过；升级 Electron 后，将旧 File.path 访问收敛到校验过的兼容读取，桌面使用已有 preload webUtils 接口。
- 7 个相关测试文件、60 项测试通过，覆盖主题、设置迁移、附件与生产依赖版本守卫。最终再次运行品牌测试，10 项通过。
- 修改文件的定向 Biome lint 无错误；有 2 条警告（无 await 的空统计函数及上游列表 key）。未声明全仓库 lint 或完整测试集通过。
- main、preload、renderer 生产构建通过；修正未打包启动生产构建时的 preload 路径。保留上游较大分包的构建提示。
- Windows x64 目录包生成成功；运行时依赖版本一致性、asar 外置依赖、ripgrep 和 libsql 校验通过。
- 独立 MOMO.exe 已启动；日志确认 renderer 使用 desktop 平台、存储迁移与知识库数据库初始化成功。使用独立 QA 数据目录，未读取真实聊天。
- 浏览器验证了中文、浅色/深色主题、模型表单、新会话和 Ctrl+Enter 本地保存消息；刷新后测试消息仍存在。测试模型显示“界面验证（未连接）”，没有进行真实模型调用。
- 截图位于 test-results/momo-chatbox-light.png 与 momo-chatbox-dark.png（忽略目录）。原生窗口自动化最终受到“foreground window did not report a process id”错误限制，未完成打包窗口内的全部交互检查；画面检查使用同源 Web 渲染器。

## 尚未验证与已知限制

未验证真实供应商、登录、MCP 工具执行、知识库问答、PDF 解析、macOS/Linux 打包和安装向导。运行时有可选 @napi-rs/canvas 缺失提示，PDF 能力需要单独验证。生产依赖 npm 审计报告 4 项问题（3 high、1 critical），沿用上游版本，未在本次品牌定制中升级；对外分发前需审查处理。

旧原型 19 项测试与截图不作为本次源码验证结果。
