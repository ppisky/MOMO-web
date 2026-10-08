import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  session,
  utilityProcess,
} from "electron";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import {
  copyTextSchema,
  serviceReadySchema,
} from "../../shared/contracts/desktop";

let service: Electron.UtilityProcess | undefined;
let window: BrowserWindow | undefined;
let quitting = false;
let trustedOrigin = "";
app.setName("MOMO");
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    window?.restore();
    window?.focus();
  });
  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", () => {
    quitting = true;
    service?.kill();
  });
  void app
    .whenReady()
    .then(async () => {
      const token = randomBytes(32).toString("hex");
      service = utilityProcess.fork(join(__dirname, "server.cjs"), [], {
        serviceName: "MOMO local service",
        stdio: "pipe",
        env: { ...process.env, NODE_ENV: "production" },
      });
      if (!app.isPackaged) service.stderr?.pipe(process.stderr);
      service.on("exit", () => {
        if (!quitting) {
          dialog.showErrorBox(
            "MOMO 服务已停止",
            "请重新打开应用。当前预览对话仅保留在内存中。",
          );
          app.quit();
        }
      });
      const port = await new Promise<number>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("Local service startup timed out")),
          20_000,
        );
        service?.once("message", (message: unknown) => {
          clearTimeout(timer);
          const ready = serviceReadySchema.safeParse(message);
          if (ready.success) resolve(ready.data.port);
          else reject(new Error("Invalid service startup response"));
        });
        service?.once("exit", () => {
          clearTimeout(timer);
          reject(new Error("Local service exited"));
        });
        service?.postMessage({ token });
      });
      trustedOrigin = `http://127.0.0.1:${port}`;
      const browserSession = session.fromPartition("momo-session");
      browserSession.setPermissionRequestHandler(
        (_webContents, _permission, callback) => callback(false),
      );
      browserSession.setPermissionCheckHandler(() => false);
      await browserSession.cookies.set({
        url: trustedOrigin,
        name: "momo_session",
        value: token,
        httpOnly: true,
        sameSite: "strict",
        path: "/",
      });
      window = new BrowserWindow({
        width: 1280,
        height: 860,
        minWidth: 800,
        minHeight: 600,
        title: "MOMO",
        show: false,
        backgroundColor: "#fdfcfe",
        autoHideMenuBar: true,
        icon: join(__dirname, "../build/client/brand/momo.ico"),
        webPreferences: {
          preload: join(__dirname, "preload.cjs"),
          session: browserSession,
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
        },
      });
      window.removeMenu();
      if (!app.isPackaged) {
        window.webContents.on("console-message", (details) => {
          if (details.level === "error")
            console.error("[renderer]", details.message);
        });
      }
      window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      window.webContents.on("will-navigate", (event, url) => {
        if (url !== trustedOrigin + "/") event.preventDefault();
      });
      window.webContents.on("will-attach-webview", (event) =>
        event.preventDefault(),
      );
      ipcMain.handle("momo:copy-text", (event, input: unknown) => {
        if (
          !window ||
          event.sender !== window.webContents ||
          event.senderFrame !== window.webContents.mainFrame ||
          new URL(event.senderFrame.url).origin !== trustedOrigin
        )
          throw new Error("Untrusted clipboard request");
        clipboard.writeText(copyTextSchema.parse(input));
      });
      await window.loadURL(trustedOrigin);
      window.show();
    })
    .catch((error: unknown) => {
      dialog.showErrorBox(
        "无法启动 MOMO",
        error instanceof Error ? error.message : "未知启动错误",
      );
      app.quit();
    });
}
