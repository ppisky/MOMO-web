import NiceModal from '@ebay/nice-modal-react'
import { Box, Button, Flex, Stack, Text } from '@mantine/core'
import { ROLEPLAY_AGENT_MODE } from '@shared/momo-policy'
import { createMessage, type Session } from '@shared/types'
import { createFileRoute, Link } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { rendererApplication } from '@/app/renderer-application'
import InputBox, { type InputBoxPayload } from '@/components/InputBox/InputBox'
import HomepageIcon from '@/components/icons/HomepageIcon'
import Page from '@/components/layout/Page'
import { useMyCopilots } from '@/hooks/useCopilots'
import { useProviders } from '@/hooks/useProviders'
import { navigateToSettings } from '@/modals/settings-navigation'
import { router } from '@/router'
import { switchCurrentSession } from '@/stores/session/crud'
import { submitNewUserMessage } from '@/stores/session/messages'
import { initEmptyChatSession } from '@/stores/sessionHelpers'
import { useSettingsStore } from '@/stores/settingsStore'
import { useUIStore } from '@/stores/uiStore'

export const Route = createFileRoute('/')({
  component: Index,
  validateSearch: zodValidator(z.object({ copilotId: z.string().optional(), settings: z.string().optional() })),
})

function Index() {
  const { t } = useTranslation()
  const { copilotId } = Route.useSearch()
  const { copilots } = useMyCopilots()
  const { providers } = useProviders()
  const widthFull = useUIStore((state) => state.widthFull)
  const [session, setSession] = useState<Session>(() => ({ id: 'new', ...initEmptyChatSession() }))
  const selectedRole = copilots.find((role) => role.id === copilotId)
  const requestSettings = useSettingsStore((state) => state)

  // 首页草稿保持模型的手动选择，同时响应独立参数页的修改。
  useEffect(() => {
    setSession((draft) => ({
      ...draft,
      settings: {
        ...draft.settings,
        temperature: requestSettings.temperature,
        topP: requestSettings.topP,
        maxTokens: requestSettings.maxTokens,
        stream: requestSettings.stream,
        maxContextMessageCount: requestSettings.maxContextMessageCount ?? Number.MAX_SAFE_INTEGER,
      },
    }))
  }, [
    requestSettings.temperature,
    requestSettings.topP,
    requestSettings.maxTokens,
    requestSettings.stream,
    requestSettings.maxContextMessageCount,
  ])

  useEffect(() => {
    const draft = initEmptyChatSession()
    setSession((old) => ({
      ...draft,
      id: 'new',
      settings: old.settings ?? draft.settings,
      ...(selectedRole
        ? {
            copilotId: selectedRole.id,
            name: selectedRole.name,
            assistantAvatarKey:
              selectedRole.avatar?.type === 'storage-key' ? selectedRole.avatar.storageKey : undefined,
            picUrl: selectedRole.avatar?.type === 'url' ? selectedRole.avatar.url : selectedRole.picUrl,
            backgroundImage: selectedRole.backgroundImage,
            messages: [createMessage('system', selectedRole.prompt)],
          }
        : {}),
    }))
  }, [selectedRole])

  const handleSubmit = useCallback(
    async ({ constructedMessage, needGenerating = true, onUserMessageReady }: InputBoxPayload) => {
      const { id: _draftId, ...draft } = session
      const created = await rendererApplication.sessions.createSession({
        ...draft,
        type: 'chat',
        settings: { ...session.settings, agentMode: ROLEPLAY_AGENT_MODE },
      })
      switchCurrentSession(created.id)
      await submitNewUserMessage(created.id, { newUserMsg: constructedMessage, needGenerating, onUserMessageReady })
      localStorage.removeItem('new-chat')
    },
    [session]
  )

  const editSession = useCallback(async () => {
    const edited = await NiceModal.show<Session | undefined>('session-settings', { session, disableAutoSave: true })
    if (edited) setSession(edited)
    return true
  }, [session])

  return (
    <Page title="">
      <Stack h="100%" gap="md" style={{ minHeight: 0 }}>
        <Stack align="center" justify="center" gap="sm" flex={1} px="xl" style={{ minHeight: 0, overflowY: 'auto' }}>
          <HomepageIcon className="h-12 w-12 mb-2" />
          <Text size="xl" fw={600}>
            {selectedRole
              ? t('Start a new story with {{name}}', { name: selectedRole.name })
              : t('A story starts here')}
          </Text>
          <Text size="sm" c="chatbox-secondary" ta="center" maw={480}>
            {selectedRole
              ? selectedRole.description || t('Your character is ready. Write your first line.')
              : t('Choose a character, or describe a world to enter.')}
          </Text>
          {!copilots.length && !selectedRole && (
            <Button component={Link} to="/copilots" variant="light" radius="lg" mt="sm">
              {t('Create your first character')}
            </Button>
          )}
          {!providers.length && (
            <Button variant="subtle" size="xs" onClick={() => navigateToSettings('/provider')}>
              {t('Configure a conversation model')}
            </Button>
          )}
        </Stack>
        {!!copilots.length && (
          <Box px="md" className={widthFull ? 'w-full' : 'w-full max-w-4xl mx-auto'}>
            <Flex gap="xs" wrap="wrap" align="center">
              <Text size="xs" c="chatbox-tertiary">
                {t('Roles')}
              </Text>
              {copilots.slice(0, 8).map((role) => (
                <Button
                  key={role.id}
                  onClick={() => {
                    void router.navigate({ to: '/', search: { copilotId: role.id } })
                  }}
                  variant={copilotId === role.id ? 'light' : 'default'}
                  size="compact-sm"
                  radius="lg"
                >
                  {role.name}
                </Button>
              ))}
              {copilotId && (
                <Button
                  onClick={() => {
                    void router.navigate({ to: '/', search: {} })
                  }}
                  variant="subtle"
                  size="compact-sm"
                >
                  {t('Free conversation')}
                </Button>
              )}
              <Button component={Link} to="/copilots" variant="subtle" size="compact-sm">
                {t('Manage characters')}
              </Button>
            </Flex>
          </Box>
        )}
        <InputBox
          sessionId="new"
          sessionType="chat"
          model={
            session.settings?.provider && session.settings?.modelId
              ? { provider: session.settings.provider, modelId: session.settings.modelId }
              : undefined
          }
          onSelectModel={(provider, modelId) =>
            setSession((old) => ({ ...old, settings: { ...old.settings, provider, modelId } }))
          }
          onClickSessionSettings={editSession}
          onSubmit={handleSubmit}
        />
      </Stack>
    </Page>
  )
}
