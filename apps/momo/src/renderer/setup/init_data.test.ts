import { expect, it, vi } from 'vitest'
import { initData } from './init_data'

const { getMetaStorage } = vi.hoisted(() => ({ getMetaStorage: vi.fn().mockResolvedValue({}) }))
vi.mock('@/stores/sessionHelpers', () => ({ getMetaStorage }))
it('initializes session storage without inserting sample conversations', async () => {
  await initData()
  expect(getMetaStorage).toHaveBeenCalledOnce()
})
