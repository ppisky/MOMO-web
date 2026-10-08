const API_ORIGIN = 'https://api.chatboxai.app'

const POOL = [
  'https://api.chatboxai.app',
  'https://chatboxai.app',
  'https://api.ai-chatbox.com',
  'https://api.chatboxapp.xyz',
]

export function isChatboxAPI(input: RequestInfo | URL) {
  const url = typeof input === 'string' ? input : ((input as Request).url ?? input.toString())
  return POOL.some((o) => url.startsWith(o)) || url.startsWith(getChatboxAPIOrigin())
}

export function getChatboxAPIOrigin() {
  if (process.env.USE_LOCAL_API) {
    return 'http://localhost:8002'
  }
  if (process.env.USE_BETA_API) {
    return 'https://api-beta.chatboxai.app'
  }
  if (process.env.USE_NEWDB_API) {
    return 'https://beta-new-db.chatboxai.app'
  }
  return API_ORIGIN
}

/**
 * 按顺序测试 API 的可用性，只要有一个 API 域名可用，就终止测试并切换所有流量到该域名。
 * 在测试过程中，会根据服务器返回添加新的 API 域名，并缓存到本地
 */
export function testApiOrigins(): Promise<never[]> {
  return Promise.resolve([])
}
