import { describe, expect, it } from '@jest/globals'
import { healthCheck } from '../ichiran.js'

describe('ichiran-cli', () => {
  describe('healthCheck', () => {
    it('checks whether the container with the ichiran-cli command is available', async () => {
      const isHealthy = await healthCheck()
      expect(isHealthy).toBe(true)
    })
  })
})
