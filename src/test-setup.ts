import { afterAll, afterEach, beforeAll, vi } from 'vitest'
import { server } from '@/mocks/server'

vi.mock('@unhead/vue', () => ({
  useHead: vi.fn()
}))

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
