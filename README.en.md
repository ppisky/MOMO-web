# MOMO Web

[简体中文](README.md)

MOMO is an AI conversation app for characters and stories, with long-term memory, a Narrative Semantic Graph, MO State, and personal spaces.

[Source](https://github.com/ppisky/MOMO-web) · [MOMO Core](https://github.com/ppisky/MOMO-core) · [Issues](https://github.com/ppisky/MOMO-web/issues)

## Features

- Character configuration, a default assistant, opening messages, streaming conversations, archiving and restoration.
- Separate memory and semantic-graph pages for editing content, relationships and injection scope.
- MO State snapshots, processing records, response-injection audits and character profiles.
- Personal spaces with asset migration; scoped MOC export with optional password encryption.
- Model providers, conversation parameter groups, visual and embedding models; OpenAI Chat Completions and Responses.
- Editable prompts with reset to defaults; English, Simplified/Traditional Chinese, Japanese and Korean interfaces.

Configuration-package restoration, conversation deletion/branching/chapters and a complete NSG governance approval UI are not yet available. See [product boundaries](docs/product-boundaries.md) (Chinese).

## Run locally

Start [MOMO Core v1.0.0-rc.6](https://github.com/ppisky/MOMO-core/releases/tag/v1.0.0-rc.6) first. With Rust **1.99.0** and a C/C++ build toolchain installed:

```sh
git clone https://github.com/ppisky/MOMO-core.git
cd MOMO-core
git checkout v1.0.0-rc.6
cargo build --release --package momo-server --locked
```

Run `target/release/momo-server` (`.exe` on Windows). It defaults to `127.0.0.1:8765`; set `MOMO_DATA_DIR` to a persistent directory before starting it.

In another terminal, use **pnpm 10.33.0** to install the web application. pnpm manages the app's **Node 26.11.1** runtime; the root launcher accepts Node 22.20+.

```sh
git clone https://github.com/ppisky/MOMO-web.git
cd MOMO-web
pnpm install --frozen-lockfile
pnpm --dir apps/momo install --frozen-lockfile
```

Copy `apps/momo/.env.example` to `apps/momo/.env.local`. Set `MOMO_CORE_ORIGIN` (default `http://127.0.0.1:8765`) and `MOMO_APP_DATA_DIR` to a persistent configuration directory, then run:

```sh
pnpm dev
```

Open [http://127.0.0.1:1212/](http://127.0.0.1:1212/) and configure your model provider in Settings. Use `pnpm build` followed by `pnpm preview` for the production build. Both the web assets and same-origin API host are required; static-only hosting is insufficient. This application is intended for local use and does not provide public-server account authentication.

Before upgrading, stop the services and back up both data directories. Keep the same paths to retain personal spaces and configuration. About displays the web package version and the connected Core version automatically.

## Documentation and licensing

[Integration](docs/core-integration.md) · [Architecture](docs/architecture.md) · [Development](docs/development.md) · [Roadmap](docs/roadmap.md) (Chinese)

Source code is licensed under [GPL-3.0](LICENSE). MOMO's overlapping-circle logos and simplified design use [CC BY-SA 4.0](public/brand/README.md). Third-party projects and attribution are listed in [Acknowledgements](UPSTREAM.md).
