import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { MantineProvider, useComputedColorScheme } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { createWebTheme } from './theme';
import {
  getDefaultInterfaceColors,
  resolveInterfaceBrandColor,
  type InterfaceColors,
  type InterfaceColorPreset,
} from './theme-colors';
import i18n from './i18n';
import { addToast } from './media';

export enum Theme {
  System = 0,
  Light = 1,
  Dark = 2,
}
export type Language = 'zh-Hans' | 'zh-Hant' | 'en' | 'ja' | 'ko';
export type Preferences = {
  language: Language;
  theme: Theme;
  fontSize: number;
  startupPage: 'home' | 'session';
  interfaceColors: InterfaceColors;
  interfaceColorPresets: InterfaceColorPreset[];
  userAvatarKey?: string | undefined;
  defaultAssistantAvatarKey?: string | undefined;
  backgroundImageKey?: string | undefined;
  backgroundImageOpacity: number;
  messageLayout: 'left' | 'bubble';
  showAvatar: boolean;
  hideSystemPromptMessage: boolean;
  autoScrollNewMessagesToTop: boolean;
  showWordCount: boolean;
  showTokenUsed: boolean;
  showModelName: boolean;
  showMessageTimestamp: boolean;
  showFirstTokenLatency: boolean;
  autoGenerateTitle: boolean;
  spellCheck: boolean;
  enableMarkdownRendering: boolean;
  stream: boolean;
};
const defaults: Preferences = {
  language: 'zh-Hans',
  theme: Theme.System,
  fontSize: 14,
  startupPage: 'home',
  interfaceColors: getDefaultInterfaceColors(),
  interfaceColorPresets: [],
  backgroundImageOpacity: 0.16,
  messageLayout: 'bubble',
  showAvatar: true,
  hideSystemPromptMessage: true,
  autoScrollNewMessagesToTop: false,
  showWordCount: false,
  showTokenUsed: false,
  showModelName: false,
  showMessageTimestamp: false,
  showFirstTokenLatency: false,
  autoGenerateTitle: true,
  spellCheck: true,
  enableMarkdownRendering: true,
  stream: true,
};
type Settings = Preferences & {
  setSettings: (patch: Partial<Preferences> | ((draft: Preferences) => void)) => void;
};
const SettingsContext = createContext<Settings | null>(null);
type UI = {
  showSidebar: boolean;
  setShowSidebar: (value: boolean) => void;
  sidebarWidth: number;
  setSidebarWidth: (value: number) => void;
  realTheme: 'light' | 'dark';
};
const UIContext = createContext<UI | null>(null);
export function useSettingsStore<T>(selector: (value: Settings) => T): T {
  const value = useContext(SettingsContext);
  if (!value) throw Error('Missing preferences');
  return selector(value);
}
export function useUIStore<T>(selector: (value: UI) => T): T {
  const value = useContext(UIContext);
  if (!value) throw Error('Missing UI state');
  return selector(value);
}
export function useIsSmallScreen() {
  return useMediaQuery('(max-width: 639.95px)') ?? false;
}

