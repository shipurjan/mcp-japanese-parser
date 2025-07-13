import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals'
import {
  CircuitBreaker,
  checkRateLimit,
  cleanupRateLimits,
  handleToolError,
  sanitizeJapaneseText,
  validateToolInput,
  withTimeout,
} from '../error-handler.js'
import { IchiranError } from '../ichiran.js'

describe('error-handler module', () => {
  beforeEach(() => {
    // Clear any environment variables set in tests
    delete process.env.RATE_LIMIT_MAX
    delete process.env.MAX_TEXT_LENGTH
    delete process.env.NODE_ENV

    // Clear rate limit storage between tests
    cleanupRateLimits()

    // Clear all entries from rate limit map
    const requestCounts = new Map()
    requestCounts.clear()
  })

  afterEach(() => {
    // Clean up after each test
    jest.clearAllMocks()
  })

  describe('checkRateLimit', () => {
    it('should allow first request from new client', () => {
      const isLimited = checkRateLimit('client1')
      expect(isLimited).toBe(false)
    })

    it('should allow requests within rate limit', () => {
      const clientId = 'client2'

      // Make several requests within limit
      for (let i = 0; i < 5; i++) {
        const isLimited = checkRateLimit(clientId)
        expect(isLimited).toBe(false)
      }
    })

    it('should rate limit when threshold exceeded', () => {
      const clientId = 'client3'

      // Make requests up to default limit (60)
      for (let i = 0; i < 60; i++) {
        expect(checkRateLimit(clientId)).toBe(false)
      }

      // Next request should be rate limited
      expect(checkRateLimit(clientId)).toBe(true)
      expect(checkRateLimit(clientId)).toBe(true)
    })

    it('should reset rate limit after time window', () => {
      const clientId = 'client4'
      const originalDateNow = Date.now
      let mockTime = 1000000

      Date.now = jest.fn(() => mockTime)

      try {
        // Hit rate limit with default value (60)
        for (let i = 0; i < 60; i++) {
          expect(checkRateLimit(clientId)).toBe(false)
        }
        expect(checkRateLimit(clientId)).toBe(true)

        // Advance time beyond window
        mockTime += 61 * 1000 // 61 seconds

        // Should reset and allow requests again
        expect(checkRateLimit(clientId)).toBe(false)
      } finally {
        Date.now = originalDateNow
      }
    })

    it('should use default client id when none provided', () => {
      expect(checkRateLimit()).toBe(false)
      expect(checkRateLimit()).toBe(false)
    })
  })

  describe('cleanupRateLimits', () => {
    it('should remove expired entries', () => {
      const originalDateNow = Date.now
      let mockTime = 1000000

      Date.now = jest.fn(() => mockTime)

      try {
        // Create some entries
        checkRateLimit('client1')
        checkRateLimit('client2')

        // Advance time
        mockTime += 61 * 1000 // 61 seconds

        // Cleanup should remove old entries
        cleanupRateLimits()

        // New requests should start fresh counters
        expect(checkRateLimit('client1')).toBe(false)
      } finally {
        Date.now = originalDateNow
      }
    })
  })

  describe('handleToolError', () => {
    let consoleSpy: ReturnType<typeof jest.spyOn>

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        /* mock */
      })
    })

    afterEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      consoleSpy.mockRestore()
    })

    it('should handle IchiranError properly', () => {
      const ichiranError = new IchiranError('Test error', 'TEST_CODE', {
        detail: 'test',
      })
      const result = handleToolError(ichiranError)

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: 'Ichiran Error [TEST_CODE]: Test error',
          },
        ],
        isError: true,
      })
    })

    it('should handle IchiranError with context', () => {
      const ichiranError = new IchiranError('Test error', 'TEST_CODE')

      handleToolError(ichiranError, 'test-context')

      expect(consoleSpy).toHaveBeenCalledWith(
        'Tool error in test-context:',
        ichiranError,
      )
    })

    it('should handle generic Error without stack trace', () => {
      process.env.NODE_ENV = 'development'
      const error = new Error('Generic error')
      delete error.stack

      const result = handleToolError(error)

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: 'Internal Error: Generic error\n',
          },
        ],
        isError: true,
      })
    })

    it('should handle unknown error types', () => {
      const result = handleToolError('string error')

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: 'An unknown error occurred. Please try again.',
          },
        ],
        isError: true,
      })
    })

    it('should handle null/undefined errors', () => {
      expect(handleToolError(null)).toEqual({
        content: [
          {
            type: 'text',
            text: 'An unknown error occurred. Please try again.',
          },
        ],
        isError: true,
      })

      expect(handleToolError(undefined)).toEqual({
        content: [
          {
            type: 'text',
            text: 'An unknown error occurred. Please try again.',
          },
        ],
        isError: true,
      })
    })
  })

  describe('validateToolInput', () => {
    it('should return parsed input when valid', () => {
      const mockSchema = {
        parse: jest.fn().mockReturnValue({ validated: true }),
      }

      const result = validateToolInput(
        mockSchema,
        { test: 'input' },
        'testTool',
      )

      expect(result).toEqual({ validated: true })
      expect(mockSchema.parse).toHaveBeenCalledWith({ test: 'input' })
    })

    it('should handle Zod validation errors', () => {
      const zodError = {
        issues: [
          { path: ['field1'], message: 'Required' },
          { path: ['field2', 'nested'], message: 'Invalid type' },
        ],
      }

      const mockSchema = {
        parse: jest.fn().mockImplementation(() => {
          // eslint-disable-next-line @typescript-eslint/only-throw-error
          throw zodError
        }),
      }

      expect(() => validateToolInput(mockSchema, {}, 'testTool')).toThrow(
        'Invalid input for testTool:\nfield1: Required\nfield2.nested: Invalid type',
      )
    })

    it('should handle non-Zod errors', () => {
      const genericError = new Error('Generic validation error')
      const mockSchema = {
        parse: jest.fn().mockImplementation(() => {
          throw genericError
        }),
      }

      expect(() => validateToolInput(mockSchema, {}, 'testTool')).toThrow(
        genericError,
      )
    })

    it('should handle errors without issues property', () => {
      const errorWithoutIssues = { message: 'Error without issues' }
      const mockSchema = {
        parse: jest.fn().mockImplementation(() => {
          // eslint-disable-next-line @typescript-eslint/only-throw-error
          throw errorWithoutIssues
        }),
      }

      expect(() => validateToolInput(mockSchema, {}, 'testTool')).toThrow(
        errorWithoutIssues,
      )
    })
  })

  describe('sanitizeJapaneseText', () => {
    it('should return clean text unchanged', () => {
      const text = 'こんにちは世界'
      expect(sanitizeJapaneseText(text)).toBe(text)
    })

    it('should throw error for non-string input', () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
      expect(() => sanitizeJapaneseText(123 as any)).toThrow(
        'Text must be a string',
      )
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
      expect(() => sanitizeJapaneseText(null as any)).toThrow(
        'Text must be a string',
      )
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
      expect(() => sanitizeJapaneseText(undefined as any)).toThrow(
        'Text must be a string',
      )
    })

    it('should remove control characters', () => {
      const textWithControlChars = 'こんにちは\u0000\u0008\u001F世界'
      expect(sanitizeJapaneseText(textWithControlChars)).toBe('こんにちは世界')
    })

    it('should remove BOM characters', () => {
      const textWithBOM = '\uFEFFこんにちは\uFEFF世界\uFEFF'
      expect(sanitizeJapaneseText(textWithBOM)).toBe('こんにちは世界')
    })

    it('should trim whitespace', () => {
      const textWithWhitespace = '  こんにちは世界  '
      expect(sanitizeJapaneseText(textWithWhitespace)).toBe('こんにちは世界')
    })

    it('should throw error for empty text after sanitization', () => {
      expect(() => sanitizeJapaneseText('   ')).toThrow(
        'Text cannot be empty after sanitization',
      )
      expect(() => sanitizeJapaneseText('\u0000\u0008')).toThrow(
        'Text cannot be empty after sanitization',
      )
    })

    it('should check text length against default limit', () => {
      const longText = 'あ'.repeat(10001)
      expect(() => sanitizeJapaneseText(longText)).toThrow(
        'Text too long. Maximum length: 10000 characters',
      )
    })

    it('should check text length against custom limit', () => {
      process.env.MAX_TEXT_LENGTH = '5'
      const longText = 'あ'.repeat(6)
      expect(() => sanitizeJapaneseText(longText)).toThrow(
        'Text too long. Maximum length: 5 characters',
      )
    })

    it('should handle text at exactly the limit', () => {
      process.env.MAX_TEXT_LENGTH = '5'
      const text = 'あ'.repeat(5)
      expect(sanitizeJapaneseText(text)).toBe(text)
    })
  })

  describe('withTimeout', () => {
    it('should resolve when operation completes before timeout', async () => {
      const operation = Promise.resolve('success')

      const result = await withTimeout(operation, 1000, 'test-op')

      expect(result).toBe('success')
    })

    it('should reject when operation takes longer than timeout', async () => {
      const operation = new Promise((resolve) =>
        setTimeout(() => {
          resolve('late')
        }, 100),
      )

      await expect(withTimeout(operation, 50, 'test-op')).rejects.toThrow(
        "Operation 'test-op' timed out after 50ms",
      )
    })

    it('should reject when operation itself rejects', async () => {
      const operation = Promise.reject(new Error('operation failed'))

      await expect(withTimeout(operation, 1000, 'test-op')).rejects.toThrow(
        'operation failed',
      )
    })
  })

  describe('CircuitBreaker', () => {
    it('should start in CLOSED state', () => {
      const breaker = new CircuitBreaker()
      expect(breaker.getState()).toBe('CLOSED')
    })

    it('should execute operation successfully in CLOSED state', async () => {
      const breaker = new CircuitBreaker()
      const operation = jest
        .fn<() => Promise<string>>()
        .mockResolvedValue('success')

      const result = await breaker.execute(operation)

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalled()
      expect(breaker.getState()).toBe('CLOSED')
    })

    it('should transition to OPEN after failure threshold', async () => {
      const breaker = new CircuitBreaker(2, 60000) // 2 failures threshold
      const operation = jest
        .fn<() => Promise<string>>()
        .mockRejectedValue(new Error('failure'))

      // First failure
      await expect(breaker.execute(operation)).rejects.toThrow('failure')
      expect(breaker.getState()).toBe('CLOSED')

      // Second failure - should open circuit
      await expect(breaker.execute(operation)).rejects.toThrow('failure')
      expect(breaker.getState()).toBe('OPEN')
    })

    it('should reject immediately when in OPEN state', async () => {
      const breaker = new CircuitBreaker(1, 60000)
      const operation = jest
        .fn<() => Promise<string>>()
        .mockRejectedValue(new Error('failure'))

      // Trigger circuit to open
      await expect(breaker.execute(operation)).rejects.toThrow('failure')
      expect(breaker.getState()).toBe('OPEN')

      // Next call should be rejected immediately
      const fastOperation = jest
        .fn<() => Promise<string>>()
        .mockResolvedValue('success')
      await expect(breaker.execute(fastOperation)).rejects.toThrow(
        'Circuit breaker is OPEN - service unavailable',
      )
      expect(fastOperation).not.toHaveBeenCalled()
    })

    it('should transition to HALF_OPEN after timeout', async () => {
      const originalDateNow = Date.now
      let mockTime = 1000000
      Date.now = jest.fn(() => mockTime)

      try {
        const breaker = new CircuitBreaker(1, 1000) // 1 second timeout
        const failOperation = jest
          .fn<() => Promise<string>>()
          .mockRejectedValue(new Error('failure'))

        // Open the circuit
        await expect(breaker.execute(failOperation)).rejects.toThrow('failure')
        expect(breaker.getState()).toBe('OPEN')

        // Advance time past timeout
        mockTime += 1001

        // Next operation should transition to HALF_OPEN and succeed
        const successOperation = jest
          .fn<() => Promise<string>>()
          .mockResolvedValue('success')
        const result = await breaker.execute(successOperation)

        expect(result).toBe('success')
        expect(breaker.getState()).toBe('CLOSED')
      } finally {
        Date.now = originalDateNow
      }
    })

    it('should reset failure count on success', async () => {
      const breaker = new CircuitBreaker(2, 60000)
      const failOperation = jest
        .fn<() => Promise<string>>()
        .mockRejectedValue(new Error('failure'))
      const successOperation = jest
        .fn<() => Promise<string>>()
        .mockResolvedValue('success')

      // One failure
      await expect(breaker.execute(failOperation)).rejects.toThrow('failure')
      expect(breaker.getState()).toBe('CLOSED')

      // Success should reset counter
      await breaker.execute(successOperation)
      expect(breaker.getState()).toBe('CLOSED')

      // Another failure shouldn't open circuit yet
      await expect(breaker.execute(failOperation)).rejects.toThrow('failure')
      expect(breaker.getState()).toBe('CLOSED')
    })

    it('should use custom thresholds', async () => {
      const breaker = new CircuitBreaker(3, 60000) // 3 failures threshold
      const operation = jest
        .fn<() => Promise<string>>()
        .mockRejectedValue(new Error('failure'))

      // Should take 3 failures to open
      await expect(breaker.execute(operation)).rejects.toThrow('failure')
      expect(breaker.getState()).toBe('CLOSED')

      await expect(breaker.execute(operation)).rejects.toThrow('failure')
      expect(breaker.getState()).toBe('CLOSED')

      await expect(breaker.execute(operation)).rejects.toThrow('failure')
      expect(breaker.getState()).toBe('OPEN')
    })
  })
})
