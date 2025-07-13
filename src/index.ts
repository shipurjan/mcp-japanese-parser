#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
  ToolSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import {
  CircuitBreaker,
  checkRateLimit,
  handleToolError,
  sanitizeJapaneseText,
  validateToolInput,
  withTimeout,
} from './error-handler.js'
import {
  type ParseOptions,
  type RomanizeOptions,
  analyzeKanji as ichiranAnalyzeKanji,
  parseJapaneseText as ichiranParseText,
  romanizeJapanese as ichiranRomanizeText,
} from './ichiran.js'

// Type definition for tool input schema
type ToolInput = z.infer<typeof ToolSchema.shape.inputSchema>

// Circuit breakers for external services
const ichiranCircuitBreaker = new CircuitBreaker(5, 60000)

// Configuration
const config = {
  timeout: parseInt(process.env.ICHIRAN_TIMEOUT ?? '30000'),
  rateLimit: parseInt(process.env.RATE_LIMIT_MAX ?? '60'),
}

// Server configuration
const server = new Server(
  {
    name: 'mcp-japanese-parser',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
)

// Tool input schemas
const ParseJapaneseTextSchema = z.object({
  text: z.string().min(1).max(10000).describe('Japanese text to parse'),
  options: z
    .object({
      includeInfo: z
        .boolean()
        .default(true)
        .describe('Include detailed dictionary information'),
      limit: z
        .number()
        .min(1)
        .max(10)
        .default(5)
        .describe('Maximum number of segmentation alternatives'),
    })
    .optional(),
})

const RomanizeJapaneseSchema = z.object({
  text: z.string().min(1).max(10000).describe('Japanese text to romanize'),
  scheme: z
    .enum(['hepburn', 'kunrei', 'passport'])
    .default('hepburn')
    .describe('Romanization scheme'),
  includeInfo: z
    .boolean()
    .default(false)
    .describe('Include word information with romanization'),
})

const AnalyzeKanjiSchema = z.object({
  kanji: z
    .union([z.string().min(1).max(100), z.array(z.string()).min(1).max(50)])
    .describe('Kanji character(s) to analyze'),
})

const HealthCheckSchema = z.object({})

// Tool definitions
const tools: Tool[] = [
  {
    name: 'parse_japanese_text',
    description:
      'Parse Japanese text with dictionary information and segmentation',
    inputSchema: zodToJsonSchema(ParseJapaneseTextSchema) as ToolInput,
  },
  {
    name: 'romanize_japanese',
    description: 'Convert Japanese text to romanized form',
    inputSchema: zodToJsonSchema(RomanizeJapaneseSchema) as ToolInput,
  },
  {
    name: 'analyze_kanji',
    description: 'Provide detailed information about kanji characters',
    inputSchema: zodToJsonSchema(AnalyzeKanjiSchema) as ToolInput,
  },
  {
    name: 'health_check',
    description: 'Check the health status of the Ichiran service',
    inputSchema: zodToJsonSchema(HealthCheckSchema) as ToolInput,
  },
]

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, () => {
  return {
    tools,
  }
})

// Call tool handler with enhanced error handling
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  try {
    // Rate limiting check
    if (checkRateLimit()) {
      return handleToolError(
        new Error(
          `Rate limit exceeded. Maximum ${config.rateLimit.toString()} requests per minute.`,
        ),
        name,
      )
    }

    let result
    switch (name) {
      case 'parse_japanese_text': {
        const params = validateToolInput(ParseJapaneseTextSchema, args, name)
        result = await parseJapaneseText(params)
        break
      }
      case 'romanize_japanese': {
        const params = validateToolInput(RomanizeJapaneseSchema, args, name)
        result = await romanizeJapanese(params)
        break
      }
      case 'analyze_kanji': {
        const params = validateToolInput(AnalyzeKanjiSchema, args, name)
        result = await analyzeKanji(params)
        break
      }
      case 'health_check': {
        validateToolInput(HealthCheckSchema, args, name)
        result = await healthCheck()
        break
      }
      default:
        throw new Error(`Unknown tool: ${name}`)
    }

    return result
  } catch (error) {
    return handleToolError(error, name)
  }
})

// Tool implementations with enhanced error handling
async function parseJapaneseText(
  params: z.infer<typeof ParseJapaneseTextSchema>,
) {
  const sanitizedText = sanitizeJapaneseText(params.text)
  const options: ParseOptions = params.options ?? {}

  return await ichiranCircuitBreaker.execute(async () => {
    const result = await withTimeout(
      ichiranParseText(sanitizedText, options),
      config.timeout,
      'parseJapaneseText',
    )

    // Format the result for MCP response
    const formattedWords = result.words
      .map((word) => {
        const definitions = word.definitions
          .map((def) => `${def.meaning} (${def.tags.join(', ')})`)
          .join('; ')

        return `${word.text} [${word.kana ?? word.romanization}] - ${definitions}`
      })
      .join('\n')

    return {
      content: [
        {
          type: 'text',
          text:
            `Japanese Text Analysis for: "${sanitizedText}"\n\n` +
            `Confidence: ${(result.confidence * 100).toFixed(1)}%\n` +
            `Alternatives available: ${result.alternatives.toString()}\n\n` +
            `Word Breakdown:\n${formattedWords}`,
        },
      ],
    }
  })
}

async function romanizeJapanese(
  params: z.infer<typeof RomanizeJapaneseSchema>,
) {
  const sanitizedText = sanitizeJapaneseText(params.text)
  const options: RomanizeOptions = {
    scheme: params.scheme,
    includeInfo: params.includeInfo,
  }

  return await ichiranCircuitBreaker.execute(async () => {
    const result = await withTimeout(
      ichiranRomanizeText(sanitizedText, options),
      config.timeout,
      'romanizeJapanese',
    )

    return {
      content: [
        {
          type: 'text',
          text: `Romanization (${params.scheme}):\n${result}`,
        },
      ],
    }
  })
}

async function analyzeKanji(params: z.infer<typeof AnalyzeKanjiSchema>) {
  return await ichiranCircuitBreaker.execute(async () => {
    const result = await withTimeout(
      ichiranAnalyzeKanji(params.kanji),
      config.timeout,
      'analyzeKanji',
    )

    return {
      content: [
        {
          type: 'text',
          text: `Kanji Analysis:\n${JSON.stringify(result, null, 2)}`,
        },
      ],
    }
  })
}

async function healthCheck(): Promise<{
  content: {
    type: 'text'
    text: string
  }[]
}> {
  const { healthCheck: ichiranHealthCheck } = await import('./ichiran.js')

  const result = await withTimeout(
    ichiranHealthCheck(),
    5000, // 5 second timeout for health checks
    'healthCheck',
  )

  const circuitBreakerState = ichiranCircuitBreaker.getState()

  return {
    content: [
      {
        type: 'text',
        text:
          `Ichiran Service Health: ${result ? '✓ Healthy' : '✗ Unhealthy'}\n` +
          `Circuit Breaker: ${circuitBreakerState}\n` +
          `Server Version: 0.1.0\n` +
          `Environment: ${process.env.NODE_ENV ?? 'production'}`,
      },
    ],
  }
}

// Start the server
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('MCP Japanese Parser server running on stdio')
}

main().catch(console.error)
