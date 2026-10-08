import { getSubmitAvailability } from '@chatbox/core/session/action-gates'
import { ActionIcon, Box, Flex, Stack, Text, UnstyledButton } from '@mantine/core'
import { useViewportSize } from '@mantine/hooks'
import { TestId } from '@shared/automation/testids'
import { createMessage, type Message, type SessionSettings, type SessionType } from '@shared/types'
import {
  IconAdjustmentsHorizontal,
  IconArrowUp,
  IconChevronDown,
  IconFilePencil,
  IconPlayerStopFilled,
} from '@tabler/icons-react'
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { rendererApplication } from '@/app/renderer-application'
import { CompactionStatus } from '@/components/chat/CompactionStatus'
import { AppTooltip as Tooltip } from '@/components/ui/tooltip'
import { useProviders } from '@/hooks/useProviders'
import { useSessionLockState } from '@/hooks/useSessionLockState'
import { navigateToSettings } from '@/modals/settings-navigation'
import { useSettingsStore } from '@/stores/settingsStore'
import { add as addToast } from '@/stores/toastActions'
import { useUIStore } from '@/stores/uiStore'
import ModelSelectorV2 from '../ModelSelectorV2'
import { INPUT_SURFACE_CLASS_NAME, INPUT_SURFACE_STYLE } from './inputSurface'
import { MessageInputField, type MessageInputFieldRef } from './MessageInputField'

export type InputBoxPayload = {
  constructedMessage: Message
  needGenerating?: boolean
  onUserMessageReady?: () => void
  settingsPatch?: Partial<SessionSettings>
}
export type InputBoxRef = { setQuote(quote: string): void }
export type InputBoxProps = {
  sessionId?: string
  sessionType?: SessionType
  draftCopilotId?: string
  draftCopilotName?: string
  model?: { provider: string; modelId: string }
  fullWidth?: boolean
  onSelectModel?(provider: string, model: string): void
  onSubmit?(payload: InputBoxPayload): Promise<void>
  onStopGenerating?(): boolean
  stopGenerationStatus?: 'idle' | 'stopping' | 'failed'
  onStartNewThread?(): Promise<(() => Promise<boolean>) | undefined>
  onClickSessionSettings?(): boolean | Promise<boolean>
  onViewCompactionSummary?(summaryMessageId: string): void
}

