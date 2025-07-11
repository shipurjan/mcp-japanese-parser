import { describe, expect, it } from '@jest/globals'
import { healthCheck, validateJapaneseText } from '../ichiran.js'

describe('ichiran-cli', () => {
  describe('healthCheck', () => {
    it('checks whether the node wrapper for ichiran-cli is working', async () => {
      const isHealthy = await healthCheck()
      expect(isHealthy).toBe(true)
    })
  })

  describe('validateJapaneseText', () => {
    it('validates whether string is empty', () => {
      expect(() => validateJapaneseText('')).toThrow()
    })

    it('validates whether string is Japanese lanauge', () => {
      expect(() => validateJapaneseText('asdf')).toThrow()
      expect(() => validateJapaneseText('こんにちは')).not.toThrow()
    })
  })
})
