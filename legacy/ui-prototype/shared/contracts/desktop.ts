import { z } from "zod";

export const copyTextSchema = z.string().max(100_000);
export const serviceStartSchema = z
  .object({ token: z.string().regex(/^[a-f0-9]{64}$/) })
  .strict();
export const serviceReadySchema = z
  .object({
    type: z.literal("ready"),
    port: z.number().int().min(1).max(65535),
  })
  .strict();

export interface DesktopBridge {
  copyText(text: string): Promise<void>;
}

declare global {
  interface Window {
    momoDesktop?: DesktopBridge;
  }
}
