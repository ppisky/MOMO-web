import { ChatWorkspace } from "../features/chat/workspace";
import { httpEngine } from "../features/chat/http-engine";
import { browserHost } from "../platform/browser-host";
import { desktopHost } from "../platform/desktop-host";
import { useSyncExternalStore } from "react";
import { BrandMark } from "../components/brand";

const subscribe = () => () => {};

export default function Index() {
  // The interactive runtime uses layout effects and browser-only state. Keep it
  // behind a hydration boundary while Remix continues to serve the API and shell.
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  if (!hydrated)
    return (
      <main className="loading-screen" role="status">
        <BrandMark large />
        <p>正在打开你的思考空间…</p>
      </main>
    );
  return (
    <ChatWorkspace
      host={window.momoDesktop ? desktopHost : browserHost}
      engine={httpEngine}
    />
  );
}
