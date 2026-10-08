import { Stack, Text, Title } from '@mantine/core'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettingsStore } from '@/stores/settingsStore'
export const Route = createFileRoute('/settings/provider/')({ component: RouteComponent })
export function RouteComponent() {
  const { t } = useTranslation()
  const providers = useSettingsStore((s) => s.customProviders)
  const navigate = useNavigate()
  const first = providers?.find((p) => p.isCustom)?.id
  useEffect(() => {
    if (first) void navigate({ to: '/settings/provider/$providerId', params: { providerId: first }, replace: true })
  }, [first, navigate])
  return (
    <Stack align="center" justify="center" h="100%" gap="sm">
      <Title order={4}>{t('Your API connections')}</Title>
      <Text size="sm" c="dimmed" ta="center" maw={400}>
        {t('Add a custom provider to configure your endpoint, API key and model IDs.')}
      </Text>
    </Stack>
  )
}
