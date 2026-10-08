/** 自定义 API 只按协议补路径，不根据服务商域名改写地址。 */
export function normalizeCustomApiEndpoint(
  options: { apiHost: string; apiPath?: string },
  standardPath = '/chat/completions'
) {
  const endpoint = new URL(options.apiHost.trim())
  if (
    !['http:', 'https:'].includes(endpoint.protocol) ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash
  ) {
    throw new Error('Use an HTTP or HTTPS API endpoint without credentials, query or fragment.')
  }
  let apiHost = endpoint.href.replace(/\/$/, '')
  let apiPath = options.apiPath?.trim()
  if (apiPath) {
    if (!apiPath.startsWith('/')) apiPath = `/${apiPath}`
  } else if (apiHost.endsWith(standardPath)) {
    apiHost = apiHost.slice(0, -standardPath.length)
    apiPath = standardPath
  } else {
    if (endpoint.pathname === '/') apiHost += '/v1'
    apiPath = standardPath
  }
  return { apiHost, apiPath }
}
