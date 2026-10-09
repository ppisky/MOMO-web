import React from 'react';
// MOMO-web copilots/index.tsx and CopilotItem.tsx presentation (GPL-3.0).
import {
  ActionIcon,
  Button,
  Flex,
  Grid,
  Highlight,
  Modal,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { IconEdit, IconMessageCircle2Filled, IconPlus, IconSearch } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { conversation, type Character } from '../../contracts/core';
import Page from './Page';
import { useProduct } from './context';
import { api } from './api';
import { addToast } from './media';
export function Roles() {
  const { t } = useTranslation();
  const { data, navigate, selectRole, reload } = useProduct();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Character | 'new' | null>(null);
  const [name, setName] = useState('');
  const [persona, setPersona] = useState('');
  const [details, setDetails] = useState({
    version: '2.0.0',
    author_name: '',
    author_url: '',
    user_markdown: '',
    opening_markdown: '',
  });
  const [busy, setBusy] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  function edit(role: Character | 'new') {
    setEditing(role);
    setName(role === 'new' ? '' : role.name);
    setPersona(role === 'new' ? '' : role.character_markdown);
    setDetails(
      role === 'new'
        ? {
            version: '2.0.0',
            author_name: '',
            author_url: '',
            user_markdown: '',
            opening_markdown: '',
          }
        : {
            version: role.version,
            author_name: role.author_name,
            author_url: role.author_url ?? '',
            user_markdown: role.user_markdown,
            opening_markdown: role.opening_markdown ?? '',
          }
    );
  }
  async function startRole(role: Character) {
    if (starting) return;
    setStarting(role.id);
    try {
      const created = conversation(
        await api('/api/conversations', { spaceId: data.spaceId, characterId: role.id })
      );
      selectRole(role.id);
      navigate(`/session/${created.id}`);
    } catch (e) {
      addToast(e instanceof Error ? e.message : '无法创建对话');
    } finally {
      setStarting(null);
    }
  }
  async function save() {
    setBusy(true);
    try {
      await api(editing === 'new' ? '/api/characters' : '/api/resources', {
        spaceId: data.spaceId,
        name,
        persona,
        ...details,
        author_url: details.author_url || null,
        opening_markdown: details.opening_markdown || null,
        ...(editing && editing !== 'new' ? { command: 'character-save', id: editing.id } : {}),
      });
      setEditing(null);
      reload();
    } catch (e) {
      addToast(e instanceof Error ? e.message : '无法保存角色');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page title={t('Roles')}>
      <Stack p="md" gap="lg" className="max-w-7xl mx-auto">
        <Flex justify="space-between" align="center" gap="sm" wrap="wrap">
          <Text c="chatbox-secondary" size="sm">
            {t('Define personality, world and memories for your characters.')}
          </Text>
          <Button radius="lg" leftSection={<IconPlus size={16} />} onClick={() => edit('new')}>
            {t('Create character')}
          </Button>
        </Flex>
        <TextInput
          maw={360}
          placeholder={t('Search characters')}
          aria-label={t('Search characters')}
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
        />
        <Grid gutter="md">
          {data.characters
            .filter((r) =>
              (r.name + ' ' + r.character_markdown).toLowerCase().includes(search.toLowerCase())
            )
            .map((role) => (
              <Grid.Col key={role.id} span={{ base: 12, md: 6, xl: 4 }}>
                <Stack
                  className="group relative p-xs gap-xs rounded-lg border border-solid border-chatbox-border-primary bg-chatbox-background-primary cursor-pointer"
                  onClick={() => edit(role)}
                >
                  <Flex align="center" gap="xs">
                    <Stack
                      w={36}
                      h={36}
                      align="center"
                      justify="center"
                      className="rounded-lg bg-chatbox-background-brand-secondary shrink-0"
                    >
                      <IconMessageCircle2Filled size={20} className="text-chatbox-tint-brand" />
                    </Stack>
                    <Highlight
                      highlight={search}
                      fw={600}
                      size="sm"
                      c="chatbox-secondary"
                      lineClamp={2}
                      className="flex-1 leading-snug"
                    >
                      {role.name}
                    </Highlight>
                    <ActionIcon
                      aria-label={t('Edit')}
                      variant="subtle"
                      color="chatbox-secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        edit(role);
                      }}
                    >
                      <IconEdit size={18} />
                    </ActionIcon>
                  </Flex>
                  <Text size="sm" c="chatbox-secondary" lineClamp={3}>
                    {role.character_markdown}
                  </Text>
                  <Text size="xs" c="chatbox-tertiary">
                    {role.author_name} · v{role.version}
                  </Text>
                  <Button
                    variant="light"
                    loading={starting === role.id}
                    disabled={!!starting}
                    radius="lg"
                    size="xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      void startRole(role);
                    }}
                  >
                    {t('New Chat')}
                  </Button>
                </Stack>
              </Grid.Col>
            ))}
        </Grid>
        {!data.characters.length && (
          <Stack align="center" py={60}>
            <Text fw={500}>{t('No characters yet')}</Text>
            <Text size="sm" c="chatbox-tertiary">
              {t('Create your first character')}
            </Text>
          </Stack>
        )}
      </Stack>
      <Modal
        opened={!!editing}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? t('Create character') : t('Edit')}
        centered
        size="lg"
      >
        <Stack gap="md">
          <TextInput
            label={t('Name')}
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            maxLength={120}
            required
          />
          <Flex gap="sm">
            <TextInput
              flex={1}
              label="作者"
              required
              value={details.author_name}
              onChange={(e) => setDetails({ ...details, author_name: e.currentTarget.value })}
            />
            <TextInput
              w={130}
              label="角色版本"
              required
              placeholder="2.0.0"
              value={details.version}
              onChange={(e) => setDetails({ ...details, version: e.currentTarget.value })}
            />
          </Flex>
          <TextInput
            label="作者链接"
            placeholder="https://"
            value={details.author_url}
            onChange={(e) => setDetails({ ...details, author_url: e.currentTarget.value })}
          />
          <Textarea
            label="人物设定"
            description="人物的性格、背景和说话方式。"
            value={persona}
            onChange={(e) => setPersona(e.currentTarget.value)}
            autosize
            minRows={5}
            maxRows={18}
            maxLength={16000}
            required
          />
          <Textarea
            label="用户设定"
            description="角色面对的用户身份与背景，参与角色对话上下文。"
            autosize
            minRows={3}
            maxRows={10}
            maxLength={16000}
            value={details.user_markdown}
            onChange={(e) => setDetails({ ...details, user_markdown: e.currentTarget.value })}
          />
          <Textarea
            label="开场白"
            description="新建对话时成为第一条助手消息，参与后续上下文；修改不会改写已有对话。"
            autosize
            minRows={3}
            maxRows={10}
            maxLength={16000}
            value={details.opening_markdown}
            onChange={(e) => setDetails({ ...details, opening_markdown: e.currentTarget.value })}
          />
          <Flex justify="flex-end" gap="sm">
            <Button variant="subtle" onClick={() => setEditing(null)}>
              {t('Cancel')}
            </Button>
            <Button
              disabled={!name.trim() || !details.author_name.trim() || !details.version.trim()}
              loading={busy}
              onClick={() => void save()}
            >
              {t('Save')}
            </Button>
          </Flex>
        </Stack>
      </Modal>
    </Page>
  );
}
