import { ActionIcon, Box, Flex, Stack, Text } from '@mantine/core'
import { TestId } from '@shared/automation/testids'
import {
  IconAdjustmentsHorizontal,
  IconArchive,
  IconBox,
  IconCategory,
  IconChevronLeft,
  IconChevronRight,
  IconInfoCircle,
  IconKeyboard,
  IconMessages,
} from '@tabler/icons-react'
import { createFileRoute, Link, Outlet, useCanGoBack, useRouter, useRouterState } from '@tanstack/react-router'
import clsx from 'clsx'
import { useTranslation } from 'react-i18next'
import { Toaster } from 'sonner'
import Divider from '@/components/common/Divider'
import { ScalableIcon } from '@/components/common/ScalableIcon'
import Page from '@/components/layout/Page'
import { useIsSmallScreen } from '@/hooks/useScreenChange'

const ITEMS = [
  { key: 'provider', label: 'Service Providers', icon: <IconCategory /> },
  { key: 'model-parameters', label: 'Model Parameters', icon: <IconBox /> },
  { key: 'chat', label: 'Chat Settings', icon: <IconMessages /> },
  { key: 'archive', label: 'Archived Chats', icon: <IconArchive /> },
  { key: 'hotkeys', label: 'Keyboard Shortcuts', icon: <IconKeyboard /> },
  { key: 'general', label: 'General Settings', icon: <IconAdjustmentsHorizontal /> },
] as const

export const Route = createFileRoute('/settings')({
  component: RouteComponent,
})

export function RouteComponent() {
  const { t } = useTranslation()
  const router = useRouter()
  const canGoBack = useCanGoBack()
  const isSmallScreen = useIsSmallScreen()

  return (
    <Page
      title={t('Settings')}
      left={
        isSmallScreen && canGoBack ? (
          <ActionIcon
            className="controls"
            variant="subtle"
            size={28}
            color="chatbox-secondary"
            mr="sm"
            onClick={() => router.history.back()}
          >
            <IconChevronLeft />
          </ActionIcon>
        ) : undefined
      }
    >
      <SettingsRoot />
      <Toaster richColors position="bottom-center" style={{ zIndex: 2147483647 }} />
    </Page>
  )
}

export function SettingsRoot() {
  const { t } = useTranslation()
  const routerState = useRouterState()
  const key = routerState.location.pathname.split('/')[2]
  const isSmallScreen = useIsSmallScreen()

  return (
    <Flex flex={1} h="100%" miw={isSmallScreen ? undefined : 800}>
      {(!isSmallScreen || routerState.location.pathname === '/settings') && (
        <Stack
          p={isSmallScreen ? 0 : 'xs'}
          gap={isSmallScreen ? 0 : 'xs'}
          maw={isSmallScreen ? undefined : 256}
          className={clsx(
            'border-solid border-0 border-r overflow-auto border-chatbox-border-primary',
            isSmallScreen ? 'w-full border-r-0' : 'flex-[1_0_auto]'
          )}
        >
          {ITEMS.map((item) => (
            <Link
              disabled={
                routerState.location.pathname === `/settings/${item.key}` ||
                routerState.location.pathname.startsWith(`/settings/${item.key}/`)
              }
              key={item.key}
              to={`/settings/${item.key}`}
              className={'block no-underline w-full'}
              data-testid={
                item.key === 'chat'
                  ? TestId.settings.navChat
                  : item.key === 'general'
                    ? TestId.settings.navGeneral
                    : item.key === 'model-parameters'
                      ? TestId.settings.navModelParameters
                      : undefined
              }
            >
              <Flex
                component="span"
                gap="xs"
                p="md"
                pr="xl"
                py={isSmallScreen ? 'sm' : undefined}
                align="center"
                c={item.key === key ? 'chatbox-brand' : 'chatbox-secondary'}
                bg={item.key === key ? 'var(--chatbox-background-brand-secondary)' : 'transparent'}
                className={clsx(
                  ' cursor-pointer select-none rounded-lg',
                  item.key === key ? '' : 'hover:!bg-chatbox-background-gray-secondary'
                )}
              >
                <Box component="span" flex="0 0 auto" w={20} h={20} mr="xs">
                  {item.icon}
                </Box>
                <Text
                  flex={1}
                  lineClamp={1}
                  span={true}
                  className={`!text-inherit ${isSmallScreen ? 'min-h-[32px] leading-[32px]' : ''}`}
                >
                  {'noTranslate' in item && item.noTranslate ? item.label : t(item.label)}
                </Text>
                {isSmallScreen && (
                  <ScalableIcon icon={IconChevronRight} size={20} className="!text-chatbox-tint-tertiary" />
                )}
              </Flex>

              {isSmallScreen && <Divider />}
            </Link>
          ))}

          {isSmallScreen && (
            <Link to={`/about`} className={'block no-underline w-full'}>
              <Flex
                component="span"
                gap="xs"
                p="md"
                pr="xl"
                py="sm"
                align="center"
                c={'chatbox-secondary'}
                className={clsx(' cursor-pointer select-none rounded-lg')}
              >
                <Box component="span" flex="0 0 auto" w={20} h={20} mr="xs">
                  <ScalableIcon icon={IconInfoCircle} size={20} />
                </Box>
                <Text
                  flex={1}
                  lineClamp={1}
                  span={true}
                  className={`!text-inherit ${isSmallScreen ? 'min-h-[32px] leading-[32px]' : ''}`}
                >
                  {t('About')}
                </Text>
                <ScalableIcon icon={IconChevronRight} size={20} className="!text-chatbox-tint-tertiary" />
              </Flex>

              {isSmallScreen && <Divider />}
            </Link>
          )}
        </Stack>
      )}
      {!(isSmallScreen && routerState.location.pathname === '/settings') && (
        <Box flex="1 1 80%" className="overflow-auto">
          <Outlet />
        </Box>
      )}
    </Flex>
  )
}
