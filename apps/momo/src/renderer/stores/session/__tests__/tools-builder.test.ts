import type { ModelInterface } from '@shared/models/types'
import { describe, expect, it, vi } from 'vitest'
import { buildToolsForSession } from '../tools-builder'

describe('MOMO roleplay tools', () => {
  it('cannot re-enable work, search, knowledge, or command tools from legacy settings', async () => {
    const supportsToolCalls = vi.fn()
    const result = await buildToolsForSession({ isSupportToolUse: supportsToolCalls } as unknown as ModelInterface, {
      webBrowsing: true,
      agentMode: 'on',
      messages: [],
      knowledgeBase: { id: 1, name: 'legacy' },
      sessionSettings: { agentMode: { value: 'on', locked: true, lockReason: 'message_sent' } },
    })
    expect(result.tools).toEqual({})
    expect(result.instructions).toBe('')
    expect(supportsToolCalls).not.toHaveBeenCalled()
  })
})
