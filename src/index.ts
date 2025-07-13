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
import pkg from '../package.json' with { type: 'json' }
import {
  CircuitBreaker,
  checkRateLimit,
  handleToolError,
  sanitizeJapaneseText,
  validateToolInput,
  withTimeout,
} from './error-handler.js'
import * as ichiran from './ichiran.js'

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
        .default(2)
        .describe('Maximum number of segmentation alternatives'),
    })
    .optional(),
})

const RomanizeJapaneseSchema = z.object({
  text: z.string().min(1).max(10000).describe('Japanese text to romanize'),
  options: z
    .object({
      scheme: z
        .enum(['hepburn', 'kunrei', 'passport'])
        .default('hepburn')
        .describe('Romanization scheme'),
      includeInfo: z
        .boolean()
        .default(false)
        .describe('Include word information with romanization'),
    })
    .optional(),
})

const AnalyzeKanjiSchema = z.object({
  text: z.string().min(1).max(1).describe('Kanji character to analyze'),
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
        try {
          const params = validateToolInput(AnalyzeKanjiSchema, args, name)
          result = await analyzeKanji(params)
        } catch (error) {
          if (error instanceof Error && error.message.includes('Required')) {
            return {
              content: [
                {
                  type: 'text',
                  text: 'Error: Missing required parameter "kanji". Please provide a kanji character or characters to analyze.\n\nExample usage:\n- Single kanji: {"kanji": "事"}\n- Multiple kanji: {"kanji": ["事", "業"]}',
                },
              ],
              isError: true,
            }
          }
          throw error
        }
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
  const limit = params.options?.limit ?? 5

  return await ichiranCircuitBreaker.execute(async () => {
    const result = await withTimeout(
      limit > 1
        ? ichiran.analyzeWithLimit(sanitizedText, limit)
        : ichiran.analyze(sanitizedText),
      config.timeout,
      'parseJapaneseText',
    )

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result),
        },
      ],
    }
  })
}

async function romanizeJapanese(
  params: z.infer<typeof RomanizeJapaneseSchema>,
) {
  const sanitizedText = sanitizeJapaneseText(params.text)
  const scheme = params.options?.scheme ?? 'hepburn'
  const includeInfo = params.options?.includeInfo ?? false

  return await ichiranCircuitBreaker.execute(async () => {
    let result: string

    if (includeInfo) {
      // Use scheme-specific function with info (consistent -e approach)
      result = await withTimeout(
        ichiran.romanizeWithSchemeAndInfo(sanitizedText, scheme),
        config.timeout,
        'romanizeJapanese',
      )
    } else {
      // Use scheme-specific function without info (consistent -e approach)
      result = await withTimeout(
        ichiran.romanizeWithScheme(sanitizedText, scheme),
        config.timeout,
        'romanizeJapanese',
      )
    }

    return {
      content: [
        {
          type: 'text',
          text: result,
        },
      ],
    }
  })
}

async function analyzeKanji(params: z.infer<typeof AnalyzeKanjiSchema>) {
  return await ichiranCircuitBreaker.execute(async () => {
    const sanitizedText = sanitizeJapaneseText(params.text)

    const result = await withTimeout(
      ichiran.analyze(sanitizedText),
      config.timeout,
      'analyzeKanji',
    )

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result),
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
  const result = await withTimeout(
    ichiran.healthCheck(),
    5000, // 5 second timeout for health checks
    'healthCheck',
  )

  const circuitBreakerState = ichiranCircuitBreaker.getState()

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          healthy: result,
          circuitBreakerState,
          version: pkg.version,
          environment: process.env.NODE_ENV ?? 'unknown',
        }),
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
