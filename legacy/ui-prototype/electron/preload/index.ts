import { contextBridge, ipcRenderer } from "electron";
import type { DesktopBridge } from "../../shared/contracts/desktop";

const bridge: DesktopBridge = {
  copyText: async (text) => {
    if (typeof text !== "string" || text.length > 100_000)
      throw new Error("Invalid clipboard text");
    await ipcRenderer.invoke("momo:copy-text", text);
  },
};
contextBridge.exposeInMainWorld("momoDesktop", Object.freeze(bridge));
