# 网页与 Core 的配套运行

网页和 [MOMO-core](https://github.com/ppisky/MOMO-core) 分别维护和发布。网页通过 Core 原生 HTTP/SSE 接口调用角色、对话、记忆、NSG 和 MO State；不把 Core 当作可以替换 OpenAI SDK base URL 的服务，也不在浏览器复制业务数据库。

配套版本为 Core 提交 `ef8425d`（含编译时 Git 版本查询），精确提交见 [运行组合](sources/runtime-combination.json)。网页当前能力和未完成项见 [README](../README.md) 与 [产品边界](product-boundaries.md)。

## 新安装

先在独立目录取得并构建 Core，Rust 工具链固定为 `1.99.0`：

```sh
git clone https://github.com/ppisky/MOMO-core.git
cd MOMO-core
git checkout ef8425d3ef872cc9ed4491fc1e923e5a4ba40b8b
cargo build --release --package momo-server --locked
```

在 Windows PowerShell 中启动 Core：

```powershell
$env:MOMO_SERVER_BIND = '127.0.0.1:8765'
$env:MOMO_DATA_DIR = Join-Path $env:LOCALAPPDATA 'MOMO-Core'
./target/release/momo-server.exe
```

在 Linux 中使用自己的持久目录：

```sh
export MOMO_SERVER_BIND=127.0.0.1:8765
export MOMO_DATA_DIR="$HOME/.local/share/momo-core"
./target/release/momo-server
```

另开终端，在本网页仓库执行：

```sh
pnpm install --frozen-lockfile
pnpm --dir apps/momo install --frozen-lockfile
```

复制 `apps/momo/.env.example` 为 `apps/momo/.env.local`，将 `MOMO_CORE_ORIGIN` 指向刚启动的 `http://127.0.0.1:8765`，再执行 `pnpm dev`。打开 `http://127.0.0.1:1212/`，在模型设置中配置自己的服务商与模型。没有实际模型连接时，页面不会生成真实回复。

应用脚本使用 pnpm 提供的 Node `26.11.1`；pnpm 固定 `10.33.0`。`pnpm build` 生成浏览器资源和服务端宿主，`pnpm preview` 提供生产预览及同源 API。仅托管 `dist/web` 静态文件无法完成 Core 接入。

## 更新已有安装

停止拥有数据目录的进程，完整备份 Core 数据与网页宿主配置后，再更新二进制。沿用原 `MOMO_DATA_DIR` 和 `MOMO_APP_DATA_DIR`；后者需要指向原 `host-config.sqlite3` 所在目录，以保留个人空间 UUID、参数组和当前空间。不要重新初始化已有数据库。

Core RC6 的 SQLite 迁移、恢复与限制见 [发布说明](https://github.com/ppisky/MOMO-core/blob/v1.0.0-rc.6/docs/release_notes_1_0_0_rc6.md)。归档不会删除历史或资产；旧 MO State 记录没有回复关联时，实际注入显示未知。

Core 默认绑定 loopback，本组合也要求本机同源宿主，并未提供面向公网用户的认证系统。模型凭据留在服务端；不进入浏览器 bundle、源码仓库或 MOC 导出。调试与离线联调见 [开发文档](development.md)。

## 许可

Core 源码保持 Apache-2.0，网页源码采用 GPL-3.0，来源与署名见 [UPSTREAM](../UPSTREAM.md)。两圆重合图标及简化版单独采用 CC BY-SA 4.0，具体文件与署名见 [图标许可](../public/brand/README.md)。各仓库保留自己的许可，不用一个许可覆盖整个组合。