const InputBox = forwardRef<InputBoxRef, InputBoxProps>(
  (
    {
      sessionId = 'new',
      model,
      fullWidth,
      onSelectModel,
      onSubmit,
      onStopGenerating,
      stopGenerationStatus = 'idle',
      onStartNewThread,
      onClickSessionSettings,
      onViewCompactionSummary,
    },
    ref
  ) => {
    const { t } = useTranslation()
    const field = useRef<MessageInputFieldRef>(null)
    const submitting = useRef(false)
    const [busy, setBusy] = useState(false)
    const [hasText, setHasText] = useState(false)
    const [threadBusy, setThreadBusy] = useState(false)
    const widthFull = useUIStore((state) => state.widthFull) || fullWidth
    const { height } = useViewportSize()
    const { session } = rendererApplication.sessionHooks.useSession(sessionId === 'new' ? null : sessionId)
    const lock = useSessionLockState(session)
    const availability = getSubmitAvailability(lock)
    const shortcuts = useSettingsStore((state) => state.shortcuts)
    const { providers } = useProviders()
    const provider = providers.find((item) => item.id === model?.provider)
    const selectedModel = provider?.models?.find((item) => item.modelId === model?.modelId)
    const modelName = selectedModel?.nickname || selectedModel?.modelId || t('Select model')

    useImperativeHandle(
      ref,
      () => ({
        setQuote(quote) {
          field.current?.setValue((value) => `${value}\n\n${quote}`)
          field.current?.getElement()?.focus()
        },
      }),
      []
    )
    const onValueChange = useCallback((value: string) => setHasText(Boolean(value.trim())), [])
    const send = async (needGenerating = true) => {
      const text = field.current?.getValue().trim()
      if (
        !text ||
        submitting.current ||
        availability.blockReason ||
        lock.anyReplyGenerating ||
        stopGenerationStatus !== 'idle'
      )
        return
      if (needGenerating && !selectedModel) {
        navigateToSettings('/provider')
        return
      }
      submitting.current = true
      setBusy(true)
      try {
        await onSubmit?.({
          constructedMessage: createMessage('user', text),
          needGenerating,
          onUserMessageReady: () => field.current?.clearDraft(),
        })
      } catch (error) {
        addToast(error instanceof Error ? error.message : t('Could not save the message. Please try again.'))
      } finally {
        submitting.current = false
        setBusy(false)
      }
    }
    const matchesSend = (event: React.KeyboardEvent<HTMLTextAreaElement>, shortcut: string) => {
      if (event.key !== 'Enter') return false
      if (shortcut === 'Enter') return !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey
      if (shortcut === 'Ctrl+Enter') return (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey
      if (shortcut === 'Shift+Enter') return event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey
      return false
    }
    return (
      <Box px="md" pb="sm" className="shrink-0">
        <Stack gap="xs" className={widthFull ? 'w-full' : 'max-w-4xl mx-auto'}>
          {sessionId !== 'new' && <CompactionStatus sessionId={sessionId} onViewSummary={onViewCompactionSummary} />}
          <Box className={`${INPUT_SURFACE_CLASS_NAME} min-h-[100px]`} style={INPUT_SURFACE_STYLE}>
            <Flex align="flex-end" gap="sm">
              <MessageInputField
                ref={field}
                isNewSession={sessionId === 'new'}
                viewportHeight={height}
                isReadOnly={false}
                placeholder={t('Write dialogue, or describe your response with *actions*…')}
                ariaLabel={t('Message input')}
                autoFocus
                onValueChange={onValueChange}
                onPaste={() => {}}
                onKeyDown={(event) => {
                  if (event.nativeEvent.isComposing) return
                  if (matchesSend(event, shortcuts.inputBoxSendMessageWithoutResponse)) {
                    event.preventDefault()
                    void send(false)
                  } else if (matchesSend(event, shortcuts.inputBoxSendMessage)) {
                    event.preventDefault()
                    void send()
                  }
                }}
              />
              {lock.anyReplyGenerating ? (
                <Tooltip label={t('Stop reply')}>
                  <ActionIcon
                    aria-label={t('Stop reply')}
                    data-testid={TestId.chat.stop}
                    radius="lg"
                    size={32}
                    variant="light"
                    disabled={stopGenerationStatus === 'stopping'}
                    onClick={() => onStopGenerating?.()}
                  >
                    <IconPlayerStopFilled size={16} />
                  </ActionIcon>
                </Tooltip>
              ) : (
                <Tooltip label={selectedModel ? t('Send') : t('Select a model first')}>
                  <ActionIcon
                    aria-label={t('Send')}
                    data-testid={TestId.chat.send}
                    radius="lg"
                    size={32}
                    disabled={!hasText || busy || Boolean(availability.blockReason)}
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
                    data-testid={TestId.chat.sessionSettings}
                    variant="subtle"
                    color="chatbox-secondary"
                    onClick={onClickSessionSettings}
                    disabled={!onClickSessionSettings}
                  >
                    <IconAdjustmentsHorizontal size={18} />
                  </ActionIcon>
                </Tooltip>
                {onStartNewThread && (
                  <Tooltip label={t('Start a new chapter')}>
                    <ActionIcon
                      aria-label={t('Start a new chapter')}
                      data-testid={TestId.chat.newThread}
                      variant="subtle"
                      color="chatbox-secondary"
                      disabled={threadBusy || lock.anyReplyGenerating}
                      onClick={async () => {
                        setThreadBusy(true)
                        try {
                          await onStartNewThread()
                        } catch {
                          addToast(t('Could not create a new chapter.'))
                        } finally {
                          setThreadBusy(false)
                        }
                      }}
                    >
                      <IconFilePencil size={18} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Flex>
              <ModelSelectorV2
                selectedProviderId={model?.provider}
                selectedModelId={model?.modelId}
                onSelect={onSelectModel}
                position="top-end"
                width={320}
              >
                <UnstyledButton
                  data-testid={TestId.model.selectorTrigger}
                  aria-label={t('Select model')}
                  className="flex items-center gap-1 min-w-0 rounded-lg px-2 py-1 hover:bg-chatbox-background-tertiary"
                >
                  <Text size="sm" c="chatbox-secondary" truncate maw={200}>
                    {modelName}
                  </Text>
                  <IconChevronDown size={14} />
                </UnstyledButton>
              </ModelSelectorV2>
            </Flex>
          </Box>
          <Text size="xs" c="chatbox-tertiary" ta="center">
            {shortcuts.inputBoxSendMessage} {t('Send')} · {shortcuts.inputBoxSendMessageWithoutResponse}{' '}
            {t('Save only')}
          </Text>
        </Stack>
      </Box>
    )
  }
)
export default InputBox
