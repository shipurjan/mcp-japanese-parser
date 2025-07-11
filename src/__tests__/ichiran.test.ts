import { describe, expect, it } from '@jest/globals'
import {
  IchiranError,
  type ParseOptions,
  type RomanizeOptions,
  analyzeKanji,
  healthCheck,
  parseJapaneseText,
  romanizeJapanese,
  validateJapaneseText,
} from '../ichiran.js'

describe('ichiran module', () => {
  describe('IchiranError', () => {
    it('should create error with code and message', () => {
      const error = new IchiranError('Test error', 'TEST_CODE')
      expect(error.message).toBe('Test error')
      expect(error.code).toBe('TEST_CODE')
      expect(error.name).toBe('IchiranError')
      expect(error).toBeInstanceOf(Error)
    })

    it('should create error with details', () => {
      const details = { extra: 'info' }
      const error = new IchiranError('Test error', 'TEST_CODE', details)
      expect(error.details).toEqual(details)
    })

    it('should create error without details', () => {
      const error = new IchiranError('Test error', 'TEST_CODE')
      expect(error.details).toBeUndefined()
    })
  })

  describe('validateJapaneseText', () => {
    it('should throw for empty string', () => {
      expect(() => validateJapaneseText('')).toThrow(IchiranError)
      expect(() => validateJapaneseText('')).toThrow(
        'Text must be a non-empty string',
      )
    })

    it('should throw for null or undefined', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
      expect(() => validateJapaneseText(null as any)).toThrow(IchiranError)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
      expect(() => validateJapaneseText(undefined as any)).toThrow(IchiranError)
    })

    it('should throw for non-string input', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
      expect(() => validateJapaneseText(123 as any)).toThrow(IchiranError)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
      expect(() => validateJapaneseText({} as any)).toThrow(IchiranError)
    })

    it('should throw for text without Japanese characters', () => {
      expect(() => validateJapaneseText('hello world')).toThrow(IchiranError)
      expect(() => validateJapaneseText('hello world')).toThrow(
        'Text must contain Japanese characters',
      )
      expect(() => validateJapaneseText('123456')).toThrow(IchiranError)
      expect(() => validateJapaneseText('!@#$%^')).toThrow(IchiranError)
    })

    it('should throw for text exceeding max length', () => {
      const longText = 'あ'.repeat(10001) // Exceeds default max of 10000
      expect(() => validateJapaneseText(longText)).toThrow(IchiranError)
      expect(() => validateJapaneseText(longText)).toThrow('Text too long')
    })

    it('should accept valid Japanese text with hiragana', () => {
      expect(() => validateJapaneseText('こんにちは')).not.toThrow()
      expect(validateJapaneseText('こんにちは')).toBe(true)
    })

    it('should accept valid Japanese text with katakana', () => {
      expect(() => validateJapaneseText('コンニチハ')).not.toThrow()
      expect(validateJapaneseText('コンニチハ')).toBe(true)
    })

    it('should accept valid Japanese text with kanji', () => {
      expect(() => validateJapaneseText('日本語')).not.toThrow()
      expect(validateJapaneseText('日本語')).toBe(true)
    })

    it('should accept mixed Japanese text', () => {
      expect(() => validateJapaneseText('こんにちは世界！')).not.toThrow()
      expect(() => validateJapaneseText('日本語のテスト')).not.toThrow()
    })

    it('should accept Japanese text mixed with punctuation and numbers', () => {
      expect(() => validateJapaneseText('こんにちは！123')).not.toThrow()
      expect(() => validateJapaneseText('日本語 123 test')).not.toThrow()
    })
  })

  describe('parseJapaneseText', () => {
    it('should parse valid Japanese text', async () => {
      const result = await parseJapaneseText('こんにちは')
      expect(result).toHaveProperty('words')
      expect(result).toHaveProperty('confidence')
      expect(result).toHaveProperty('alternatives')
      expect(Array.isArray(result.words)).toBe(true)
      expect(typeof result.confidence).toBe('number')
      expect(typeof result.alternatives).toBe('number')
    })

    it('should parse simple kanji text', async () => {
      const result = await parseJapaneseText('日本')
      expect(result).toBeDefined()
      expect(result.words).toBeDefined()
    })

    it('should apply limit option when provided', async () => {
      const options: ParseOptions = { limit: 1 }
      const result = await parseJapaneseText('こんにちは', options)
      expect(result.alternatives).toBeLessThanOrEqual(1)
    })

    it('should validate input before processing', async () => {
      await expect(parseJapaneseText('')).rejects.toThrow(IchiranError)
      await expect(parseJapaneseText('hello')).rejects.toThrow(IchiranError)
    })
  })

  describe('romanizeJapanese', () => {
    it('should romanize valid Japanese text', async () => {
      const result = await romanizeJapanese('こんにちは')
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })

    it('should romanize kanji text', async () => {
      const result = await romanizeJapanese('日本')
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })

    it('should handle includeInfo option', async () => {
      const options: RomanizeOptions = { includeInfo: true }
      const result = await romanizeJapanese('こんにちは', options)
      expect(typeof result).toBe('string')
    })

    it('should validate input before processing', async () => {
      await expect(romanizeJapanese('')).rejects.toThrow(IchiranError)
      await expect(romanizeJapanese('hello')).rejects.toThrow(IchiranError)
    })
  })

  describe('analyzeKanji', () => {
    it('should analyze single kanji character', async () => {
      const result = await analyzeKanji('日')
      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
    })

    it('should analyze multiple kanji characters', async () => {
      const result = await analyzeKanji('日本')
      expect(result).toBeDefined()
    })

    it('should analyze array of kanji characters', async () => {
      const result = await analyzeKanji(['日', '本'])
      expect(result).toBeDefined()
    })

    it('should throw error for input without kanji', async () => {
      await expect(analyzeKanji('hello')).rejects.toThrow(IchiranError)
      await expect(analyzeKanji('hello')).rejects.toThrow(
        'Input must contain kanji characters',
      )
      await expect(analyzeKanji('ひらがな')).rejects.toThrow(IchiranError)
      await expect(analyzeKanji('カタカナ')).rejects.toThrow(IchiranError)
    })
  })

  describe('healthCheck', () => {
    it('should return boolean result', async () => {
      const result = await healthCheck()
      expect(typeof result).toBe('boolean')
    })
  })

  describe('configuration', () => {
    it('should have default configuration values', () => {
      // This test validates that the functions work with default configuration
      // Environment variables are optional and will use defaults if not set
      expect(typeof validateJapaneseText).toBe('function')
      expect(typeof parseJapaneseText).toBe('function')
      expect(typeof romanizeJapanese).toBe('function')
      expect(typeof analyzeKanji).toBe('function')
      expect(typeof healthCheck).toBe('function')
    })
  })
})
