# 源码来源与定制记录

- 上游：https://github.com/chatboxai/chatbox
- 基准提交：0ac6385ae1ff5bf778777826da3c5edcd55b61b8
- 接入日期：2026-10-08
- 源码位置：apps/momo
- 许可：GPL-3.0，保留 LICENSE、原作者与上游 README。

这是上游源码修改版，不是 Chatbox 官方发行包。分发时保留许可、署名，并按 GPL 提供对应源码。MOMO 品牌图片由用户提供，位于 public/brand。

## 修改范围

MOMO 应用名、紫色默认主题、无描边重叠双圆、Windows PNG/ICO、独立数据目录与协议。页面收敛为角色对话、角色管理和独立模型设置。工具使用 pnpm 10.33.0、Node 26.11.1、Electron 44.7.0。

关闭上游统计、错误上报 DSN 与升级；停用账号登录、授权、订阅、在线角色市场与 Chatbox 云服务。移除非角色扮演入口，停用搜索、画图、知识库、MCP、技能、工作模式后台；历史数据类型与部分源模块保留兼容。新安装不创建示例，已有未修改文本示例经备份后清理。

旧原型与文档保存在 legacy/ui-prototype，不参与当前构建。后续桌面运行时和对话内核替换尚未实施。

撤除系统供应商注册与预设列表，仅保留用户自建 API 连接。移除空地址回退、推荐模型、远程模型目录预取与推广请求头；模型参数独立成页。界面语言收敛为中日韩、繁体中文与英文五种，主要 MOMO 流程维护人工校对文案。细节见 [0005](docs/decisions/0005-custom-providers.md)。

## 工具兼容

旧翻译工具 i18next-parser 只声明支持 Node 18/20/22。为使用 Node 26，安装阶段关闭严格 engine 拒绝并保留警告；应用以实际类型、构建和运行验证为准，翻译脚本未验证。

开发使用 pnpm。保留上游 beforePack 内部 npm ci 物化独立生产依赖的实现，故 release/app/package-lock.json 必须保留，并校验与 pnpm 锁版本一致。下载使用官方 npm registry。

Node 26 的测试进程关闭实验性 Web Storage，以免覆盖 jsdom 提供的 localStorage。Electron 44 的 File.path 类型移除已通过边界读取及原有 webUtils 接口适配。Windows 目录打包使用安装好的 Electron 二进制，原始图标与对应 ICO 哈希校验一致。
