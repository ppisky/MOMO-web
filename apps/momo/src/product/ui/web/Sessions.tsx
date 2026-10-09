import React from 'react';
// Session row presentation migrated from MOMO-web SessionItem.tsx (GPL-3.0).
import { ActionIcon, Box, Flex, Modal, Stack, Text, TextInput, UnstyledButton, Button } from '@mantine/core';
import { IconPencil, IconSearch, IconMessageCircle2 } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProduct } from './context';
import { api } from './api';
import { addToast } from './media';
import { useIsSmallScreen, useUIStore } from './store';
export function SessionList({ filter = '', close }: { filter?: string; close?: () => void }) {
  const { data, navigate, reload } = useProduct();
  const { t } = useTranslation();
  const small = useIsSmallScreen();
  const setShowSidebar = useUIStore((s) => s.setShowSidebar);
  const [editing, setEditing] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const select = (id: string) => {
    navigate(`/session/${id}`);
    if (small) setShowSidebar(false);
    close?.();
  };
  return (
    <Box className="sidebar-session-list flex-1 min-h-0 overflow-y-auto" px="xs">
      {data.conversations
        .filter((s) => s.title.toLocaleLowerCase().includes(filter.toLocaleLowerCase()))
        .map((session) => (
          <Flex
            key={session.id}
            align="center"
            gap="xs"
            p="xs"
            className={`group/session-item rounded-lg cursor-pointer mb-1 ${data.selected?.id === session.id ? 'bg-chatbox-background-tertiary' : 'hover:bg-chatbox-background-secondary'}`}
          >
            <UnstyledButton
              className="flex items-center gap-xs flex-1 min-w-0"
              onClick={() => select(session.id)}
            >
              <IconMessageCircle2 size={18} className="shrink-0 text-chatbox-tint-secondary" />
              <Text size="sm" c="chatbox-secondary" truncate>
                {session.title}
              </Text>
            </UnstyledButton>
            <ActionIcon
              aria-label="重命名对话"
              variant="transparent"
              size={20}
              color="chatbox-tertiary"
              className="opacity-0 group-hover/session-item:opacity-100 focus:opacity-100"
              onClick={() => {
                setEditing(session.id);
                setTitle(session.title);
              }}
            >
              <IconPencil size={15} />
            </ActionIcon>
          </Flex>
        ))}
      {!data.conversations.length && (
        <Text size="xs" c="chatbox-tertiary" p="sm">
          {t('No conversations yet')}
        </Text>
      )}
      <Modal opened={!!editing} onClose={() => setEditing(null)} title={t('Rename')} centered>
        <Stack>
          <TextInput
            aria-label={t('Name')}
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            autoFocus
            maxLength={200}
          />
          <Button
            disabled={!title.trim()}
            onClick={() =>
              void api('/api/resources', {
                command: 'conversation-rename',
                spaceId: data.spaceId,
                id: editing,
                title,
              })
                .then(() => {
                  setEditing(null);
                  reload();
                })
                .catch((e) => addToast(e.message))
            }
          >
            {t('Save')}
          </Button>
        </Stack>
      </Modal>
    </Box>
  );
}
export function SearchChats({ opened, close }: { opened: boolean; close: () => void }) {
  const [filter, setFilter] = useState('');
  const { t } = useTranslation();
  return (
    <Modal opened={opened} onClose={close} title={t('Search chats')} size="lg" centered>
      <Stack>
        <TextInput
          autoFocus
          placeholder={t('Search')}
          leftSection={<IconSearch size={16} />}
          value={filter}
          onChange={(e) => setFilter(e.currentTarget.value)}
        />
        <SessionList filter={filter} close={close} />
      </Stack>
    </Modal>
  );
}
