import React from 'react';
// MOMO-web InputBox.tsx layout and controls (GPL-3.0), with the Core submit adapter.
import { ActionIcon, Box, Flex, Stack, Text, Tooltip, UnstyledButton } from '@mantine/core';
import { useViewportSize } from '@mantine/hooks';
import {
  IconAdjustmentsHorizontal,
  IconArrowUp,
  IconChevronDown,
  IconPlayerStopFilled,
} from '@tabler/icons-react';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { INPUT_SURFACE_CLASS_NAME, INPUT_SURFACE_STYLE } from './inputSurface';
import { MessageInputField, type MessageInputFieldRef } from './MessageInputField';
import { useProduct } from './context';
import { addToast } from './media';
import { useSettingsStore } from './store';
import { ModelPicker } from './ModelPicker';
export default function InputBox({
  onSubmit,
  onSettings,
  onStop,
  running = false,
  disabled = false,
}: {
  onSubmit: (input: string) => Promise<void>;
  onSettings: () => void;
  onStop?: () => void;
  running?: boolean;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const field = useRef<MessageInputFieldRef>(null);
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [hasText, setHasText] = useState(false);
  const { height } = useViewportSize();
  const { openSettings } = useProduct();
  const spellCheck = useSettingsStore((s) => s.spellCheck);
  const onValueChange = useCallback((value: string) => setHasText(Boolean(value.trim())), []);
  const send = async () => {
    const text = field.current?.getValue().trim();
    if (!text || submitting.current || running || disabled) return;
    submitting.current = true;
    setBusy(true);
    try {
      await onSubmit(text);
      field.current?.clearDraft();
    } catch (error) {
      addToast(error instanceof Error ? error.message : '消息发送失败');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  return (
    <Box px="md" pb="sm" className="shrink-0" spellCheck={spellCheck}>
      <Stack gap="xs" className="max-w-4xl mx-auto">
        <Box className={`${INPUT_SURFACE_CLASS_NAME} min-h-[100px]`} style={INPUT_SURFACE_STYLE}>
          <Flex align="flex-end" gap="sm">
            <MessageInputField
              ref={field}
              isNewSession={false}
              viewportHeight={height}
              isReadOnly={disabled}
              placeholder={t('Enter a message…')}
              ariaLabel={t('Message input')}
              autoFocus
              onValueChange={onValueChange}
              onPaste={() => {}}
              onKeyDown={(event) => {
                if (
                  event.key === 'Enter' &&
                  !event.shiftKey &&
                  !event.ctrlKey &&
                  !event.metaKey &&
                  !event.altKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  void send();
                }
              }}
            />
            {running ? (
              <Tooltip label={t('Stop reply')}>
                <ActionIcon
                  aria-label={t('Stop reply')}
                  radius="lg"
                  size={32}
                  variant="light"
                  onClick={onStop}
                >
                  <IconPlayerStopFilled size={16} />
                </ActionIcon>
              </Tooltip>
            ) : (
              <Tooltip label={t('Send')}>
                <ActionIcon
                  id="momo-send"
                  aria-label={t('Send')}
                  radius="lg"
                  size={32}
                  disabled={!hasText || busy || disabled}
                  onClick={() => void send()}
                >
                  <IconArrowUp size={18} />
                </ActionIcon>
              </Tooltip>
            )}
          </Flex>
          <Flex align="center" justify="space-between" gap="sm">
            <Flex gap="xs">
              <Tooltip label={t('Conversation settings')}>
                <ActionIcon
                  aria-label={t('Conversation settings')}
                  variant="subtle"
                  color="chatbox-secondary"
                  onClick={onSettings}
                >
                  <IconAdjustmentsHorizontal size={18} />
                </ActionIcon>
              </Tooltip>
            </Flex>
            <ModelPicker />
          </Flex>
        </Box>
        <Text size="xs" c="chatbox-tertiary" ta="center">
          Enter {t('Send')} · Shift + Enter 换行
        </Text>
      </Stack>
    </Box>
  );
}
