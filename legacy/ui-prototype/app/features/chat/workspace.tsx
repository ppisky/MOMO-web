import {
  ActionBarPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  ThreadListPrimitive,
  ThreadListItemPrimitive,
  useAui,
  useAuiState,
} from "@assistant-ui/react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Check,
  ChevronDown,
  Code2,
  Copy,
  Feather,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Square,
  Sun,
  Moon,
  Monitor,
  RotateCcw,
  Trash2,
  X,
  Compass,
  CalendarDays,
  Pencil,
} from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { BrandMark } from "../../components/brand";
import { ChatRuntime } from "./runtime";
import type { HostAdapter } from "../../../shared/contracts/host";
import type { ConversationEngine } from "../../../shared/contracts/chat";

const HostContext = createContext<HostAdapter | null>(null);
const SearchContext = createContext("");
const CloseSidebarContext = createContext(() => {});
type Theme = "light" | "dark" | "system";

export function ChatWorkspace({
  host,
  engine,
}: {
  host: HostAdapter;
  engine: ConversationEngine;
}) {
  return (
    <HostContext.Provider value={host}>
      <ChatRuntime engine={engine}>
        <Workspace />
      </ChatRuntime>
    </HostContext.Provider>
  );
}

function Workspace() {
  const [sidebar, setSidebar] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const [theme, setTheme] = useState<Theme>("light");
  const [settings, setSettings] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const settingsButton = useRef<HTMLButtonElement>(null);
  const settingsOpener = useRef<HTMLElement | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const runtime = useAui();

  useEffect(() => {
    try {
      const saved = localStorage.getItem("momo-theme");
      if (saved === "light" || saved === "dark" || saved === "system")
        setTheme(saved);
    } catch {
      /* Storage is optional for the preview. */
    }
  }, []);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "system" ? (media.matches ? "dark" : "light") : theme;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  useEffect(() => {
    if (settings) {
      settingsOpener.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      dialog.current?.showModal();
    } else dialog.current?.close();
  }, [settings]);
  useEffect(() => {
    if (!sidebar) return;
    const media = window.matchMedia("(max-width: 760px)");
    const previous = document.activeElement;
    const sync = () => {
      if (mainRef.current) mainRef.current.inert = media.matches;
      if (media.matches && !navRef.current?.contains(document.activeElement))
        navRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    };
    const trap = (event: KeyboardEvent) => {
      if (!media.matches || event.key !== "Tab" || dialog.current?.open) return;
      const controls = Array.from(
        navRef.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input",
        ) ?? [],
      );
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    sync();
    media.addEventListener("change", sync);
    window.addEventListener("keydown", trap);
    return () => {
      media.removeEventListener("change", sync);
      window.removeEventListener("keydown", trap);
      if (mainRef.current) mainRef.current.inert = false;
      if (media.matches && previous instanceof HTMLElement) previous.focus();
    };
  }, [sidebar]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (dialog.current?.open) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCollapsed(false);
        setSidebar(true);
        requestAnimationFrame(() => searchInput.current?.focus());
      }
      if (
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        event.key.toLowerCase() === "o"
      ) {
        event.preventDefault();
        runtime.thread.cancelRun();
        void runtime.threads.switchToNewThread();
        setSidebar(false);
      }
      if (event.key === "Escape") setSidebar(false);
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [runtime]);
  const selectTheme = (value: Theme) => {
    setTheme(value);
    try {
      localStorage.setItem("momo-theme", value);
    } catch {
      /* Keep the in-memory choice. */
    }
  };
  const closeSettings = () => {
    dialog.current?.close();
    setSettings(false);
    settingsOpener.current?.focus();
  };

  return (
    <div
      className={`workspace ${collapsed ? "sidebar-collapsed" : ""} ${sidebar ? "sidebar-open" : ""}`}
    >
      {sidebar && (
        <button
          className="sidebar-scrim"
          tabIndex={-1}
          aria-label="关闭导航"
          onClick={() => setSidebar(false)}
        />
      )}
      <aside ref={navRef} className="sidebar" aria-label="会话导航">
        <div className="sidebar-brand">
          <BrandMark />
          <span>
            MOMO<span className="brand-dot"> AI</span>
          </span>
          <button
            className="icon-button collapse-button"
            aria-label="收起侧栏"
            title="收起侧栏"
            onClick={() => {
              setCollapsed(true);
              setSidebar(false);
            }}
          >
            <PanelLeftClose size={18} />
          </button>
        </div>
        <ThreadListPrimitive.New
          className="new-chat"
          onClick={() => {
            runtime.thread.cancelRun();
            setSearch("");
            setSidebar(false);
          }}
        >
          <Plus size={18} />
          <span>新建对话</span>
          <kbd>Ctrl ⇧ O</kbd>
        </ThreadListPrimitive.New>
        <label className="search-box">
          <Search size={16} />
          <input
            ref={searchInput}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索对话"
            aria-label="搜索对话"
          />
          <kbd>Ctrl K</kbd>
        </label>
        <div className="history-heading">
          <span>最近对话</span>
          <span className="small-label">本次会话</span>
        </div>
        <div className="history-list">
          <SearchContext.Provider value={search}>
            <CloseSidebarContext.Provider value={() => setSidebar(false)}>
              <ThreadListPrimitive.Root>
                <ThreadListPrimitive.Items
                  components={{ ThreadListItem: HistoryItem }}
                />
                <HistoryEmpty search={search} />
              </ThreadListPrimitive.Root>
            </CloseSidebarContext.Provider>
          </SearchContext.Provider>
        </div>
        <div className="sidebar-bottom">
          <div className="local-note">
            <span className="status-dot" />
            本地演示 · 无需登录
          </div>
          <button
            ref={settingsButton}
            className="settings-button"
            onClick={() => setSettings(true)}
          >
            <span className="profile-avatar">
              <Settings2 size={18} />
            </span>
            <span>
              <strong>设置</strong>
              <small>外观与模型</small>
            </span>
            <span className="version-label">v0.1</span>
          </button>
        </div>
      </aside>
      <main ref={mainRef} className="main-panel">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button expand-button"
              aria-label="展开侧栏"
              onClick={() => {
                setCollapsed(false);
                setSidebar(true);
              }}
            >
              <PanelLeftOpen size={19} />
            </button>
            <ConversationTitle />
          </div>
          <span className="preview-label">
            <span />
            演示模式
          </span>
        </header>
        <ChatSurface onModelClick={() => setSettings(true)} />
      </main>
      <dialog
        ref={dialog}
        className="settings-dialog"
        onCancel={closeSettings}
        onClose={() => setSettings(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) closeSettings();
        }}
      >
        <div className="dialog-header">
          <div>
            <span className="eyebrow">MOMO PREFERENCES</span>
            <h2>设置</h2>
          </div>
          <button
            className="icon-button"
            aria-label="关闭设置"
            onClick={closeSettings}
          >
            <X size={20} />
          </button>
        </div>
        <section>
          <h3>外观</h3>
          <p>选择一个舒服的阅读环境。</p>
          <div className="theme-options">
            {(
              [
                { value: "light", label: "浅色", icon: Sun },
                { value: "dark", label: "深色", icon: Moon },
                { value: "system", label: "跟随系统", icon: Monitor },
              ] as const
            ).map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                aria-pressed={theme === value}
                onClick={() => selectTheme(value)}
              >
                <Icon size={20} />
                {label}
                {theme === value && <Check size={14} />}
              </button>
            ))}
          </div>
        </section>
        <section className="model-info">
          <div className="model-info-title">
            <Sparkles size={19} />
            <h3>MOMO 演示助手</h3>
            <span className="tag">当前</span>
          </div>
          <p>
            预设回复用于体验聊天界面，尚未连接真实 AI
            模型。对话仅在当前页面内保留，刷新后清空。
          </p>
        </section>
        <div className="dialog-footer">
          <span>MOMO · 预览版 0.1</span>
          <button className="primary-button" onClick={closeSettings}>
            完成
          </button>
        </div>
      </dialog>
    </div>
  );
}

