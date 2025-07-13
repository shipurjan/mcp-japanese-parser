import { z } from 'zod'
import { $ } from 'zx'

export class IchiranError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown,
  ) {
    super(message)
    this.name = 'IchiranError'
  }
}

// Configuration
const config = {
  timeout: parseInt(process.env.ICHIRAN_TIMEOUT ?? '30000'),
  containerName: process.env.ICHIRAN_CONTAINER_NAME ?? 'ichiran-main-1',
}

// Validation schemas
const textSchema = z.string().min(1).max(10000)
const limitSchema = z.number().int().min(1).max(20)
const expressionSchema = z.string().min(1)

/**
 * Execute ichiran-cli command in container
 */
async function exec(args: string[]): Promise<string> {
  try {
    $.verbose = false

    const result = await $({
      timeout: config.timeout,
      nothrow: true,
    })`docker exec ${config.containerName} ichiran-cli ${args}`

    if (result.exitCode !== 0) {
      if (result.stderr.includes('No such container')) {
        throw new IchiranError(
          `Container '${config.containerName}' not running`,
          'CONTAINER_NOT_FOUND',
        )
      }
      throw new IchiranError(
        `Command failed: ${result.stderr}`,
        'COMMAND_FAILED',
        { exitCode: result.exitCode },
      )
    }

    return result.stdout.trim()
  } catch (error) {
    if (error instanceof IchiranError) {
      throw error
    }

    if (error instanceof Error && error.message.includes('timeout')) {
      throw new IchiranError('Processing timeout exceeded', 'TIMEOUT')
    }

    throw new IchiranError(
      `Execution failed: ${error instanceof Error ? error.message : String(error)}`,
      'EXECUTION_ERROR',
      { originalError: error },
    )
  }
}

/**
 * Default romanization (calls ichiran:romanize)
 */
export async function romanize(text: string): Promise<string> {
  const validText = textSchema.parse(text)
  return await exec([validText])
}

/**
 * Romanization with dictionary information (-i/--with-info)
 */
export async function romanizeWithInfo(text: string): Promise<string> {
  const validText = textSchema.parse(text)
  return await exec(['-i', validText])
}

/**
 * Full analysis as JSON (-f/--full)
 */
export async function analyze(text: string): Promise<unknown> {
  const validText = textSchema.parse(text)
  const result = await exec(['-f', validText])
  return JSON.parse(result)
}

/**
 * Full analysis with multiple segmentation alternatives (-f -l/--full --limit)
 */
export async function analyzeWithLimit(
  text: string,
  limit: number,
): Promise<unknown> {
  const validText = textSchema.parse(text)
  const validLimit = limitSchema.parse(limit)

  const result = await exec(['-f', '-l', validLimit.toString(), validText])
  return JSON.parse(result)
}

/**
 * Evaluate arbitrary Lisp expression (-e/--eval)
 */
export async function evaluate(expression: string): Promise<string> {
  const validExpression = expressionSchema.parse(expression)
  return await exec(['-e', validExpression])
}

/**
 * Health check - test if service is available
 */
export async function healthCheck(): Promise<boolean> {
  try {
    await exec(['--help'])
    return true
  } catch {
    return false
  }
}

/**
 * Get help information (-h/--help)
 */
export async function help(): Promise<string> {
  return await exec(['--help'])
}

// Export convenience functions for backwards compatibility
export const romanizeJapanese = romanize
export const parseJapaneseText = analyze
export const analyzeKanji = analyze
