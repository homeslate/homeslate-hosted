import { describe, expect, it } from 'vitest'
import { handler } from '../netlify/functions/displays'

describe('/api/displays Netlify function', () => {
  it('handles preflight without requiring database configuration', async () => {
    const response = await handler(
      { httpMethod: 'OPTIONS', headers: {} } as never,
      {} as never
    )

    expect(response).toMatchObject({ statusCode: 204 })
  })
})
