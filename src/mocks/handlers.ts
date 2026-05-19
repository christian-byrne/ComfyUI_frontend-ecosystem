import type { RegistryNode } from '@/types/registry'

import { http, HttpResponse } from 'msw'

import { REGISTRY_BASE_URL } from '@/services/registryApi'

export const handlers = [
  http.get(`${REGISTRY_BASE_URL}/nodes/:packId`, ({ params }) => {
    const packId = params.packId as string
    const fake: RegistryNode = {
      id: packId,
      name: `Mock ${packId}`,
      description: `Mock description for ${packId}`,
      author: 'mock-publisher',
      publisher: { id: 'mock-publisher', name: 'Mock Publisher' },
      downloads: 12345,
      github_stars: 999,
      banner_url: `https://example.com/banner-${packId}.png`
    }
    return HttpResponse.json(fake)
  })
]

export const serverErrorHandler = http.get(`${REGISTRY_BASE_URL}/nodes/:packId`, () =>
  HttpResponse.json({ message: 'Internal Server Error' }, { status: 500 })
)

export const notFoundHandler = http.get(`${REGISTRY_BASE_URL}/nodes/:packId`, () =>
  HttpResponse.json({ message: 'Not found' }, { status: 404 })
)
