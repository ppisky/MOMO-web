import type { ModelInterface } from '@shared/models/types'
import type { SandboxSeedAttachment } from '@shared/sandbox/attachment-path'
import type { SandboxProvider } from '@shared/sandbox-provider'
import type { KnowledgeBase, Message, SessionSettings, Settings } from '@shared/types'
import type { MemoryScope } from '@shared/types/agent-persona'
import type { ModelMessage, ToolSet } from 'ai'
export interface BuildToolsOptions {
  sessionId?: string
  webBrowsing: boolean
  knowledgeBase?: Pick<KnowledgeBase, 'id' | 'name'>
  messages: Message[]
  agentMode: 'on' | 'off'
  sessionSettings?: SessionSettings
  codeExecution?: {
    sessionId: string
    provider: SandboxProvider
    files: SandboxSeedAttachment[]
  }
  commandExecution?: {
    sessionId: string
    provider?: SandboxProvider
  }
  agentToolContractVersion?: 1 | 2
  onAgentModeActivated?: () => void
  /**
   * Settings snapshot from the generation request. Keeps tool registration and
   * prompt assembly on the same view of memoryEnabled/language within one
   * request; falls back to the live store for callers without one.
   */
  globalSettings?: Pick<Settings, 'memoryEnabled' | 'language'>
  /**
   * Frozen workspace-instructions text from the session's SessionPromptContextSnapshot.
   * When set (agent mode), it is used verbatim instead of re-reading AGENTS.md
   * from disk, keeping the system prompt prefix stable for provider caches.
   */
  workspaceInstructionsOverride?: string
  /**
   * Memory store the save/delete tools target. Copilot scope means the session's
   * copilot has its own memory enabled, which also supersedes the global memory
   * switch for tool registration. Defaults to the global store.
   */
  memoryScope?: MemoryScope
}

export interface BuildToolsResult {
  tools: ToolSet
  instructions: string
  /**
   * Step-message rewrite for protocols that cannot embed images in tool results:
   * inserts view_image results as follow-up user messages with real image parts.
   * Callers wire it into prepareStep's `messages` override.
   */
  prepareStepMessages?: (messages: ModelMessage[]) => Promise<ModelMessage[]>
}

/** 历史配置不能重新启用已移除的工作流工具。角色记忆由用户在角色页管理。 */
export function buildToolsForSession(_model: ModelInterface, _options: BuildToolsOptions): Promise<BuildToolsResult> {
  return Promise.resolve({ tools: {}, instructions: '' })
}
export function resetSkillsCache(): void {}
