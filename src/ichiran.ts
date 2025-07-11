import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// Configuration from environment
const config = {
  ichiranTimeout: parseInt(process.env.ICHIRAN_TIMEOUT ?? '30000'),
  maxTextLength: parseInt(process.env.MAX_TEXT_LENGTH ?? '10000'),
  maxConcurrent: parseInt(process.env.ICHIRAN_MAX_CONCURRENT ?? '10'),
}

// Error types
export class IchiranError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: object,
  ) {
    super(message)
    this.name = 'IchiranError'
  }
}

// Data structures based on CLAUDE.md specification
export interface ParsedWord {
  text: string
  kana?: string
  romanization: string
  partOfSpeech: string[]
  definitions: Definition[]
  score: number
  start: number
  end: number
}

export interface Definition {
  meaning: string
  tags: string[]
  examples?: string[]
}

export interface Segmentation {
  words: ParsedWord[]
  confidence: number
  alternatives: number
}

export interface ParseOptions {
  includeInfo?: boolean
  limit?: number
}

export interface RomanizeOptions {
  scheme?: 'hepburn' | 'kunrei' | 'passport'
  includeInfo?: boolean
}

/**
 * Execute Ichiran CLI command
 */
async function executeIchiranCommand(args: string[]): Promise<string> {
  try {
    const command = `docker exec ichiran-main-1 ./ichiran-cli ${args.join(' ')}`
    const { stdout, stderr } = await execAsync(command, {
      timeout: config.ichiranTimeout,
      maxBuffer: 1024 * 1024, // 1MB buffer
    })

    if (stderr.trim()) {
      console.warn('Ichiran stderr:', stderr)
    }

    return stdout.trim()
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        throw new IchiranError('Processing timeout exceeded', 'ICHIRAN_TIMEOUT')
      }
      if (error.message.includes('ECONNREFUSED')) {
        throw new IchiranError(
          'Ichiran service unavailable',
          'ICHIRAN_UNAVAILABLE',
        )
      }
      if (error.message.includes('No such container')) {
        throw new IchiranError(
          'Ichiran container not running. Start with: docker-compose up -d',
          'ICHIRAN_UNAVAILABLE',
        )
      }
    }
    throw new IchiranError(
      `Ichiran execution failed: ${error instanceof Error ? error.message : String(error)}`,
      'PROCESSING_ERROR',
      { originalError: error },
    )
  }
}

/**
 * Validate Japanese text input
 */
export function validateJapaneseText(text: string): boolean {
  if (!text || typeof text !== 'string') {
    throw new IchiranError('Text must be a non-empty string', 'INVALID_INPUT')
  }

  if (text.length > config.maxTextLength) {
    throw new IchiranError(
      `Text too long. Maximum length: ${config.maxTextLength.toString()}`,
      'INVALID_INPUT',
    )
  }

  // Check for Japanese characters (Hiragana, Katakana, Kanji)
  const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/
  if (!japaneseRegex.test(text)) {
    throw new IchiranError(
      'Text must contain Japanese characters',
      'INVALID_INPUT',
    )
  }

  return true
}

/**
 * Parse Japanese text with dictionary information
 */
export async function parseJapaneseText(
  text: string,
  options: ParseOptions = {},
): Promise<Segmentation> {
  validateJapaneseText(text)

  const { limit = 5 } = options
  const args = ['-f']

  if (limit > 1) {
    args.push('-l', limit.toString())
  }

  args.push(`"${text}"`)

  try {
    const result = await executeIchiranCommand(args)

    // Parse Ichiran's JSON output
    const parsed = JSON.parse(result) as {
      words?: ParsedWord[]
      confidence?: number
      alternatives?: number
    }

    // Transform to our interface format
    return {
      words: parsed.words ?? [],
      confidence: parsed.confidence ?? 0.5,
      alternatives: parsed.alternatives ?? 0,
    }
  } catch (error) {
    if (error instanceof IchiranError) {
      throw error
    }
    throw new IchiranError(
      `Failed to parse Japanese text: ${String(error)}`,
      'PROCESSING_ERROR',
    )
  }
}

/**
 * Romanize Japanese text
 */
export async function romanizeJapanese(
  text: string,
  options: RomanizeOptions = {},
): Promise<string> {
  validateJapaneseText(text)

  const { scheme = 'hepburn', includeInfo = false } = options
  const args = []

  if (includeInfo) {
    args.push('-i')
  }

  // Note: Ichiran's romanization scheme configuration may need adjustment
  // based on actual CLI interface
  if (scheme !== 'hepburn') {
    console.warn(`Romanization scheme '${scheme}' may not be fully supported`)
  }

  args.push(`"${text}"`)

  try {
    const result = await executeIchiranCommand(args)
    return result
  } catch (error) {
    if (error instanceof IchiranError) {
      throw error
    }
    throw new IchiranError(
      `Failed to romanize Japanese text: ${String(error)}`,
      'PROCESSING_ERROR',
    )
  }
}

/**
 * Get detailed kanji analysis
 */
export async function analyzeKanji(kanji: string | string[]): Promise<object> {
  const kanjiText = Array.isArray(kanji) ? kanji.join('') : kanji

  // Validate input contains kanji
  const kanjiRegex = /[\u4E00-\u9FAF]/
  if (!kanjiRegex.test(kanjiText)) {
    throw new IchiranError(
      'Input must contain kanji characters',
      'INVALID_INPUT',
    )
  }

  try {
    // Use full analysis mode to get kanji information
    const result = await executeIchiranCommand(['-f', `"${kanjiText}"`])
    return JSON.parse(result) as object
  } catch (error) {
    if (error instanceof IchiranError) {
      throw error
    }
    throw new IchiranError(
      `Failed to analyze kanji: ${String(error)}`,
      'PROCESSING_ERROR',
    )
  }
}

/**
 * Health check for Ichiran service
 */
export async function healthCheck(): Promise<boolean> {
  try {
    await executeIchiranCommand(['--help'])
    return true
  } catch {
    return false
  }
}
