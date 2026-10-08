/** Only expose capabilities needed by the interface. Electron/Tauri can implement this later. */
export interface HostAdapter {
  readonly kind: "browser" | "desktop";
  copyText(text: string): Promise<void>;
}
