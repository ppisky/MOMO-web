/** MOMO 的产品边界；旧字段只为读取历史数据保留。 */
export const ROLEPLAY_AGENT_MODE = { value: 'off', locked: false, lockReason: null } as const

const unsupportedProviders = new Set(['chatbox-ai', 'qwen-portal', 'github-copilot'])

export function isMomoProvider(providerId: string | undefined): boolean {
  return Boolean(providerId && !unsupportedProviders.has(providerId))
}

const chatboxDomains = ['chatboxai.app', 'ai-chatbox.com', 'chatboxapp.xyz']

export function isChatboxServiceUrl(input: string | URL): boolean {
  try {
    const hostname = new URL(input).hostname.toLowerCase().replace(/\.$/, '')
    return chatboxDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))
  } catch {
    return false
  }
}

export function assertMomoRequestUrl(input: string | URL): void {
  if (isChatboxServiceUrl(input)) {
    throw new Error('MOMO 不提供 Chatbox 网络服务，请配置独立模型 API 或本地模型。')
  }
}
