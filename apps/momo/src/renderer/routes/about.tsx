import { Anchor, Container, Flex, Image, Stack, Text, Title } from '@mantine/core'
import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import Page from '@/components/layout/Page'
import useVersion from '@/hooks/useVersion'
import icon from '@/static/momo-mark.svg'
export const Route = createFileRoute('/about')({ component: About })
function About() {
  const { t } = useTranslation()
  const { version } = useVersion()
  return (
    <Page title={t('About MOMO')}>
      <Container size="sm" py="xl">
        <Stack gap="xl">
          <Flex align="center" gap="lg">
            <Image src={icon} w={64} h={64} />
            <Stack gap={4}>
              <Title order={3}>MOMO</Title>
              <Text size="sm" c="chatbox-tertiary">
                {version}
              </Text>
            </Stack>
          </Flex>
          <Text>{t('Your characters. Your stories.')}</Text>
          <Text size="sm" c="chatbox-secondary">
            {t(
              'MOMO is a local roleplay app. Conversations, character settings and memories stay on this device. Connect models through your own API or local service.'
            )}
          </Text>
          <Stack gap="xs">
            <Text size="sm" c="chatbox-tertiary">
              {t('Based on Chatbox open-source code · GPL-3.0')}
            </Text>
            <Anchor href="https://github.com/chatboxai/chatbox" target="_blank" size="sm">
              {t('Chatbox source and original authors')}
            </Anchor>
            <Anchor href="https://www.gnu.org/licenses/gpl-3.0.html" target="_blank" size="sm">
              {t('GNU GPL v3 license')}
            </Anchor>
          </Stack>
        </Stack>
      </Container>
    </Page>
  )
}
