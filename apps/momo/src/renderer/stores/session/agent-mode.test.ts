import type { Session } from '@shared/types'
import { describe, expect, it, vi } from 'vitest'

const { updateSessionCache, updateSession } = vi.hoisted(() => ({
  updateSessionCache: vi.fn(),
  updateSession: vi.fn(),
}))
vi.mock('@/app/renderer-application', () => ({
  rendererApplication: {
    sessionQueryBridge: { updateSessionCache },
    sessions: { updateSession },
  },
}))

import {
  createNewChatAgentModeEntry,
  getSessionAgentModeEntry,
  lockSessionAgentMode,
  setSessionAgentMode,
} from './agent-mode'

describe('MOMO conversation mode', () => {
  it('ignores a persisted locked work mode', () => {
    const session = {
      settings: { agentMode: { value: 'on', locked: true, lockReason: 'message_sent' } },
    } satisfies Pick<Session, 'settings'>
    expect(getSessionAgentModeEntry('old', session)).toEqual({ value: 'off', locked: false, lockReason: null })
  })
  it('ignores legacy smart switching and last selection for new chats', () => {
    expect(createNewChatAgentModeEntry('on', true).value).toBe('off')
  })
  it('refuses tool-driven activation without mutating story data', async () => {
    expect((await setSessionAgentMode('old', 'on', { source: 'system' })).value).toBe('off')
    expect((await lockSessionAgentMode('new', 'message_sent')).value).toBe('off')
    expect(updateSessionCache).not.toHaveBeenCalled()
    expect(updateSession).not.toHaveBeenCalled()
  })
})
