import React from 'react';
// Migrated from MOMO-web settings/chat.tsx (GPL-3.0).
import {
  Box,
  Button,
  FileButton,
  Flex,
  Slider,
  Stack,
  Switch,
  Text,
  Textarea,
  Title,
  Tooltip,
} from '@mantine/core';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Divider } from './Divider';
import { MessageLayoutSelector } from './MessageLayoutPreview';
import SliderWithInput from './SliderWithInput';
import {
  AssistantAvatar,
  UserAvatar,
  handleImageInputAndSave,
  ImageInStorage,
  addToast,
  TooltipInfoTrigger,
} from './media';
import { useSettingsStore } from './store';
import { RuntimeSettings } from './CoreSettings';
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const StorageKeyGenerator = { picture: (name: string) => name + ':' + crypto.randomUUID() };
const storage = { setBlob: async (_key: string, _blob: Blob) => {} };
export function ChatSettings() {
  const { t } = useTranslation();
  const { setSettings, ...settings } = useSettingsStore((state) => state);

  return (
    <Stack gap="xxl" p="md">
      <Title order={5}>{t('Chat Settings')}</Title>

      {/* Avatars */}
      <Stack gap="md">
        <Stack gap="xxs">
          <Text fw="600">{t('Edit Avatars')}</Text>
          <Text size="xs" c="chatbox-tertiary">
            {t('Support jpg or png file smaller than 5MB')}
          </Text>
        </Stack>

        {/* User Avatar' */}
        <Stack>
          <Text size="xs" c="chatbox-secondary">
            {t('User Avatar')}
          </Text>
          <Flex align="center" gap="xs">
            <UserAvatar size={56} avatarKey={settings.userAvatarKey} />
            <FileButton
              onChange={(file) => {
                if (file) {
                  if (file.size > MAX_IMAGE_SIZE) {
                    addToast(t('Support jpg or png file smaller than 5MB'));
                    return;
                  }
                  const key = StorageKeyGenerator.picture('user-avatar');
                  handleImageInputAndSave(
                    file,
                    key,
                    () => setSettings({ userAvatarKey: key }),
                    (k, v) => storage.setBlob(k, v),
                  );
                }
              }}
              accept="image/png,image/jpeg"
            >
              {(props) => (
                <Button {...props} variant="outline" size="xs">
                  {t('Upload Image')}
                </Button>
              )}
            </FileButton>
            {!!settings.userAvatarKey && (
              <Button
                color="chatbox-gray"
                size="xs"
                onClick={() => setSettings({ userAvatarKey: undefined })}
              >
                {t('Delete')}
              </Button>
            )}
          </Flex>
        </Stack>

        {/* Default Assistant Avatar */}
        <Stack>
          <Text size="xs" c="chatbox-secondary">
            {t('Default Assistant Avatar')}
          </Text>
          <Flex align="center" gap="xs">
            <AssistantAvatar avatarKey={settings.defaultAssistantAvatarKey} size={56} />
            <FileButton
              onChange={(file) => {
                if (file) {
                  if (file.size > MAX_IMAGE_SIZE) {
                    addToast(t('Support jpg or png file smaller than 5MB'));
                    return;
                  }
                  const key = StorageKeyGenerator.picture('default-assistant-avatar');
                  handleImageInputAndSave(
                    file,
                    key,
                    () => setSettings({ defaultAssistantAvatarKey: key }),
                    (k, v) => storage.setBlob(k, v),
                  );
                }
              }}
              accept="image/png,image/jpeg"
            >
              {(props) => (
                <Button {...props} variant="outline" size="xs">
                  {t('Upload Image')}
                </Button>
              )}
            </FileButton>
            {!!settings.defaultAssistantAvatarKey && (
              <Button
                color="chatbox-gray"
                size="xs"
                onClick={() => setSettings({ defaultAssistantAvatarKey: undefined })}
              >
                {t('Delete')}
              </Button>
            )}
          </Flex>
        </Stack>
      </Stack>

      <Divider />

      {/* Default Settings */}
      <Stack gap="md">
        <Text fw="600">{t('Default Settings for New Conversation')}</Text>
        {/* Background Image */}
        <Stack gap="xs">
          <Text>{t('Background Image')}</Text>
          <Flex align="center" gap="sm" wrap="wrap">
            {settings.backgroundImageKey ? (
              <Box w={160} h={90} className="overflow-hidden rounded bg-chatbox-tertiary/20 flex-shrink-0">
                <ImageInStorage
                  storageKey={settings.backgroundImageKey}
                  className="object-cover w-full h-full"
                />
              </Box>
            ) : null}
            <Flex gap="xs" align="center">
              <FileButton
                onChange={(file) => {
                  if (file) {
                    if (file.size > MAX_IMAGE_SIZE) {
                      addToast(t('Support jpg or png file smaller than 5MB'));
                      return;
                    }
                    const key = StorageKeyGenerator.picture('background-image');
                    handleImageInputAndSave(
                      file,
                      key,
                      () => setSettings({ backgroundImageKey: key }),
                      (k, v) => storage.setBlob(k, v),
                    );
                  }
                }}
                accept="image/png,image/jpeg"
              >
                {(props) => (
                  <Button {...props} variant="outline" size="xs">
                    {t('Upload Image')}
                  </Button>
                )}
              </FileButton>
              {!!settings.backgroundImageKey && (
                <Button
                  color="chatbox-gray"
                  size="xs"
                  onClick={() => setSettings({ backgroundImageKey: undefined })}
                >
                  {t('Remove')}
                </Button>
              )}
            </Flex>
          </Flex>
          {!!settings.backgroundImageKey && (
            <Stack gap="xxs">
              <Text size="sm">{t('Background Image Opacity')}</Text>
              <SliderWithInput
                value={Math.round(settings.backgroundImageOpacity * 100)}
                onChange={(value) => setSettings({ backgroundImageOpacity: (value ?? 16) / 100 })}
                max={100}
                step={1}
                suffix="%"
              />
            </Stack>
          )}
        </Stack>

        {/* Stream output */}
        <Stack gap="xxs">
          <Flex align="center" gap="xs" justify="space-between">
            <Text size="sm">{t('Stream output')}</Text>
            <Switch
              // label={t('Stream output')}
              checked={settings?.stream ?? true}
              onChange={(v) => setSettings({ stream: v.target.checked })}
            />
          </Flex>
        </Stack>
      </Stack>
      <Divider />

      {/* Conversation Settings */}
      <Stack gap="md">
        <Text fw="600">{t('Conversation Settings')}</Text>

        {/* Display */}
        <Stack gap="sm">
          <Text c="chatbox-tertiary">{t('Display')}</Text>

          <MessageLayoutSelector
            value={settings.messageLayout ?? 'bubble'}
            onValueChange={(val) => setSettings({ messageLayout: val })}
          />

          <Switch
            label={t('Show Avatar')}
            checked={settings.showAvatar ?? true}
            onChange={() =>
              setSettings((draft) => {
                draft.showAvatar = !(draft.showAvatar ?? true);
              })
            }
          />

          <Switch
            label={t('Hide system prompt')}
            checked={settings.hideSystemPromptMessage}
            onChange={() =>
              setSettings({
                hideSystemPromptMessage: !settings.hideSystemPromptMessage,
              })
            }
          />

          <Switch
            label={t('Auto-scroll new messages to top')}
            checked={settings.autoScrollNewMessagesToTop}
            onChange={() =>
              setSettings({
                autoScrollNewMessagesToTop: !settings.autoScrollNewMessagesToTop,
              })
            }
          />

          <Switch
            label={t('show message word count')}
            checked={settings.showWordCount}
            onChange={() =>
              setSettings((draft) => {
                draft.showWordCount = !draft.showWordCount;
              })
            }
          />

          {/* <Switch
            label={t('show message token count')}
            checked={settings.showTokenCount}
            onChange={() =>
              setSettings({
                showTokenCount: !settings.showTokenCount,
              })
            }
          /> */}

          <Switch
            label={t('show message token usage')}
            checked={settings.showTokenUsed}
            onChange={() =>
              setSettings({
                showTokenUsed: !settings.showTokenUsed,
              })
            }
          />

          <Switch
            label={t('show model name')}
            checked={settings.showModelName}
            onChange={() =>
              setSettings({
                showModelName: !settings.showModelName,
              })
            }
          />

          <Switch
            label={t('show message timestamp')}
            checked={settings.showMessageTimestamp}
            onChange={() =>
              setSettings({
                showMessageTimestamp: !settings.showMessageTimestamp,
              })
            }
          />

          <Switch
            label={t('show first token latency')}
            checked={settings.showFirstTokenLatency}
            onChange={() =>
              setSettings({
                showFirstTokenLatency: !settings.showFirstTokenLatency,
              })
            }
          />
        </Stack>

        {/* Function */}
        <Stack gap="sm">
          <Text c="chatbox-tertiary">{t('Function')}</Text>

          <Switch
            label={t('Auto-Generate Chat Titles')}
            checked={settings.autoGenerateTitle}
            onChange={() =>
              setSettings({
                ...settings,
                autoGenerateTitle: !settings.autoGenerateTitle,
              })
            }
          />
          <Switch
            label={t('Spell Check')}
            checked={settings.spellCheck}
            onChange={() =>
              setSettings({
                ...settings,
                spellCheck: !settings.spellCheck,
              })
            }
          />
          <Switch
            label={t('Markdown Rendering')}
            checked={settings.enableMarkdownRendering}
            onChange={() =>
              setSettings({
                ...settings,
                enableMarkdownRendering: !settings.enableMarkdownRendering,
              })
            }
          />
        </Stack>
      </Stack>

      <Divider />

      {/* Context Management */}
      <RuntimeSettings section="history" />
    </Stack>
  );
}
