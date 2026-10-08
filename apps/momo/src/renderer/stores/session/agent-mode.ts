import { ROLEPLAY_AGENT_MODE } from '@shared/momo-policy'
import type {
  AgentModeEntry,
  AgentModeLockReason,
  AgentModeValue,
  Session,
  SessionPromptContextSnapshot,
} from '@shared/types'
import { rendererApplication } from '@/app/renderer-application'

/** MOMO 只提供角色对话，历史工作模式配置也不会重新激活工具。 */
export function createDefaultAgentModeEntry(_smartSwitchingDefault?: boolean): AgentModeEntry {
  return ROLEPLAY_AGENT_MODE
}
export function createNewChatAgentModeEntry(
  _lastSelected?: AgentModeValue,
  _smartSwitchingDefault?: boolean
): AgentModeEntry {
  return ROLEPLAY_AGENT_MODE
}
export function getSessionAgentModeFromSession(_session: Pick<Session, 'settings'> | null | undefined): AgentModeEntry {
  return ROLEPLAY_AGENT_MODE
}
export function getSessionAgentModeEntry(
  _sessionId: string,
  _session?: Pick<Session, 'settings'> | null,
  _legacyMap?: Record<string, AgentModeEntry>
): AgentModeEntry {
  return ROLEPLAY_AGENT_MODE
}
export function useSessionAgentMode(_sessionId: string): AgentModeEntry {
  return ROLEPLAY_AGENT_MODE
}
export type SetAgentModeSource = 'user' | 'system'
export function setSessionAgentMode(
  _sessionId: string,
  _value: AgentModeValue,
  _options?: { source?: SetAgentModeSource }
): Promise<AgentModeEntry> {
  return Promise.resolve(ROLEPLAY_AGENT_MODE)
}
export function lockSessionAgentMode(
  _sessionId: string,
  _reason: Exclude<AgentModeLockReason, null>
): Promise<AgentModeEntry> {
  return Promise.resolve(ROLEPLAY_AGENT_MODE)
}

function requireSession<T extends Pick<Session, 'settings'>>(session: T | null | undefined): T {
  if (!session) throw new Error('Session not found')
  return session
}

/** Preserve the compare-and-swap protection on frozen story context. */
export function persistSessionPromptContextSnapshotGuarded(
  sessionId: string,
  snapshot: SessionPromptContextSnapshot,
  expectedCapturedAt: number | undefined
): void {
  const applySnapshot = <T extends Pick<Session, 'settings'>>(current: T | null | undefined): T => {
    const session = requireSession(current)
    if (session.settings?.sessionPromptContextSnapshot?.capturedAt !== expectedCapturedAt) return session
    return {
      ...session,
      settings: { ...(session.settings || {}), sessionPromptContextSnapshot: snapshot },
    } as T
  }
  rendererApplication.sessionQueryBridge.updateSessionCache(sessionId, (current) => applySnapshot(current))
  void rendererApplication.sessions.updateSession(sessionId, (current) => applySnapshot(current))
}
