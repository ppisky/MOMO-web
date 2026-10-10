import React from 'react';
import { MoStateSettings } from './MoStateSettings';
import { MocExport } from './MocExport';
import { Stack } from '@mantine/core';
import { ArchivedChats } from './ArchivedChats';
import { ProviderSettings } from './ProviderSettings';
import { Settings } from './Settings';
import { GeneralSettings } from './GeneralSettings';
import { ChatSettings } from './ChatSettings';
import { ModelParameters, RuntimeSettings } from './CoreSettings';
import { SpaceSettings } from '../../features/spaces/SpaceSettings';
import { useProduct } from './context';
export function ProductSettings({ page, onClose }: { page: string; onClose: () => void }) {
  const { data } = useProduct();
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
        <ArchivedChats key={data.spaceId} />
      ) : page === 'provider' ? (
        <ProviderSettings />
      ) : null}
    </Settings>
  );
}
