import type { AnalyticsEventParams } from '../shared/analytics'

// MOMO does not send analytics to the upstream application's account.
export async function event(_name: string, _params: AnalyticsEventParams = {}) {
  return undefined
}
