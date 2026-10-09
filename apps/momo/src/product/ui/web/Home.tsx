import React from 'react';
// Migrated from MOMO-web routes/index.tsx (GPL-3.0).
import { Box, Button, Flex, Stack, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import InputBox from './InputBox';
import HomepageIcon from './HomepageIcon';
import Page from './Page';
import { useProduct } from './context';
export function Home({ onSubmit }: { onSubmit: (text: string) => Promise<void> }) {
  const { t } = useTranslation();
  const { data, selectedRole: selectedRoleId, selectRole, navigate, openSettings } = useProduct();
  const selectedRole = data.characters.find((role) => role.id === selectedRoleId);
  const widthFull = false;
  return (
    <Page title="">
      <Stack h="100%" gap="md" style={{ minHeight: 0 }}>
        <Stack
          align="center"
          justify="center"
          gap="sm"
          flex={1}
          px="xl"
          style={{ minHeight: 0, overflowY: 'auto' }}
        >
          <HomepageIcon className="h-12 w-12 mb-2" />
          <Text size="xl" fw={600}>
            {selectedRole
              ? t('Start a new story with {{name}}', { name: selectedRole.name })
              : t('A story starts here')}
          </Text>
          <Text size="sm" c="chatbox-secondary" ta="center" maw={480}>
            {selectedRole
              ? selectedRole.character_markdown || t('Your character is ready. Write your first line.')
              : t('Choose a character, or describe a world to enter.')}
          </Text>
          {!data.characters.length && !selectedRole && (
            <Button onClick={() => navigate('/copilots')} variant="light" radius="lg" mt="sm">
              {t('Create your first character')}
            </Button>
          )}
        </Stack>
        {!!data.characters.length && (
          <Box px="md" className={widthFull ? 'w-full' : 'w-full max-w-4xl mx-auto'}>
            <Flex gap="xs" wrap="wrap" align="center">
              <Text size="xs" c="chatbox-tertiary">
                {t('Roles')}
              </Text>
              {data.characters.slice(0, 8).map((role) => (
                <Button
                  key={role.id}
                  onClick={() => {
                    selectRole(role.id);
                  }}
                  variant={selectedRoleId === role.id ? 'light' : 'default'}
                  size="compact-sm"
                  radius="lg"
                >
                  {role.name}
                </Button>
              ))}
              {selectedRoleId && (
                <Button
                  onClick={() => {
                    selectRole(null);
                  }}
                  variant="subtle"
                  size="compact-sm"
                >
                  {t('Free conversation')}
                </Button>
              )}
              <Button onClick={() => navigate('/copilots')} variant="subtle" size="compact-sm">
                {t('Manage characters')}
              </Button>
            </Flex>
          </Box>
        )}
        <InputBox onSubmit={onSubmit} onSettings={() => openSettings('chat')} />
      </Stack>
    </Page>
  );
}
