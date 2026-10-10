import React from 'react';
// Migrated from MOMO-web Sidebar.tsx (GPL-3.0).

import { ActionIcon, Box, Button, Flex, Image, NavLink, Stack, Text } from '@mantine/core';
import SwipeableDrawer from '@mui/material/SwipeableDrawer';

import {
  IconArchive,
  IconActivity,
  IconCirclePlus,
  IconInfoCircle,
  IconLayoutSidebarLeftCollapse,
  IconMessageChatbot,
  IconSearch,
  IconSettings,
} from '@tabler/icons-react';
import { useProduct } from './context';
import { Select } from '@mantine/core';
import { IconBrain, IconTopologyStar3 } from '@tabler/icons-react';
import { SessionList } from './Sessions';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip } from '@mantine/core';

import { useIsSmallScreen, useUIStore } from './store';

import { api } from './api';
import { addToast } from './media';
const icon = '/momo.svg';

export default function Sidebar() {
  const { t } = useTranslation();
  const { data, navigate, openSettings, openSearch, reload } = useProduct();
  const showSidebar = useUIStore((state) => state.showSidebar);
  const setShowSidebar = useUIStore((state) => state.setShowSidebar);
  const setSidebarWidth = useUIStore((state) => state.setSidebarWidth);
  const setOpenSearchDialog = () => openSearch();
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const isSmallScreen = useIsSmallScreen();
  const needRoomForMacWindowControls = false;
  const viewport = useRef<HTMLDivElement>(null);
  const resizeOrigin = useRef({ x: 0, width: 0 });
  const [resizing, setResizing] = useState(false);
  const closeMobile = () => {
    if (isSmallScreen) setShowSidebar(false);
  };
  useEffect(() => {
    if (!resizing) return;
    const move = (event: MouseEvent) =>
      setSidebarWidth(
        Math.max(220, Math.min(500, resizeOrigin.current.width + (event.clientX - resizeOrigin.current.x))),
      );
    const stop = () => setResizing(false);
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', stop);
    return () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', stop);
    };
  }, [resizing, setSidebarWidth]);
  return (
    <SwipeableDrawer
      anchor="left"
      variant={isSmallScreen ? 'temporary' : 'persistent'}
      open={showSidebar}
      onClose={() => setShowSidebar(false)}
      onOpen={() => setShowSidebar(true)}
      disableSwipeToOpen
      ModalProps={{
        keepMounted: true,
        disableEnforceFocus: true,
        sx: { pointerEvents: showSidebar ? 'auto' : 'none' },
      }}
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
      <Stack h="100%" gap={0} className="relative" pt="var(--mobile-safe-area-inset-top, 0px)">
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
                onClick={() => setOpenSearchDialog()}
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
                onClick={() => openSettings('archive')}
              >
                <IconArchive size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('Collapse sidebar')}>
              <ActionIcon
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
            onClick={() => {
              navigate('/');
              closeMobile();
            }}
          >
            {t('New Chat')}
          </Button>
        </Box>
        <Box px="sm" pb="xs">
          <Select
            aria-label="当前空间"
            size="xs"
            value={data.spaceId}
            data={data.spaces.spaces.map((s) => ({ value: s.id, label: s.name }))}
            onChange={(id) => {
              if (id)
                void api('/api/spaces', { command: 'select', revision: data.spaces.revision, id })
                  .then(() => {
                    navigate('/');
                    reload();
                  })
                  .catch((e) => addToast(e.message));
            }}
          />
        </Box>
        <SessionList />
        <Stack
          px="xs"
          py="sm"
          gap={2}
          className="border-0 border-t border-solid border-chatbox-border-primary"
        >
          <NavLink
            className="rounded-lg"
            label={t('Roles')}
            leftSection={<IconMessageChatbot size={20} />}
            onClick={() => {
              navigate('/copilots');
              closeMobile();
            }}
          />
          <NavLink
            className="rounded-lg"
            label="记忆"
            leftSection={<IconBrain size={20} />}
            onClick={() => {
              navigate('/memory');
              closeMobile();
            }}
          />
          <NavLink
            className="rounded-lg"
            label="语义网"
            leftSection={<IconTopologyStar3 size={20} />}
            onClick={() => {
              navigate('/nsg');
              closeMobile();
            }}
          />
          <NavLink
            className="rounded-lg"
            label="MO State"
            leftSection={<IconActivity size={20} />}
            onClick={() => {
              navigate('/mo-state');
              closeMobile();
            }}
          />
          <NavLink
            className="rounded-lg"
            id="momo-open-settings"
            label={t('Settings')}
            leftSection={<IconSettings size={20} />}
            onClick={() => {
              openSettings('provider');
              closeMobile();
            }}
          />
          <NavLink
            className="rounded-lg"
            label={t('About MOMO')}
            c="chatbox-tertiary"
            leftSection={<IconInfoCircle size={20} />}
            onClick={() => {
              navigate('/about');
              closeMobile();
            }}
          />
        </Stack>
        {!isSmallScreen && (
          <Box
            aria-hidden
            onMouseDown={(event) => {
              event.preventDefault();
              resizeOrigin.current = { x: event.clientX, width: sidebarWidth };
              setResizing(true);
            }}
            className={`absolute top-0 bottom-0 w-1 cursor-col-resize -right-1`}
          />
        )}
      </Stack>
    </SwipeableDrawer>
  );
}
