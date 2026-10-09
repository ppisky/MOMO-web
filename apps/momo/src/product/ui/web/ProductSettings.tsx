import React from 'react';
import { MoStateSettings } from './MoStateSettings';
import { MocExport } from './MocExport';
import { Stack, Text, Title } from '@mantine/core';
import { ProviderSettings } from './ProviderSettings';
import { useTranslation } from 'react-i18next';
import { Settings } from './Settings';
import { GeneralSettings } from './GeneralSettings';
import { ChatSettings } from './ChatSettings';
import { ModelParameters, RuntimeSettings } from './CoreSettings';
import { SpaceSettings } from '../../features/spaces/SpaceSettings';
import { useProduct } from './context';
export function ProductSettings({ page, onClose }: { page: string; onClose: () => void }) {
  const { data } = useProduct();
  const { t } = useTranslation();
  return (
    <Settings page={page} onClose={onClose}>
      {page === 'spaces' ? (
        <SpaceSettings initial={data.spaces} />
      ) : page === 'general' ? (
        <GeneralSettings />
      ) : page === 'chat' ? (
        <ChatSettings />
      ) : page === 'model-parameters' ? (
        <ModelParameters />
      ) : page === 'mo-state' ? (
        <MoStateSettings />
      ) : page === 'moc' ? (
        <MocExport />
      ) : page === 'memory' ? (
        <Stack p="md">
          <RuntimeSettings />
        </Stack>
      ) : page === 'archive' ? (
        <Stack p="md" gap="lg">
          <Title order={5}>{t('Archived Chats')}</Title>
          <Text size="sm" c="chatbox-secondary">
            对话归档与恢复尚未接入。现有对话仍保留在侧栏。
          </Text>
        </Stack>
      ) : page === 'provider' ? (
        <ProviderSettings />
      ) : null}
    </Settings>
  );
}
