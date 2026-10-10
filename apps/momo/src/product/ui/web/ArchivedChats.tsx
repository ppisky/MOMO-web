import React, { useEffect, useState } from 'react';
// Archive row presentation adapted from the original Web settings/archive.tsx (GPL-3.0).
import {
  ActionIcon,
  Alert,
  Button,
  Flex,
  Group,
  Loader,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { IconArchiveOff, IconMessageCircle2 } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { conversation, list, type Conversation } from '../../contracts/core';
import { api } from './api';
import { useProduct } from './context';

export function ArchivedChats() {
  const { data, reload } = useProduct();
  const { t } = useTranslation();
  const [chats, setChats] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [restoring, setRestoring] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const spaceId = data.spaceId;

  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setError('');
    setChats([]);
    void api(`/api/resources?kind=archived-conversations&space=${spaceId}`, undefined, abort.signal)
      .then((value) => {
        if (!abort.signal.aborted) setChats(list(value, conversation));
      })
      .catch((failure) => {
        if (!abort.signal.aborted) setError(failure.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [spaceId, revision]);

  const restore = async (id: string) => {
    setRestoring(id);
    setError('');
    try {
      await api('/api/resources', { command: 'conversation-restore', spaceId, id });
      setChats((current) => current.filter((chat) => chat.id !== id));
      reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '恢复失败');
    } finally {
      setRestoring(null);
    }
  };

  return (
    <Stack p="md" gap="xl">
      <Stack gap="xxs">
        <Title order={5}>{t('Archived Chats')}</Title>
        <Text size="sm" c="chatbox-tertiary">
          归档对话会从对话列表中隐藏。恢复后保留原来的角色和全部消息。
        </Text>
      </Stack>
      {error && (
        <Alert color="red" title="读取或恢复失败">
          {error}
          <Button size="xs" variant="subtle" onClick={() => setRevision((v) => v + 1)}>
            {t('Retry')}
          </Button>
        </Alert>
      )}
      {loading ? (
        <Flex justify="center" py="xl">
          <Loader size="sm" />
        </Flex>
      ) : chats.length ? (
        <Stack gap={0}>
          {chats.map((chat) => (
            <Flex
              key={chat.id}
              align="center"
              gap="sm"
              py="sm"
              className="border-0 border-b border-solid border-chatbox-border-primary"
            >
              <IconMessageCircle2 size={20} className="shrink-0 text-chatbox-tint-secondary" />
              <Stack gap={2} flex={1} miw={0}>
                <Text lineClamp={1}>{chat.title}</Text>
                <Text size="xs" c="chatbox-tertiary">
                  {data.characters.find((role) => role.id === chat.character_id)?.name ?? t('Chat')}{' '}
                  · {chat.archived_at ? new Date(chat.archived_at).toLocaleString() : ''}
                </Text>
              </Stack>
              <Group gap={4}>
                <Tooltip label={t('Restore')} withArrow>
                  <ActionIcon
                    aria-label={`${t('Restore')}：${chat.title}`}
                    variant="subtle"
                    color="chatbox-tertiary"
                    loading={restoring === chat.id}
                    disabled={restoring !== null && restoring !== chat.id}
                    onClick={() => void restore(chat.id)}
                  >
                    <IconArchiveOff size={18} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Flex>
          ))}
        </Stack>
      ) : (
        !error && (
          <Stack align="center" gap="sm" py="xl">
            <Text c="chatbox-tertiary">{t('No archived chats')}</Text>
          </Stack>
        )
      )}
    </Stack>
  );
}
