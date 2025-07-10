import { IchiranError } from './ichiran.js'

export interface ErrorResponse {
  content: {
    type: 'text'
    text: string
  }[]
  isError: true
}

export interface RequestMetrics {
  timestamp: number
  count: number
}

// Rate limiting - simple in-memory store
const requestCounts = new Map<string, RequestMetrics>()
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX ?? '60')

/**
 * Check if request should be rate limited
 */
export function checkRateLimit(clientId = 'default'): boolean {
  const now = Date.now()
  const existing = requestCounts.get(clientId)

  if (!existing || now - existing.timestamp > RATE_LIMIT_WINDOW) {
    // Reset or initialize counter
    requestCounts.set(clientId, { timestamp: now, count: 1 })
    return false
  }

  if (existing.count >= RATE_LIMIT_MAX) {
    return true // Rate limited
  }

  // Increment counter
  existing.count++
  return false
}

/**
 * Clean up old rate limit entries
 */
export function cleanupRateLimits(): void {
  const now = Date.now()
  for (const [clientId, metrics] of requestCounts.entries()) {
    if (now - metrics.timestamp > RATE_LIMIT_WINDOW) {
      requestCounts.delete(clientId)
    }
  }
}

// Clean up every 5 minutes
setInterval(cleanupRateLimits, 5 * 60 * 1000)

/**
 * Standard error handler for MCP tool responses
 */
export function handleToolError(
  error: unknown,
  context?: string,
): ErrorResponse {
  console.error(
    `Tool error${context !== undefined ? ` in ${context}` : ''}:`,
    error,
  )

  if (error instanceof IchiranError) {
    return {
      content: [
        {
          type: 'text',
          text: `Ichiran Error [${error.code}]: ${error.message}`,
        },
      ],
      isError: true,
    }
  }

  if (error instanceof Error) {
    // Don't expose internal error details in production
    const isDevelopment = process.env.NODE_ENV === 'development'
    const message = isDevelopment
      ? `Internal Error: ${error.message}\n${error.stack ?? ''}`
      : 'An internal error occurred. Please try again.'

    return {
      content: [
        {
          type: 'text',
          text: message,
        },
      ],
      isError: true,
    }
  }

  return {
    content: [
      {
        type: 'text',
        text: 'An unknown error occurred. Please try again.',
      },
    ],
    isError: true,
  }
}

/**
 * Validate tool input with enhanced error messages
 */
export function validateToolInput<T>(
  schema: { parse: (input: unknown) => T },
  input: unknown,
  toolName: string,
): T {
  try {
    return schema.parse(input)
  } catch (error) {
    if (error && typeof error === 'object' && 'issues' in error) {
      // Zod validation error
      const zodError = error as {
        issues: { path: string[]; message: string }[]
      }
      const messages = zodError.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`,
      )

      throw new Error(`Invalid input for ${toolName}:\n${messages.join('\n')}`)
    }
    throw error
  }
}

/**
 * Input sanitization for Japanese text
 */
export function sanitizeJapaneseText(text: string): string {
  if (typeof text !== 'string') {
    throw new Error('Text must be a string')
  }

  // Remove potentially dangerous characters
  const sanitized = text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '') // Control characters
    .replace(/\uFEFF/g, '') // BOM
    .trim()

  if (!sanitized) {
    throw new Error('Text cannot be empty after sanitization')
  }

  // Check for reasonable length
  const maxLength = parseInt(process.env.MAX_TEXT_LENGTH ?? '10000')
  if (sanitized.length > maxLength) {
    throw new Error(
      `Text too long. Maximum length: ${maxLength.toString()} characters`,
    )
  }

  return sanitized
}

/**
 * Log performance metrics
 */
export function logPerformanceMetric(
  operation: string,
  duration: number,
  success: boolean,
): void {
  const timestamp = new Date().toISOString()
  const status = success ? 'SUCCESS' : 'FAILURE'

  console.error(
    `[METRICS] ${timestamp} ${operation} ${status} ${duration.toString()}ms`,
  )
}

/**
 * Async operation with timeout wrapper
 */
export async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  operationName: string,
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(
        new Error(
          `Operation '${operationName}' timed out after ${timeoutMs.toString()}ms`,
        ),
      )
    }, timeoutMs)
  })

  return Promise.race([operation, timeoutPromise])
}

/**
 * Circuit breaker pattern for external service calls
 */
export class CircuitBreaker {
  private failures = 0
  private lastFailureTime = 0
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'

  constructor(
    private readonly failureThreshold = 5,
    private readonly timeoutMs = 60000, // 1 minute
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeoutMs) {
        this.state = 'HALF_OPEN'
      } else {
        throw new Error('Circuit breaker is OPEN - service unavailable')
      }
    }

    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess(): void {
    this.failures = 0
    this.state = 'CLOSED'
  }

  private onFailure(): void {
    this.failures++
    this.lastFailureTime = Date.now()

    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN'
    }
  }

  getState(): string {
    return this.state
  }
}
