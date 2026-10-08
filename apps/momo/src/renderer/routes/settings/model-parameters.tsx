import { NumberInput, Stack, Switch, Text, Title } from '@mantine/core'
import { TestId } from '@shared/automation/testids'
import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import MaxContextMessageCountSlider from '@/components/common/MaxContextMessageCountSlider'
import { useSettingsStore } from '@/stores/settingsStore'
export const Route = createFileRoute('/settings/model-parameters')({ component: RouteComponent })
export function RouteComponent() {
  const { t } = useTranslation()
  const settings = useSettingsStore((s) => s)
  return (
    <Stack p="md" gap="lg" maw={680}>
      <Title order={5}>{t('Model Parameters')}</Title>
      <Text size="sm" c="dimmed">
        {t('Request parameters for new conversations. Existing conversations keep their own overrides.')}
      </Text>
      <NumberInput
        data-testid={TestId.settings.temperature}
        label={t('Temperature')}
        description={t('Higher values make replies more varied. Leave empty to follow the model default.')}
        min={0}
        max={2}
        step={0.1}
        decimalScale={2}
        value={settings.temperature ?? ''}
        placeholder={t('Not set')}
        onChange={(v) => settings.setSettings({ temperature: typeof v === 'number' ? v : undefined })}
      />
      <NumberInput
        data-testid={TestId.settings.topP}
        label="Top P"
        description={t('Sampling probability threshold. Leave empty to follow the model default.')}
        min={0}
        max={1}
        step={0.05}
        decimalScale={2}
        value={settings.topP ?? ''}
        placeholder={t('Not set')}
        onChange={(v) => settings.setSettings({ topP: typeof v === 'number' ? v : undefined })}
      />
      <NumberInput
        data-testid={TestId.settings.maxTokens}
        label={t('Max Output Tokens')}
        description={t('0 uses the API default. A positive number sets the maximum output length.')}
        min={0}
        allowDecimal={false}
        value={settings.maxTokens ?? 0}
        onChange={(v) => settings.setSettings({ maxTokens: typeof v === 'number' && v > 0 ? v : undefined })}
      />
      <MaxContextMessageCountSlider
        inputTestId={TestId.settings.maxContext}
        value={settings.maxContextMessageCount ?? Number.MAX_SAFE_INTEGER}
        onChange={(v) => settings.setSettings({ maxContextMessageCount: v })}
      />
      <Switch
        data-testid={TestId.settings.stream}
        label={t('Stream output')}
        description={t('Show the reply as it is generated.')}
        checked={settings.stream ?? true}
        onChange={(e) => settings.setSettings({ stream: e.currentTarget.checked })}
      />
    </Stack>
  )
}
