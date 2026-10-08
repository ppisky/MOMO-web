import { ActionIcon, Badge, Box, Button, Flex, Loader, Paper, Stack, Text, Textarea } from '@mantine/core'
import type { MemoryEntry } from '@shared/types/agent-persona'
import { MEMORY_ENTRY_MAX_CHARS, MEMORY_MAX_ENTRIES } from '@shared/types/agent-persona'
import { IconTrash } from '@tabler/icons-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { addCopilotMemory, deleteCopilotMemory, listCopilotMemories } from '@/stores/agentPersonaStore'

/** 手动管理角色的故事记忆，不依赖工具模式或在线服务。 */
export function CopilotMemoriesList({ copilotId }: { copilotId: string }) {
  const { t } = useTranslation()
  const [memories, setMemories] = useState<MemoryEntry[] | null>(null)
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    listCopilotMemories(copilotId)
      .catch(() => {
        setError(t('Could not load memories. Reopen character settings.'))
        return []
      })
      .then((entries) => {
        if (!cancelled) setMemories(entries)
      })
    return () => {
      cancelled = true
    }
  }, [copilotId, t])

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteCopilotMemory(copilotId, id)
        setMemories((current) => (current ?? []).filter((entry) => entry.id !== id))
      } catch {
        setError(t('Could not delete the memory. Please try again.'))
      }
    },
    [copilotId, t]
  )

  const handleAdd = async () => {
    if (saving || !content.trim()) return
    setSaving(true)
    setError('')
    try {
      const result = await addCopilotMemory(copilotId, content)
      if (!result.ok) {
        setError(t('Could not save: check for duplicates or the memory limit.'))
        return
      }
      setMemories((current) => [...(current ?? []), result.entry])
      setContent('')
    } catch {
      setError(t('Could not save the memory. Please try again.'))
    } finally {
      setSaving(false)
    }
  }

  if (memories === null) {
    return (
      <Flex justify="center" py="sm">
        <Loader size="sm" />
      </Flex>
    )
  }

  return (
    <Stack gap="xs">
      <Flex align="center" gap="xs">
        <Text size="sm" fw={500}>
          {t('Story memories')}
        </Text>
        <Badge size="sm" variant="light" color="chatbox-secondary">
          {memories.length}/{MEMORY_MAX_ENTRIES}
        </Badge>
      </Flex>
      {memories.length === 0 ? (
        <Text size="sm" c="dimmed" fs="italic">
          {t('Record relationships, key events or promises to carry the story into a new chapter.')}
        </Text>
      ) : (
        <Stack gap={6}>
          {memories.map((entry) => (
            <Paper key={entry.id} withBorder radius="md" p="xs">
              <Flex align="flex-start" gap="xs">
                <Box flex={1}>
                  <Text size="sm" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {entry.content}
                  </Text>
                  <Text size="xs" c="dimmed" mt={2}>
                    {new Date(entry.createdAt).toLocaleDateString()}
                  </Text>
                </Box>
                <ActionIcon
                  variant="subtle"
                  color="chatbox-error"
                  size="sm"
                  aria-label={t('Delete')}
                  onClick={() => void handleDelete(entry.id)}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Flex>
            </Paper>
          ))}
        </Stack>
      )}
      <Textarea
        label={t('Add memory')}
        placeholder={t('For example: We promised to meet at the clock tower on the winter solstice.')}
        value={content}
        onChange={(event) => setContent(event.currentTarget.value)}
        maxLength={MEMORY_ENTRY_MAX_CHARS}
        autosize
        minRows={2}
        maxRows={4}
        error={error || undefined}
        disabled={saving}
      />
      <Button
        size="xs"
        variant="light"
        loading={saving}
        disabled={!content.trim() || memories.length >= MEMORY_MAX_ENTRIES}
        onClick={() => void handleAdd()}
        style={{ alignSelf: 'flex-end' }}
      >
        {t('Save memory')}
      </Button>
    </Stack>
  )
}
