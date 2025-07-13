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
  const startTime = Date.now()
  const command = `docker exec ${config.containerName} ichiran-cli ${args.join(' ')}`

  console.error(`[ICHIRAN] Executing command: ${command}`)

  try {
    $.verbose = false

    const result = await $({
      timeout: config.timeout,
      nothrow: true,
    })`docker exec ${config.containerName} ichiran-cli ${args}`

    const duration = Date.now() - startTime

    // Log command execution details
    console.error(`[ICHIRAN] Command completed in ${duration.toString()}ms`)
    console.error(
      `[ICHIRAN] Exit code: ${result.exitCode?.toString() ?? 'unknown'}`,
    )

    if (result.stdout) {
      console.error(`[ICHIRAN] STDOUT: ${result.stdout.trim()}`)
    }

    if (result.stderr) {
      console.error(`[ICHIRAN] STDERR: ${result.stderr.trim()}`)
    }

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
    const duration = Date.now() - startTime
    console.error(`[ICHIRAN] Command failed after ${duration.toString()}ms`)
    console.error(
      `[ICHIRAN] Error: ${error instanceof Error ? error.message : String(error)}`,
    )

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
 * Romanization with specific scheme (using Lisp evaluation for consistency)
 */
export async function romanizeWithScheme(
  text: string,
  scheme: 'hepburn' | 'kunrei' | 'passport' = 'hepburn',
): Promise<string> {
  const validText = textSchema.parse(text)

  // Map scheme names to Ichiran's internal romanization methods
  const schemeMap = {
    hepburn: '*hepburn-traditional*',
    kunrei: '*kunrei-siki*',
    passport: '*hepburn-passport*',
  }

  const ichiranMethod = schemeMap[scheme]

  // Use Lisp evaluation to call romanize with specific method
  const lispExpression = `(ichiran:romanize "${validText}" :method ${ichiranMethod})`

  const result = await exec(['-e', lispExpression])
  return cleanEvalOutput(result)
}

/**
 * Romanization with scheme and dictionary information
 */
export async function romanizeWithSchemeAndInfo(
  text: string,
  scheme: 'hepburn' | 'kunrei' | 'passport' = 'hepburn',
): Promise<string> {
  const validText = textSchema.parse(text)

  const schemeMap = {
    hepburn: '*hepburn-traditional*',
    kunrei: '*kunrei-siki*',
    passport: '*hepburn-passport*',
  }

  const ichiranMethod = schemeMap[scheme]

  // Use Lisp evaluation to call romanize with method and info
  const lispExpression = `(ichiran:romanize "${validText}" :method ${ichiranMethod} :with-info t)`

  const result = await exec(['-e', lispExpression])
  return cleanEvalOutput(result)
}

/**
 * Clean output from Lisp evaluation (removes quotes and NIL)
 */
function cleanEvalOutput(output: string): string {
  // Remove leading/trailing quotes and trim whitespace
  let cleaned = output.trim()

  // Remove quotes at the beginning and end
  if (cleaned.startsWith('"') && cleaned.includes('" \n')) {
    cleaned = cleaned.substring(1, cleaned.indexOf('" \n'))
  }

  // Handle case where there's just quoted content
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.slice(1, -1)
  }

  return cleaned.trim()
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
