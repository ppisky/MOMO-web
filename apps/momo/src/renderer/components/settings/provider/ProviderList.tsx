import { Button, Flex, Menu, ScrollArea, Stack, Text } from '@mantine/core'
import { AutomationAdjacentAttr, TestId } from '@shared/automation/testids'
import type { ProviderBaseInfo } from '@shared/types'
import { IconPlus } from '@tabler/icons-react'
import { Link, useRouterState } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import CustomProviderIcon from '@/components/CustomProviderIcon'
export function ProviderList({
  providers,
  onAddProvider,
}: {
  providers: ProviderBaseInfo[]
  onAddProvider: () => void
}) {
  const { t } = useTranslation()
  const path = useRouterState().location.pathname
  const custom = providers.filter((p) => p.isCustom)
  return (
    <Stack
      data-testid={TestId.settings.providerList}
      w={224}
      miw={180}
      gap={0}
      className="border-0 border-r border-solid border-chatbox-border-primary"
    >
      <ScrollArea flex={1}>
        <Stack p="xs" gap="xs">
          {!custom.length && (
            <Text size="sm" c="dimmed" p="md">
              {t('No custom providers')}
            </Text>
          )}
          {custom.map((p) => (
            <Link
              key={p.id}
              to="/settings/provider/$providerId"
              params={{ providerId: p.id }}
              data-testid={TestId.settings.providerItem}
              {...{ [AutomationAdjacentAttr.providerId]: p.id }}
              className="no-underline"
            >
              <Flex
                gap="sm"
                align="center"
                p="sm"
                className="rounded-lg"
                bg={path.endsWith(`/${p.id}`) ? 'var(--chatbox-background-brand-secondary)' : undefined}
                c="chatbox-secondary"
              >
                <CustomProviderIcon providerId={p.id} providerName={p.name} size={28} />
                <Text size="sm" truncate>
                  {p.name}
                </Text>
              </Flex>
            </Link>
          ))}
        </Stack>
      </ScrollArea>
      <Menu withinPortal position="top-start" transitionProps={{ duration: 0 }}>
        <Menu.Target>
          <Button
            m="md"
            variant="outline"
            leftSection={<IconPlus size={16} />}
            data-testid={TestId.settings.addProvider}
          >
            {t('Add')}
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item onClick={onAddProvider}>{t('Add Custom Provider')}</Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </Stack>
  )
}
