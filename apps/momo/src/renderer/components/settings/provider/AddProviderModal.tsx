import { Button, Stack, Text, TextInput } from '@mantine/core'
import { TestId } from '@shared/automation/testids'
import { ModelProviderType } from '@shared/types'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'
import { AdaptiveSelect } from '@/components/AdaptiveSelect'
import { AdaptiveModal } from '@/components/common/AdaptiveModal'
import { useSettingsStore } from '@/stores/settingsStore'

interface AddProviderModalProps {
  opened: boolean
  onClose: () => void
}

export function AddProviderModal({ opened, onClose }: AddProviderModalProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const setSettings = useSettingsStore((s) => s.setSettings)
  const customProviders = useSettingsStore((s) => s.customProviders)
  const [newProviderName, setNewProviderName] = useState('')
  const [newProviderMode, setNewProviderMode] = useState<ModelProviderType>(ModelProviderType.OpenAI)

  useEffect(() => {
    if (opened) {
      setNewProviderName('')
      setNewProviderMode(ModelProviderType.OpenAI)
    }
  }, [opened])

  const handleAddProvider = () => {
    if (!newProviderName.trim()) return
    const pid = `custom-provider-${uuidv4()}`
    setSettings({
      customProviders: [
        ...(customProviders || []),
        {
          id: pid,
          name: newProviderName.trim(),
          type: newProviderMode,
          isCustom: true,
        },
      ],
    })
    onClose()
    navigate({
      to: '/settings/provider/$providerId',
      params: {
        providerId: pid,
      },
    })
  }

  return (
    <AdaptiveModal size="sm" opened={opened} onClose={onClose} centered title={t('Add Custom Provider')}>
      <Stack gap="xs">
        <Text>{t('Name')}</Text>
        <TextInput
          data-testid={TestId.settings.addProviderName}
          value={newProviderName}
          onChange={(e) => setNewProviderName(e.currentTarget.value)}
          required
          error={!newProviderName.trim() ? t('Name is required') : ''}
        />
        <Text>{t('API protocol')}</Text>
        <AdaptiveSelect
          data-testid={TestId.settings.addProviderApiMode}
          value={newProviderMode}
          classNames={{ dropdown: 'pointer-events-auto' }}
          onChange={(value) => {
            const parsed = z.enum(ModelProviderType).safeParse(value)
            if (parsed.success && parsed.data !== ModelProviderType.ChatboxAI) setNewProviderMode(parsed.data)
          }}
          data={[
            {
              value: ModelProviderType.OpenAI,
              label: 'OpenAI Chat Completions',
            },
            {
              value: ModelProviderType.OpenAIResponses,
              label: 'OpenAI Responses',
            },
            {
              value: ModelProviderType.Claude,
              label: 'Anthropic Messages',
            },
            {
              value: ModelProviderType.Gemini,
              label: 'Google Gemini',
            },
          ]}
        />
        <AdaptiveModal.Actions>
          <AdaptiveModal.CloseButton onClick={onClose} />
          <Button
            data-testid={TestId.settings.addProviderSubmit}
            onClick={handleAddProvider}
            disabled={!newProviderName.trim()}
          >
            {t('Add')}
          </Button>
        </AdaptiveModal.Actions>
      </Stack>
    </AdaptiveModal>
  )
}
