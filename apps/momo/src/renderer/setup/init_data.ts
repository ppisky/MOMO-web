import { getMetaStorage } from '@/stores/sessionHelpers'

/** 新安装只初始化会话存储，不写入示例对话。 */
export async function initData() { await getMetaStorage() }