function ConversationTitle() {
  const runtime = useAui();
  const title = useAuiState(
    (s) =>
      s.threads.threadItems.find((item) => item.id === s.threads.mainThreadId)
        ?.title,
  );
  const empty = useAuiState((s) => s.thread.isEmpty);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const save = () => {
    if (draft.trim())
      runtime.threads.item("main").rename(draft.trim().slice(0, 80));
    setEditing(false);
  };
  if (editing)
    return (
      <input
        className="title-input"
        aria-label="对话标题"
        maxLength={80}
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  return (
    <button
      className="conversation-title"
      disabled={empty}
      title={empty ? "新对话" : "重命名对话"}
      onClick={() => {
        setDraft(title ?? "新对话");
        setEditing(true);
      }}
    >
      <span>{title ?? "新对话"}</span>
      {!empty && <Pencil size={14} />}
    </button>
  );
}

function HistoryEmpty({ search }: { search: string }) {
  const allItems = useAuiState((s) => s.threads.threadItems);
  const items = allItems.filter((item) => item.status === "regular");
  if (items.length)
    return search &&
      !items.some((item) =>
        (item.title ?? "新对话").toLowerCase().includes(search.toLowerCase()),
      ) ? (
      <p className="search-hint">没有找到匹配的对话</p>
    ) : null;
  return (
    <div className="history-empty">
      <MessageCircle size={21} strokeWidth={1.4} />
      <p>想法，从一次对话开始</p>
      <span>发送消息后，对话会出现在这里</span>
    </div>
  );
}

function HistoryItem() {
  const title = useAuiState((s) => s.threadListItem.title);
  const query = useContext(SearchContext);
  const close = useContext(CloseSidebarContext);
  const runtime = useAui();
  if (query && !(title ?? "新对话").toLowerCase().includes(query.toLowerCase()))
    return null;
  return (
    <ThreadListItemPrimitive.Root className="history-item">
      <ThreadListItemPrimitive.Trigger
        className="history-trigger"
        onClick={() => {
          runtime.thread.cancelRun();
          close();
        }}
      >
        <MessageCircle size={16} />
        <span>
          <ThreadListItemPrimitive.Title fallback="新对话" />
        </span>
      </ThreadListItemPrimitive.Trigger>
      <ThreadListItemPrimitive.Delete
        className="icon-button delete-thread"
        aria-label={`删除对话 ${title ?? "新对话"}`}
        title="删除对话"
      >
        <Trash2 size={14} />
      </ThreadListItemPrimitive.Delete>
    </ThreadListItemPrimitive.Root>
  );
}

const suggestions = [
  {
    icon: Feather,
    title: "写点有意思的",
    description: "让一个灵感，长成一段文字",
    prompt: "帮我找一些写作灵感",
  },
  {
    icon: Compass,
    title: "把问题想清楚",
    description: "换个角度，发现新的可能",
    prompt: "帮我把一个复杂的问题拆解清楚",
  },
  {
    icon: Code2,
    title: "一起写代码",
    description: "从一个想法，到一个实现",
    prompt: "写一个 TypeScript 分组函数，并解释实现思路",
  },
  {
    icon: CalendarDays,
    title: "理一理日常",
    description: "给重要的事，留出一点时间",
    prompt: "帮我制定一个轻量的本周计划",
  },
];

function ChatSurface({ onModelClick }: { onModelClick: () => void }) {
  const empty = useAuiState((s) => s.thread.isEmpty);
  const running = useAuiState((s) => s.thread.isRunning);
  const firstPrompt = useAuiState((s) =>
    s.thread.messages
      .find((m) => m.role === "user")
      ?.content.filter((p) => p.type === "text")
      .map((p) => p.text)
      .join(""),
  );
  const mainItem = useAuiState((s) =>
    s.threads.threadItems.find((item) => item.id === s.threads.mainThreadId),
  );
  const runtime = useAui();
  useEffect(() => {
    if (firstPrompt && mainItem?.status === "regular" && !mainItem.title)
      runtime.threads.item("main").rename(firstPrompt.slice(0, 28));
  }, [firstPrompt, mainItem, runtime]);
  return (
    <ThreadPrimitive.Root className={`thread ${empty ? "thread-empty" : ""}`}>
      <ThreadPrimitive.Viewport className="thread-viewport">
        {empty ? (
          <div className="welcome">
            <BrandMark large />
            <div className="welcome-kicker">你的 AI 对话空间</div>
            <h1>有什么可以帮你？</h1>
            <p className="welcome-description">
              写作、编程、探索新知。让想法更进一步。
            </p>
            <div className="suggestions">
              {suggestions.map(({ icon: Icon, title, description, prompt }) => (
                <button
                  key={title}
                  className="suggestion"
                  onClick={() => {
                    runtime.composer.setText(prompt);
                    document
                      .querySelector<HTMLTextAreaElement>(".composer-input")
                      ?.focus();
                  }}
                >
                  <Icon size={20} strokeWidth={1.6} />
                  <strong>{title}</strong>
                  <span>{description}</span>
                  <ArrowUpRight className="suggestion-arrow" size={15} />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="messages">
            <div className="conversation-start">MOMO 演示助手</div>
            <ThreadPrimitive.Messages
              components={{ UserMessage, AssistantMessage }}
            />
          </div>
        )}
      </ThreadPrimitive.Viewport>
      <div className="composer-region">
        <ThreadPrimitive.ScrollToBottom
          className="scroll-bottom icon-button"
          aria-label="滚动到底部"
        >
          <ArrowDown size={18} />
        </ThreadPrimitive.ScrollToBottom>
        <ComposerPrimitive.Root className="composer">
          <ComposerPrimitive.Input
            className="composer-input"
            placeholder="发送消息，开始对话…"
            aria-label="消息输入框"
            autoFocus
            rows={2}
          />
          <div className="composer-toolbar">
            <button
              type="button"
              className="model-button"
              onClick={onModelClick}
            >
              <span className="model-symbol">
                <Sparkles size={13} />
              </span>
              <span>MOMO 演示助手</span>
              <ChevronDown size={13} />
            </button>
            <div className="send-group">
              <span className="enter-hint">
                {running ? "正在组织回复" : "Enter 发送"}
              </span>
              {running ? (
                <ComposerPrimitive.Cancel
                  className="send-button stop-button"
                  aria-label="停止生成"
                  title="停止生成"
                >
                  <Square size={14} fill="currentColor" />
                </ComposerPrimitive.Cancel>
              ) : (
                <ComposerPrimitive.Send
                  className="send-button"
                  aria-label="发送消息"
                  title="发送消息"
                >
                  <ArrowUp size={20} />
                </ComposerPrimitive.Send>
              )}
            </div>
          </div>
        </ComposerPrimitive.Root>
        <div className="composer-footnote">
          <span>Shift + Enter 换行</span>
          <span>演示回复 · 刷新后不保留对话</span>
        </div>
      </div>
    </ThreadPrimitive.Root>
  );
}

function UserMessage() {
  return (
    <MessagePrimitive.Root className="message user-message">
      <div className="user-bubble">
        <MessagePrimitive.Content />
      </div>
    </MessagePrimitive.Root>
  );
}

function AssistantMessage() {
  const message = useAuiState((s) => s.message);
  const host = useContext(HostContext);
  const [copyState, setCopyState] = useState("");
  const running = message.status?.type === "running";
  const failed =
    message.status?.type === "incomplete" && message.status.reason === "error";
  const cancelled =
    message.status?.type === "incomplete" &&
    message.status.reason === "cancelled";
  const text = message.content
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("\n");
  const copy = async () => {
    try {
      if (!host) throw new Error("Missing host");
      await host.copyText(text);
      setCopyState("已复制");
    } catch {
      setCopyState("复制失败，请选中文字复制");
    }
  };
  useEffect(() => {
    if (!copyState) return;
    const timer = setTimeout(() => setCopyState(""), 2200);
    return () => clearTimeout(timer);
  }, [copyState]);
  return (
    <MessagePrimitive.Root className="message assistant-message">
      <div className="assistant-byline">
        <BrandMark />
        <strong>MOMO</strong>
        <span>演示助手</span>
      </div>
      <div className="message-content">
        <ReactMarkdown
          components={{ a: ({ children }) => <span>{children}</span> }}
        >
          {text}
        </ReactMarkdown>
        {running && (
          <span
            className="typing-indicator"
            role="status"
            aria-label="正在回复"
          >
            正在回复…
          </span>
        )}
        {failed && (
          <p role="alert" className="error-message">
            回复中断了，请检查连接后重试。
          </p>
        )}
        {cancelled && <p className="cancelled-message">已停止生成</p>}
      </div>
      {!running && (
        <ActionBarPrimitive.Root className="message-actions">
          <button
            className="icon-button"
            title="复制回复"
            aria-label="复制回复"
            onClick={() => void copy()}
          >
            {copyState === "已复制" ? <Check size={15} /> : <Copy size={15} />}
          </button>
          <ActionBarPrimitive.Reload
            className="icon-button"
            title="重新生成"
            aria-label="重新生成"
          >
            <RotateCcw size={15} />
          </ActionBarPrimitive.Reload>
          <span role="status">{copyState}</span>
        </ActionBarPrimitive.Root>
      )}
    </MessagePrimitive.Root>
  );
}
