import NiceModal from '@ebay/nice-modal-react'
import { Button, Flex, PasswordInput, Select, Stack, Text, TextInput, Title } from '@mantine/core'
import { TestId } from '@shared/automation/testids'
import { assertMomoRequestUrl } from '@shared/momo-policy'
import { ModelProviderType, type ProviderModelInfo, ProviderModelInfoSchema } from '@shared/types'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { AdaptiveModal } from '@/components/common/AdaptiveModal'
import { PopoverConfirm } from '@/components/common/PopoverConfirm'
import { ModelList } from '@/components/ModelList'
import { getModelSettingUtil } from '@/packages/model-setting-utils'
import { useProviderSettings, useSettingsStore } from '@/stores/settingsStore'
export const Route = createFileRoute('/settings/provider/$providerId')({ component: RouteComponent })
export function RouteComponent() {
  const { providerId } = Route.useParams()
  return <CustomProviderSettings key={providerId} providerId={providerId} />
}
function CustomProviderSettings({ providerId }: { providerId: string }) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const custom = useSettingsStore((s) => s.customProviders)
  const setSettings = useSettingsStore((s) => s.setSettings)
  const provider = custom?.find((p) => p.id === providerId && p.isCustom)
  const { providerSettings: settings, setProviderSettings: update } = useProviderSettings(providerId)
  const [fetching, setFetching] = useState(false),
    [fetched, setFetched] = useState<ProviderModelInfo[] | null>(null),
    [error, setError] = useState('')
  const models = (settings?.models || []).filter((m) => !m.type || m.type === 'chat')
  const rename = (name: string) =>
    setSettings({ customProviders: custom?.map((p) => (p.id === providerId ? { ...p, name } : p)) })
  const editModel = async (model?: ProviderModelInfo) => {
    const raw = await NiceModal.show('model-edit', { providerId, model })
    if (raw === undefined) return
    const parsed = ProviderModelInfoSchema.safeParse(raw)
    if (!parsed.success || !parsed.data.modelId.trim()) return
    if (!model && models.some((m) => m.modelId === parsed.data.modelId)) {
      setError(t('already existed'))
      return
    }
    update({
      models: model ? models.map((m) => (m.modelId === model.modelId ? parsed.data : m)) : [...models, parsed.data],
    })
  }
  const fetchModels = async () => {
    if (!provider || !settings?.apiHost?.trim()) return
    setFetching(true)
    setError('')
    try {
      assertMomoRequestUrl(settings.apiHost)
      const endpoint = new URL(settings.apiHost)
      if (
        !['http:', 'https:'].includes(endpoint.protocol) ||
        endpoint.username ||
        endpoint.password ||
        endpoint.search ||
        endpoint.hash
      )
        throw new Error('invalid endpoint')
      const result = await getModelSettingUtil(providerId, provider.type).getMergeOptionGroups(settings)
      const validated = z
        .array(ProviderModelInfoSchema)
        .parse(result)
        .filter((m) => !m.type || m.type === 'chat')
      if (!validated.length) throw new Error('empty models')
      setFetched(validated)
    } catch {
      setError(t('Could not fetch models. Check the endpoint or add model IDs manually.'))
    } finally {
      setFetching(false)
    }
  }
  if (!provider)
    return (
      <Stack gap="sm">
        <Title order={5}>{t('Custom provider not found')}</Title>
        <Text c="dimmed">{t('Add a custom provider to configure your endpoint, API key and model IDs.')}</Text>
      </Stack>
    )
  return (
    <Stack gap="lg" maw={760}>
      <Title order={4}>{provider.name || t('Custom Provider')}</Title>
      <TextInput label={t('Name')} value={provider.name} onChange={(e) => rename(e.currentTarget.value)} />
      <Select
        label={t('API protocol')}
        value={provider.type}
        allowDeselect={false}
        data={[
          { value: ModelProviderType.OpenAI, label: 'OpenAI Chat Completions' },
          { value: ModelProviderType.OpenAIResponses, label: 'OpenAI Responses' },
          { value: ModelProviderType.Claude, label: 'Anthropic Messages' },
          { value: ModelProviderType.Gemini, label: 'Google Gemini' },
        ]}
        onChange={(value) => {
          const parsed = z.enum(ModelProviderType).safeParse(value)
          if (parsed.success && parsed.data !== ModelProviderType.ChatboxAI)
            setSettings({
              customProviders: custom?.map((p) => (p.id === providerId ? { ...p, type: parsed.data } : p)),
            })
        }}
      />
      <TextInput
        data-testid={TestId.settings.providerApiHost}
        label={t('API endpoint')}
        placeholder="http(s)://…"
        value={settings?.apiHost || ''}
        onChange={(e) => update({ apiHost: e.currentTarget.value })}
      />
      <TextInput
        label={t('API Path')}
        description={t('Leave empty to use the standard path for this API protocol.')}
        placeholder={t('optional')}
        value={settings?.apiPath || ''}
        onChange={(e) => update({ apiPath: e.currentTarget.value })}
      />
      <PasswordInput
        data-testid={TestId.settings.providerApiKey}
        label={t('API Key')}
        description={t('Optional for local services without authentication.')}
        value={settings?.apiKey || ''}
        onChange={(e) => update({ apiKey: e.currentTarget.value })}
      />
      <Flex align="center" justify="space-between">
        <Text fw={600}>{t('Models')}</Text>
        <Flex gap="xs">
          <Button
            size="xs"
            variant="light"
            onClick={() => void editModel()}
            data-testid={TestId.settings.providerModelNew}
          >
            {t('Add model')}
          </Button>
          <Button
            size="xs"
            variant="default"
            loading={fetching}
            disabled={!settings?.apiHost?.trim()}
            onClick={() => void fetchModels()}
            data-testid={TestId.settings.providerModelFetch}
          >
            {t('Fetch')}
          </Button>
        </Flex>
      </Flex>
      {error && (
        <Text size="sm" c="red">
          {error}
        </Text>
      )}
      {!models.length && (
        <Text size="sm" c="dimmed">
          {t('No models configured. Enter the model IDs provided by your service.')}
        </Text>
      )}
      <ModelList
        models={models}
        showActions
        showSearch={false}
        onEditModel={(m) => void editModel(m)}
        onDeleteModel={(id) => update({ models: models.filter((m) => m.modelId !== id) })}
      />
      <PopoverConfirm
        title={t('Delete custom provider?')}
        confirmButtonColor="red"
        onConfirm={() => {
          setSettings((current) => {
            current.customProviders = current.customProviders?.filter((p) => p.id !== providerId)
            if (current.providers) delete current.providers[providerId]
            current.favoritedModels = current.favoritedModels?.filter((m) => m.provider !== providerId)
          })
          void navigate({ to: '/settings/provider' })
        }}
      >
        <Button
          color="red"
          variant="subtle"
          size="xs"
          style={{ alignSelf: 'flex-start' }}
          data-testid={TestId.settings.providerDelete}
        >
          {t('Delete')}
        </Button>
      </PopoverConfirm>
      <AdaptiveModal opened={fetched !== null} onClose={() => setFetched(null)} title={t('Models')} centered>
        <ModelList
          models={fetched || []}
          showActions
          showSearch
          displayedModelIds={models.map((m) => m.modelId)}
          onAddModel={(model) => update({ models: [...models, model] })}
          onRemoveModel={(id) => update({ models: models.filter((m) => m.modelId !== id) })}
        />
      </AdaptiveModal>
    </Stack>
  )
}
