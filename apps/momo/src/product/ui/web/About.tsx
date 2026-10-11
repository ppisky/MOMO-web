import { Anchor, Group, Stack, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { version } from '../../../../package.json';
import Page from './Page';

const projects = [
  ['Chatbox', 'https://github.com/chatboxai/chatbox'],
  ['React', 'https://github.com/facebook/react'],
  ['Mantine', 'https://github.com/mantinedev/mantine'],
  ['Material UI', 'https://github.com/mui/material-ui'],
  ['TanStack Router', 'https://github.com/TanStack/router'],
  ['Vite', 'https://github.com/vitejs/vite'],
] as const;

export function About({ coreVersion }: { coreVersion: string }) {
  const { t } = useTranslation();
  return (
    <Page title={t('About MOMO')}>
      <Stack p="xl" gap="lg">
        <Stack gap="xs">
          <Title order={3}>MOMO</Title>
          <Text>MOMO Web {version}</Text>
          <Text size="sm" c="chatbox-secondary">
            MOMO Core {coreVersion || t('Version unavailable')}
          </Text>
        </Stack>
        <Group gap="lg">
          <Anchor href="https://github.com/ppisky/MOMO-web" target="_blank" rel="noopener noreferrer">MOMO Web</Anchor>
          <Anchor href="https://github.com/ppisky/MOMO-core" target="_blank" rel="noopener noreferrer">MOMO Core</Anchor>
        </Group>
        <Stack gap="xs">
          <Text fw={600}>{t('Open-source projects')}</Text>
          <Group gap="lg">
            {projects.map(([name, url]) => (
              <Anchor key={name} href={url} target="_blank" rel="noopener noreferrer">{name}</Anchor>
            ))}
          </Group>
        </Stack>
        <Group gap="lg">
          <Anchor size="sm" href="https://github.com/ppisky/MOMO-web/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">GPL-3.0</Anchor>
          <Anchor size="sm" href="https://github.com/ppisky/MOMO-web/blob/main/public/brand/README.md" target="_blank" rel="noopener noreferrer">{t('MOMO logos')} · CC BY-SA 4.0</Anchor>
          <Anchor size="sm" href="https://github.com/ppisky/MOMO-web/blob/main/UPSTREAM.md" target="_blank" rel="noopener noreferrer">{t('Acknowledgements')}</Anchor>
        </Group>
      </Stack>
    </Page>
  );
}
