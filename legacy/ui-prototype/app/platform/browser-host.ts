import type { HostAdapter } from "../../shared/contracts/host";
export const browserHost: HostAdapter = {
  kind: "browser",
  copyText: (text) => navigator.clipboard.writeText(text),
};
