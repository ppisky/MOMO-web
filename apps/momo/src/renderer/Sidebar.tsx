import NiceModal from '@ebay/nice-modal-react'
import { ActionIcon, Box, Button, Flex, Image, NavLink, Stack, Text } from '@mantine/core'
import SwipeableDrawer from '@mui/material/SwipeableDrawer'
import { TestId } from '@shared/automation/testids'
import {
  IconArchive,
  IconCirclePlus,
  IconInfoCircle,
  IconLayoutSidebarLeftCollapse,
  IconMessageChatbot,
  IconSearch,
  IconSettings,
} from '@tabler/icons-react'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppTooltip as Tooltip } from '@/components/ui/tooltip'
import SessionList from './components/session/SessionList'
import useNeedRoomForMacWinControls from './hooks/useNeedRoomForWinControls'
import { useIsSmallScreen, useSidebarWidth } from './hooks/useScreenChange'
import { navigateToSettings } from './modals/settings-navigation'
import { getSidebarModalSx } from './sidebar-drawer'
import icon from './static/momo-mark.svg'
import { useUIStore } from './stores/uiStore'

export default function Sidebar() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const showSidebar = useUIStore((state) => state.showSidebar)
  const setShowSidebar = useUIStore((state) => state.setShowSidebar)
  const setSidebarWidth = useUIStore((state) => state.setSidebarWidth)
  const setOpenSearchDialog = useUIStore((state) => state.setOpenSearchDialog)
  const sidebarWidth = useSidebarWidth()
  const isSmallScreen = useIsSmallScreen()
  const { needRoomForMacWindowControls } = useNeedRoomForMacWinControls()
  const viewport = useRef<HTMLDivElement>(null)
  const resizeOrigin = useRef({ x: 0, width: 0 })
  const [resizing, setResizing] = useState(false)
  const closeMobile = () => {
    if (isSmallScreen) setShowSidebar(false)
  }
  useEffect(() => {
    if (!resizing) return
    const move = (event: MouseEvent) =>
      setSidebarWidth(
        Math.max(220, Math.min(500, resizeOrigin.current.width + (event.clientX - resizeOrigin.current.x)))
      )
    const stop = () => setResizing(false)
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', stop)
    return () => {
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', stop)
    }
  }, [resizing, setSidebarWidth])
  return (
    <SwipeableDrawer
      anchor="left"
      variant={isSmallScreen ? 'temporary' : 'persistent'}
      open={showSidebar}
      onClose={() => setShowSidebar(false)}
      onOpen={() => setShowSidebar(true)}
      disableSwipeToOpen
      ModalProps={{ keepMounted: true, disableEnforceFocus: true, sx: getSidebarModalSx(showSidebar) }}
      sx={{
        '& .MuiDrawer-paper': {
          backgroundColor: 'transparent',
          backgroundImage: 'none',
          border: 0,
          boxSizing: 'border-box',
          width: isSmallScreen ? '80vw' : sidebarWidth,
          maxWidth: '80vw',
          overflowY: 'initial',
        },
      }}
    >
      <Stack
        data-testid={TestId.sidebar.root}
        h="100%"
        gap={0}
        className="relative"
        pt="var(--mobile-safe-area-inset-top, 0px)"
      >
        {needRoomForMacWindowControls && <Box className="title-bar flex-[0_0_44px]" />}
        <Flex align="center" justify="space-between" px="md" py="md" gap="xs">
          <Flex align="center" gap="xs">
            <Image src={icon} w={24} h={24} />
            <Text fw={700} size="md">
              MOMO
            </Text>
          </Flex>
          <Flex gap={2}>
            <Tooltip label={t('Search chats')}>
              <ActionIcon
                aria-label={t('Search chats')}
                variant="subtle"
                color="chatbox-secondary"
                size={28}
                onClick={() => setOpenSearchDialog(true, true)}
              >
                <IconSearch size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('Archive chat list')}>
              <ActionIcon
                aria-label={t('Archive chat list')}
                variant="subtle"
                color="chatbox-secondary"
                size={28}
                onClick={() => void NiceModal.show('clear-session-list')}
              >
                <IconArchive size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('Collapse sidebar')}>
              <ActionIcon
                data-testid={TestId.sidebar.collapse}
                aria-label={t('Collapse sidebar')}
                variant="subtle"
                color="chatbox-secondary"
                size={28}
                onClick={() => setShowSidebar(false)}
              >
                <IconLayoutSidebarLeftCollapse size={18} />
              </ActionIcon>
            </Tooltip>
          </Flex>
        </Flex>
        <Box px="sm" pb="sm">
          <Button
            fullWidth
            radius="lg"
            variant="light"
            leftSection={<IconCirclePlus size={18} />}
            data-testid={TestId.sidebar.newChat}
            onClick={() => {
              void navigate({ to: '/', search: {} })
              closeMobile()
            }}
          >
            {t('New Chat')}
          </Button>
        </Box>
        <SessionList sessionListViewportRef={viewport} />
        <Stack px="xs" py="sm" gap={2} className="border-0 border-t border-solid border-chatbox-border-primary">
          <NavLink
            className="rounded-lg"
            label={t('Roles')}
            leftSection={<IconMessageChatbot size={20} />}
            onClick={() => {
              void navigate({ to: '/copilots' })
              closeMobile()
            }}
          />
          <NavLink
            className="rounded-lg"
            label={t('Settings')}
            data-testid={TestId.sidebar.settingsTrigger}
            leftSection={<IconSettings size={20} />}
            onClick={() => {
              navigateToSettings()
              closeMobile()
            }}
          />
          <NavLink
            className="rounded-lg"
            label={t('About MOMO')}
            c="chatbox-tertiary"
            leftSection={<IconInfoCircle size={20} />}
            onClick={() => {
              void navigate({ to: '/about' })
              closeMobile()
            }}
          />
        </Stack>
        {!isSmallScreen && (
          <Box
            aria-hidden
            onMouseDown={(event) => {
              event.preventDefault()
              resizeOrigin.current = { x: event.clientX, width: sidebarWidth }
              setResizing(true)
            }}
            className={`absolute top-0 bottom-0 w-1 cursor-col-resize -right-1`}
          />
        )}
      </Stack>
    </SwipeableDrawer>
  )
}
