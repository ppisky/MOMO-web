import type { MarketplaceSkill, SkillInfo, SkillMetadata } from '@shared/types/skills'
import type { UserExecApprovalSource } from '@shared/types/user-exec'

interface SkillScriptResult {
  success: boolean
  stdout: string
  stderr: string
  exitCode: number | null
  cancelled?: boolean
  cwd?: string
  outputFile?: string
}

interface SkillInstallResult {
  success: boolean
  skillName: string
  error?: string
}

interface SkillUpdateResult {
  hasUpdate: boolean
  currentHash?: string
  latestHash?: string
  error?: string
}

const skillsChangeListeners = new Set<() => void>()

export function notifySkillsChanged(): void {
  for (const listener of skillsChangeListeners) {
    listener()
  }
}

export function subscribeSkillsChanged(listener: () => void): () => void {
  skillsChangeListeners.add(listener)
  return () => {
    skillsChangeListeners.delete(listener)
  }
}

// These interfaces remain for retired upstream components; no native operations run in the browser.
function unavailable(): Promise<never> {
  return Promise.reject(new Error('Local skills and command execution are unavailable in MOMO Web'))
}

export const skillsController = {
  discoverSkills(): Promise<SkillInfo[]> {
    return unavailable()
  },

  loadSkill(
    _name: string
  ): Promise<{ metadata: SkillMetadata; body: string; skillRoot?: string; files?: string[] } | null> {
    return unavailable()
  },

  getSkillsDirectory(): Promise<string> {
    return unavailable()
  },

  openSkillsDirectory(): Promise<void> {
    return unavailable()
  },

  executeScript(_skillName: string, _scriptName: string, _args?: string[]): Promise<SkillScriptResult> {
    return unavailable()
  },

  installSkill(_owner: string, _repo: string, _skillPath: string): Promise<SkillInstallResult> {
    return unavailable()
  },

  installFromSandbox(_sandboxPath: string, _sessionId?: string, _sourceInfo?: string): Promise<SkillInstallResult> {
    return unavailable()
  },

  userExec(
    _command: string,
    _options?: {
      cwd?: string
      timeout?: number
      sessionId?: string
      toolCallId?: string
      approvalSource?: UserExecApprovalSource
      retryOf?: string
      shell?: 'bash' | 'powershell'
      baseCwd?: string
      injectBundledNode?: boolean
    }
  ): Promise<SkillScriptResult> {
    return unavailable()
  },

  resolveUserExecCwd(_options: { cwd?: string; baseCwd?: string }): Promise<string> {
    return unavailable()
  },

  resolveCommandRetry(_options: {
    sessionId: string
    retryOf?: string
    command: string
    cwd: string
    shell: 'bash' | 'powershell'
  }): Promise<{ valid: true; retryOf: string } | { valid: false; error: string }> {
    return unavailable()
  },

  cancelUserExec(_options: { sessionId?: string; toolCallId: string }): Promise<{ killed: boolean }> {
    return unavailable()
  },

  installMarketplaceSkill(_skill: MarketplaceSkill): Promise<SkillInstallResult> {
    return unavailable()
  },

  deleteSkill(_name: string): Promise<{ success: boolean; error?: string }> {
    return unavailable()
  },

  scanRepo(_owner: string, _repo: string): Promise<Array<{ name: string; path: string; description?: string }>> {
    return unavailable()
  },

  checkForUpdate(_name: string): Promise<SkillUpdateResult> {
    return unavailable()
  },

  checkForUpdatesBatch(): Promise<Record<string, { hasUpdate: boolean; error?: string }>> {
    return unavailable()
  },

  syncBuiltinSkills(_lang?: string): Promise<{ changed: boolean }> {
    return unavailable()
  },
}