function readPreferences(): Preferences {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem('momo-app.ui.v1') ?? '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return defaults;
    const output = structuredClone(defaults);
    const fields = parsed as Record<string, unknown>;
    for (const key of Object.keys(defaults) as (keyof Preferences)[]) {
      const value = fields[key];
      if (typeof value === 'boolean' && typeof defaults[key] === 'boolean')
        Object.assign(output, { [key]: value });
    }
    if (['zh-Hans', 'zh-Hant', 'en', 'ja', 'ko'].includes(String(fields.language)))
      output.language = fields.language as Language;
    if ([0, 1, 2].includes(Number(fields.theme))) output.theme = Number(fields.theme);
    if (typeof fields.fontSize === 'number' && fields.fontSize >= 10 && fields.fontSize <= 22)
      output.fontSize = fields.fontSize;
    if (fields.startupPage === 'session') output.startupPage = 'session';
    if (fields.messageLayout === 'left') output.messageLayout = 'left';
    if (
      typeof fields.backgroundImageOpacity === 'number' &&
      fields.backgroundImageOpacity >= 0 &&
      fields.backgroundImageOpacity <= 1
    )
      output.backgroundImageOpacity = fields.backgroundImageOpacity;
    for (const key of ['userAvatarKey', 'defaultAssistantAvatarKey', 'backgroundImageKey'] as const)
      if (typeof fields[key] === 'string' && fields[key].length < 200) output[key] = fields[key];
    const colors = (value: unknown): value is InterfaceColors =>
      !!value &&
      typeof value === 'object' &&
      ['light', 'dark'].every((mode) => {
        const palette = (value as Record<string, unknown>)[mode];
        return (
          !!palette &&
          typeof palette === 'object' &&
          ['backgroundPrimary', 'backgroundSecondary', 'backgroundTertiary', 'brand'].every((key) =>
            /^#[\da-f]{6}$/i.test(String((palette as Record<string, unknown>)[key])),
          )
        );
      });
    if (colors(fields.interfaceColors)) output.interfaceColors = fields.interfaceColors;
    if (Array.isArray(fields.interfaceColorPresets))
      output.interfaceColorPresets = fields.interfaceColorPresets
        .filter(
          (p: unknown): p is InterfaceColorPreset =>
            !!p &&
            typeof p === 'object' &&
            'id' in p &&
            typeof p.id === 'string' &&
            'label' in p &&
            typeof p.label === 'string' &&
            'colors' in p &&
            colors(p.colors),
        )
        .slice(0, 100);
    return output;
  } catch {
    return defaults;
  }
}
const mantine = createWebTheme();
export function WebProviders({ children }: { children: React.ReactNode }) {
  const [settings, set] = useState(readPreferences);
  const setSettings = useCallback(
    (patch: Partial<Preferences> | ((draft: Preferences) => void)) =>
      set((previous) => {
        const next = structuredClone(previous);
        if (typeof patch === 'function') patch(next);
        else Object.assign(next, patch);
        try {
          localStorage.setItem('momo-app.ui.v1', JSON.stringify(next));
        } catch {
          addToast('界面偏好保存失败，请检查可用存储空间。');
        }
        return next;
      }),
    [],
  );
  return (
    <SettingsContext.Provider value={{ ...settings, setSettings }}>
      <MantineProvider
        theme={mantine}
        defaultColorScheme="auto"
        {...(settings.theme === Theme.System
          ? {}
          : { forceColorScheme: settings.theme === Theme.Dark ? 'dark' : 'light' })}
      >
        <ThemeBridge>{children}</ThemeBridge>
      </MantineProvider>
    </SettingsContext.Provider>
  );
}
function ThemeBridge({ children }: { children: React.ReactNode }) {
  const settings = useSettingsStore((s) => s);
  const realTheme = useComputedColorScheme('light');
  const [showSidebar, setShowSidebar] = useState(() => window.innerWidth >= 640);
  const small = useIsSmallScreen();
  useEffect(() => {
    if (small) setShowSidebar(false);
  }, [small]);
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    window.innerWidth >= 1536 ? 280 : window.innerWidth >= 1200 ? 240 : window.innerWidth >= 900 ? 220 : 200,
  );
  const palette = settings.interfaceColors[realTheme];
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = realTheme;
    root.classList.toggle('dark', realTheme === 'dark');
    root.style.setProperty('--chatbox-background-primary', palette.backgroundPrimary);
    root.style.setProperty('--chatbox-background-secondary', palette.backgroundSecondary);
    root.style.setProperty('--chatbox-background-tertiary', palette.backgroundTertiary);
    root.style.setProperty('--chatbox-brand', resolveInterfaceBrandColor(palette.brand, realTheme));
    root.style.setProperty('--chatbox-msg-font-size', `${settings.fontSize}px`);
    root.lang = settings.language;
    void i18n.changeLanguage(settings.language);
  }, [realTheme, palette, settings.fontSize, settings.language]);
  const mui = createTheme({
    palette: {
      mode: realTheme,
      primary: { main: palette.brand },
      background: { default: palette.backgroundPrimary, paper: palette.backgroundPrimary },
    },
    typography: { fontSize: 14 },
    breakpoints: { values: { xs: 0, sm: 640, md: 900, lg: 1200, xl: 1536 } },
  });
  return (
    <UIContext.Provider value={{ realTheme, showSidebar, setShowSidebar, sidebarWidth, setSidebarWidth }}>
      <ThemeProvider theme={mui}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </UIContext.Provider>
  );
}

// Drafts are temporary UI state; messages are only persisted by Core.
const DraftContext = createContext('new');
const drafts = new Map<string, string>();
export const DraftProvider = DraftContext.Provider;
export function useMessageInput(_initial: string, _options: { isNewSession: boolean }) {
  const key = useContext(DraftContext);
  const [messageInput, setValue] = useState(() => drafts.get(key) ?? '');
  const setMessageInput = useCallback(
    (value: string | ((previous: string) => string)) =>
      setValue((previous) => {
        const next = typeof value === 'function' ? value(previous) : value;
        drafts.set(key, next);
        return next;
      }),
    [key],
  );
  const clearDraft = useCallback(() => setMessageInput(''), [setMessageInput]);
  return { messageInput, setMessageInput, clearDraft };
}
