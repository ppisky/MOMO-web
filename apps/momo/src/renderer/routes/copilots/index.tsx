import NiceModal from '@ebay/nice-modal-react'
import { Button, Flex, Grid, Stack, Text, TextInput } from '@mantine/core'
import type { CopilotDetail } from '@shared/types'
import { IconPlus, IconSearch } from '@tabler/icons-react'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMyCopilots } from '@/hooks/useCopilots'
import CopilotItem from './-components/CopilotItem'

export const Route = createFileRoute('/copilots/')({ component: Roles })

function Roles() {
  const { t } = useTranslation()
  const store = useMyCopilots()
  const [query, setQuery] = useState('')
  const roles = store.copilots.filter((role) =>
    `${role.name} ${role.description ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())
  )
  const createRole = () => {
    void NiceModal.show('copilot-settings', {
      mode: 'create',
      onSave: (role: CopilotDetail) => store.addOrUpdate(role),
    })
  }
  return (
    <Stack p="md" gap="lg" className="max-w-7xl">
      <Flex align="center" gap="md" justify="space-between" wrap="wrap">
        <Text size="sm" c="chatbox-secondary">
          {t('Define personality, world and memories for your characters.')}
        </Text>
        <Button leftSection={<IconPlus size={16} />} onClick={createRole} radius="lg">
          {t('Create character')}
        </Button>
      </Flex>
      {!!store.copilots.length && (
        <TextInput
          aria-label={t('Search characters')}
          placeholder={t('Search characters')}
          leftSection={<IconSearch size={16} />}
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          maw={360}
        />
      )}
      {roles.length ? (
        <Grid gutter="md">
          {roles.map((role) => (
            <Grid.Col key={role.id} span={{ base: 12, md: 6, xl: 4 }}>
              <CopilotItem copilot={role} />
            </Grid.Col>
          ))}
        </Grid>
      ) : (
        <Stack align="center" justify="center" py={80} gap="sm">
          <Text fw={600}>{query ? t('No matching characters') : t('No characters yet')}</Text>
          <Text size="sm" c="chatbox-tertiary">
            {query
              ? t('Try another name.')
              : t('Start with a name and a character description. Characters are saved on this device.')}
          </Text>
          {!query && (
            <Button variant="light" onClick={createRole} mt="sm" radius="lg">
              {t('Create character')}
            </Button>
          )}
        </Stack>
      )}
    </Stack>
  )
}
