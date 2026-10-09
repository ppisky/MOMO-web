import React from 'react';
// Migrated from MOMO-web settings/general.tsx (GPL-3.0); host adapters replace Electron/storage.
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  Radio,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
  Select as AdaptiveSelect,
} from '@mantine/core';
import {
  getDefaultInterfaceColors,
  INTERFACE_COLOR_PRESETS,
  type InterfaceColorPreset,
  type InterfaceColors,
  type InterfaceThemeColors,
  isInterfaceBrandColorAllowed,
  resolveInterfaceBrandColor,
  resolveInterfaceBrandColors,
  withColorOpacity,
} from './theme-colors';
import { IconCheck, IconDeviceFloppy, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InterfaceColorInput } from './InterfaceColorInput';
import LazySlider from './LazySlider';
import { useSettingsStore, useUIStore, Theme, type Language } from './store';
import { PromptSettings } from './CoreSettings';
const languages = ['zh-Hans', 'zh-Hant', 'en', 'ja', 'ko'] as const;
const languageNameMap = {
  'zh-Hans': '简体中文',
  'zh-Hant': '繁體中文',
  en: 'English',
  ja: '日本語',
  ko: '한국어',
};
const presetBadgeButtonClassName = 'transition-transform duration-150 active:scale-[0.97]';
export function GeneralSettings() {
  const { t } = useTranslation();
  const { setSettings, ...settings } = useSettingsStore((state) => state);
  const realTheme = useUIStore((state) => state.realTheme);
  const storedInterfaceColors = (settings.interfaceColors ?? getDefaultInterfaceColors())[realTheme];
  const currentInterfaceColors = {
    ...storedInterfaceColors,
    brand: resolveInterfaceBrandColor(storedInterfaceColors.brand, realTheme),
  };
  const [isCreatingInterfaceColorPreset, setIsCreatingInterfaceColorPreset] = useState(false);
  const [isEditingInterfaceColorPresets, setIsEditingInterfaceColorPresets] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [presetLabel, setPresetLabel] = useState('');

  const updateCurrentInterfaceColors = (updater: (colors: InterfaceThemeColors) => InterfaceThemeColors) => {
    setSettings((draft) => {
      draft.interfaceColors ??= getDefaultInterfaceColors();
      draft.interfaceColors[realTheme] = updater(draft.interfaceColors[realTheme]);
    });
  };

  const setInterfaceColor = (key: keyof InterfaceThemeColors, value: string) => {
    updateCurrentInterfaceColors((colors) => ({ ...colors, [key]: value }));
  };

  const resetInterfaceColors = () => {
    updateCurrentInterfaceColors(() => getDefaultInterfaceColors()[realTheme]);
  };

  const applyInterfaceColorPreset = (colors: InterfaceColors) => {
    setSettings((draft) => {
      draft.interfaceColors = resolveInterfaceBrandColors(colors);
    });
  };

  const saveInterfaceColorPreset = () => {
    const label = presetLabel.trim();
    if (!label) return;

    setSettings((draft) => {
      const currentColors = resolveInterfaceBrandColors(draft.interfaceColors ?? getDefaultInterfaceColors());
      draft.interfaceColorPresets ??= [];
      draft.interfaceColorPresets.push({
        id: crypto.randomUUID(),
        label,
        colors: {
          light: { ...currentColors.light },
          dark: { ...currentColors.dark },
        },
      });
    });
    setIsCreatingInterfaceColorPreset(false);
    setPresetLabel('');
  };

  const deleteInterfaceColorPreset = (presetId: string) => {
    setSettings((draft) => {
      draft.interfaceColorPresets = (draft.interfaceColorPresets ?? []).filter(
        (preset) => preset.id !== presetId,
      );
    });
    if (editingPresetId === presetId) cancelEditingInterfaceColorPreset();
  };

  const startEditingInterfaceColorPreset = (preset: InterfaceColorPreset) => {
    applyInterfaceColorPreset(preset.colors);
    setIsCreatingInterfaceColorPreset(false);
    setEditingPresetId(preset.id);
    setPresetLabel(preset.label);
  };

  const cancelEditingInterfaceColorPreset = () => {
    setEditingPresetId(null);
    setPresetLabel('');
  };

  const saveEditedInterfaceColorPreset = () => {
    const label = presetLabel.trim();
    if (!editingPresetId || !label) return;

    setSettings((draft) => {
      const colors = resolveInterfaceBrandColors(draft.interfaceColors ?? getDefaultInterfaceColors());
      draft.interfaceColorPresets = (draft.interfaceColorPresets ?? []).map((preset) =>
        preset.id === editingPresetId
          ? {
              ...preset,
              label,
              colors: {
                light: { ...colors.light },
                dark: { ...colors.dark },
              },
            }
          : preset,
      );
    });
    cancelEditingInterfaceColorPreset();
  };

  const colorPresets = [
    ...INTERFACE_COLOR_PRESETS.map((preset) => ({
      ...preset,
      colors: resolveInterfaceBrandColors(preset.colors),
      isCustom: false,
    })),
    ...(settings.interfaceColorPresets ?? []).map((preset) => ({
      ...preset,
      colors: resolveInterfaceBrandColors(preset.colors),
      isCustom: true,
    })),
  ] satisfies Array<InterfaceColorPreset & { isCustom: boolean }>;

  return (
    <Stack p="md" gap="xl">
      <Title order={5}>{t('General Settings')}</Title>

      {/* Display Settings */}
      <Stack gap="lg" maw={720}>
        <Title order={5}>{t('Display Settings')}</Title>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <AdaptiveSelect
            comboboxProps={{ withinPortal: true }}
            value={settings.language}
            data={languages.map((language) => ({
              value: language,
              label: languageNameMap[language],
              // style: language === 'ar' ? { fontFamily: 'Cairo, Arial, sans-serif' } : {},
            }))}
            label={t('Language')}
            styles={{
              label: {
                fontWeight: 400,
              },
            }}
            onChange={(val) => {
              if (val) {
                setSettings({
                  language: val as Language,
                });
              }
            }}
          />
          <AdaptiveSelect
            comboboxProps={{ withinPortal: true, withArrow: true }}
            label={t('Theme')}
            styles={{
              label: {
                fontWeight: 400,
              },
            }}
            data={[
              { value: `${Theme.System}`, label: t('Follow System') },
              { value: `${Theme.Light}`, label: t('Light Mode') },
              { value: `${Theme.Dark}`, label: t('Dark Mode') },
            ]}
            value={`${settings.theme}`}
            onChange={(val) => {
              if (val) {
                setSettings({
                  theme: parseInt(val),
                });
              }
            }}
          />
        </SimpleGrid>

        <Stack gap="md">
          <Stack gap="xxs">
            <Flex align="center" gap={2}>
              <Text size="sm">{t('Color Presets')}</Text>
              <ActionIcon
                variant={isEditingInterfaceColorPresets ? 'light' : 'subtle'}
                size="sm"
                aria-label={isEditingInterfaceColorPresets ? t('Save') : t('Edit')}
                disabled={
                  isEditingInterfaceColorPresets &&
                  Boolean(editingPresetId || isCreatingInterfaceColorPreset) &&
                  !presetLabel.trim()
                }
                onClick={() => {
                  if (isEditingInterfaceColorPresets) {
                    if (editingPresetId) {
                      saveEditedInterfaceColorPreset();
                    } else if (isCreatingInterfaceColorPreset) {
                      saveInterfaceColorPreset();
                    } else {
                      cancelEditingInterfaceColorPreset();
                    }
                  } else {
                    setIsCreatingInterfaceColorPreset(false);
                  }
                  setIsEditingInterfaceColorPresets((value) => !value);
                }}
              >
                {isEditingInterfaceColorPresets ? <IconCheck size={14} /> : <IconPencil size={14} />}
              </ActionIcon>
            </Flex>
            <Flex
              columnGap="xs"
              rowGap={isEditingInterfaceColorPresets ? 12 : 'xs'}
              py={isEditingInterfaceColorPresets ? 5 : 0}
              wrap="wrap"
            >
              {colorPresets.map((preset) => (
                <Box key={preset.id} pos="relative">
                  <Badge
                    component="button"
                    type="button"
                    className={presetBadgeButtonClassName}
                    variant="filled"
                    style={{
                      backgroundColor: withColorOpacity(preset.colors[realTheme].brand, 0.6),
                      cursor: 'pointer',
                      height: 30,
                      maxWidth: 160,
                    }}
                    onClick={() => {
                      if (isEditingInterfaceColorPresets && preset.isCustom) {
                        startEditingInterfaceColorPreset(preset);
                      } else {
                        applyInterfaceColorPreset(preset.colors);
                      }
                    }}
                  >
                    {preset.isCustom ? preset.label : t(preset.label)}
                  </Badge>
                  {isEditingInterfaceColorPresets && preset.isCustom && (
                    <ActionIcon
                      pos="absolute"
                      top={-5}
                      right={-5}
                      variant="filled"
                      color="red"
                      size={16}
                      radius="xl"
                      aria-label={t('Delete')}
                      onClick={() => deleteInterfaceColorPreset(preset.id)}
                    >
                      <IconTrash size={10} />
                    </ActionIcon>
                  )}
                </Box>
              ))}
              {!isCreatingInterfaceColorPreset && (
                <Badge
                  component="button"
                  type="button"
                  className={presetBadgeButtonClassName}
                  circle
                  variant="outline"
                  aria-label={t('New Preset')}
                  style={{ cursor: 'pointer', height: 30, width: 30 }}
                  styles={{ label: { display: 'flex', width: '100%', justifyContent: 'center' } }}
                  onClick={() => {
                    cancelEditingInterfaceColorPreset();
                    setPresetLabel(`Custom Preset ${(settings.interfaceColorPresets?.length ?? 0) + 1}`);
                    setIsCreatingInterfaceColorPreset(true);
                  }}
                >
                  <IconPlus size={14} />
                </Badge>
              )}
            </Flex>
          </Stack>
          {(isCreatingInterfaceColorPreset || editingPresetId) && (
            <Stack gap="md">
              <TextInput
                autoFocus
                label={t('Name')}
                value={presetLabel}
                onChange={(event) => setPresetLabel(event.currentTarget.value)}
              />
              <SimpleGrid cols={2} spacing="md">
                <Stack gap="md">
                  <InterfaceColorInput
                    label={t('Primary Background')}
                    value={currentInterfaceColors.backgroundPrimary}
                    onCommit={(value) => setInterfaceColor('backgroundPrimary', value)}
                  />
                  <InterfaceColorInput
                    label={t('Secondary Background')}
                    value={currentInterfaceColors.backgroundSecondary}
                    onCommit={(value) => setInterfaceColor('backgroundSecondary', value)}
                  />
                </Stack>
                <Stack gap="md">
                  <InterfaceColorInput
                    label={t('Tertiary Background')}
                    value={currentInterfaceColors.backgroundTertiary}
                    onCommit={(value) => setInterfaceColor('backgroundTertiary', value)}
                  />
                  <InterfaceColorInput
                    label={t('Brand Color')}
                    value={currentInterfaceColors.brand}
                    isColorAllowed={isInterfaceBrandColorAllowed}
                    onCommit={(value) => setInterfaceColor('brand', value)}
                  />
                </Stack>
              </SimpleGrid>
              <SimpleGrid cols={2} spacing="md">
                <Button variant="outline" onClick={resetInterfaceColors}>
                  {t('Reset Colors')}
                </Button>
                <Button
                  leftSection={<IconDeviceFloppy size={14} />}
                  disabled={!presetLabel.trim()}
                  onClick={editingPresetId ? saveEditedInterfaceColorPreset : saveInterfaceColorPreset}
                >
                  {editingPresetId ? t('Save') : t('Save Preset')}
                </Button>
              </SimpleGrid>
            </Stack>
          )}
        </Stack>

        {/* Font Size */}
        <Stack>
          <Text>{t('Font Size')}</Text>
          <LazySlider
            step={1}
            min={10}
            max={22}
            maw={720}
            marks={[
              {
                value: 14,
              },
            ]}
            value={settings.fontSize}
            onChange={(val) =>
              setSettings({
                fontSize: val,
              })
            }
          />
        </Stack>

        {/* Startup Page */}
        <Stack>
          <Text>{t('Startup Page')}</Text>
          <Radio.Group
            value={settings.startupPage}
            defaultValue="home"
            onChange={(val) => {
              if (val === 'home' || val === 'session') setSettings({ startupPage: val });
            }}
          >
            <Flex gap="md">
              <Radio label={t('Home Page')} value="home" />
              <Radio label={t('Last Session')} value="session" />
            </Flex>
          </Radio.Group>
        </Stack>
      </Stack>

      <Divider />

      <PromptSettings />
    </Stack>
  );
}
