// Adapted from MOMO-web Settings.tsx and settings/route.tsx, GPL-3.0.
// See third-party/momo-web/README.md. Core operations stay outside this shell.
import React, { type ReactNode } from 'react';
import { Box, Button, Flex, Modal, Stack, Text, Title } from '@mantine/core';
import {
  IconAdjustments,
  IconArchive,
  IconBox,
  IconBrain,
  IconCategory,
  IconChevronLeft,
  IconLayoutGrid,
  IconMessages,
  IconX,
} from '@tabler/icons-react';
import { ScalableIcon } from './ScalableIcon';
import { useProduct } from './context';
import { useIsSmallScreen } from './store';
import { useTranslation } from 'react-i18next';

export function Settings({
  children,
  onClose,
  page = 'spaces',
}: {
  children: ReactNode;
  onClose: () => void;
  page?: string;
}) {
  const { openSettings } = useProduct();
  const small = useIsSmallScreen();
  const { t } = useTranslation();
  const items = [
    ['provider', 'Service Providers', IconCategory],
    ['model-parameters', 'Model Parameters', IconBox],
    ['chat', 'Chat Settings', IconMessages],
    ['archive', 'Archived Chats', IconArchive],
    ['memory', '记忆与语义网', IconBrain],
    ['spaces', '空间', IconLayoutGrid],
    ['general', 'General Settings', IconAdjustments],
  ] as const;
  return (
    <Modal
      id="momo-settings"
      opened
      onClose={onClose}
      fullScreen
      centered
      size="100%"
      withCloseButton={false}
      title="设置"
      classNames={{
        inner: 'web-settings-inner',
        content: 'web-settings',
        header: 'web-settings-hidden-header',
        body: 'web-settings-body',
      }}
      transitionProps={{ duration: 0 }}
    >
      <Flex flex="0 0 auto" className="web-settings-titlebar">
        <div className="web-settings-titlebar-flank" />
        <Flex p="sm" align="center" w="100%" maw={1200} gap="xs">
          {small && page !== 'index' && (
            <Button
              variant="subtle"
              p={0}
              w={28}
              aria-label="返回设置导航"
              onClick={() => openSettings('index')}
            >
              <IconChevronLeft size={20} />
            </Button>
          )}
          <Title order={3} flex={1}>
            设置
          </Title>
          <Text c="chatbox-tertiary" size="xs" className="web-settings-escape">
            ESC
          </Text>
          <Button
            color="chatbox-secondary"
            variant="light"
            h={36}
            w={36}
            p={0}
            radius="lg"
            id="momo-close-settings"
            aria-label="关闭设置"
            onClick={onClose}
          >
            <ScalableIcon icon={IconX} size={20} />
          </Button>
        </Flex>
        <div className="web-settings-titlebar-flank" />
      </Flex>
      <Box flex={1} w="100%" maw={1200} mx="auto" className="web-settings-container">
        <Flex flex={1} h="100%" className="web-settings-layout">
          <Stack
            p="xs"
            gap="xs"
            maw={small ? undefined : 256}
            className="web-settings-nav"
            component="nav"
            aria-label="设置导航"
            style={{
              display: small && page !== 'index' ? 'none' : 'flex',
              width: small ? '100%' : undefined,
            }}
          >
            {items.map(([id, label, icon]) => (
              <Flex
                key={id}
                id={`momo-settings-${id}`}
                component="button"
                onClick={() => openSettings(id)}
                gap="xs"
                p="md"
                pr="xl"
                align="center"
                c={page === id ? 'chatbox-brand' : 'chatbox-secondary'}
                bg={page === id ? 'var(--chatbox-background-brand-secondary)' : 'transparent'}
                className="web-settings-nav-item"
                aria-current={page === id ? 'page' : undefined}
                style={{ border: 0, cursor: 'pointer', textAlign: 'left', font: 'inherit' }}
              >
                <Box component="span" flex="0 0 auto" w={20} h={20} mr="xs">
                  <ScalableIcon icon={icon} size={20} />
                </Box>
                <Text flex={1} lineClamp={1} span c="inherit">
                  {t(label)}
                </Text>
              </Flex>
            ))}
          </Stack>
          {(!small || page !== 'index') && (
            <Box id={`momo-settings-content-${page}`} flex="1 1 80%" className="web-settings-content">
              {children}
            </Box>
          )}
        </Flex>
      </Box>
    </Modal>
  );
}
