import type { HostAdapter } from "../../shared/contracts/host";
import "../../shared/contracts/desktop";

export const desktopHost: HostAdapter = {
  kind: "desktop",
  async copyText(text) {
    if (!window.momoDesktop) throw new Error("Desktop bridge unavailable");
    await window.momoDesktop.copyText(text);
  },
};
