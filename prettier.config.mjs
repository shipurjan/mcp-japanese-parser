// @ts-check

/**
 * @see https://prettier.io/docs/configuration
 * @type {import('prettier').Config}
 */
const config = {
  semi: false,
  singleQuote: true,
  plugins: ['@trivago/prettier-plugin-sort-imports'],
  importOrder: [
    '^node:*$',
    '^@modelcontextprotocol.*',
    '<THIRD_PARTY_MODULES>',
    '^@/(.*)$',
    '^\\..*$',
  ],
  importOrderSortSpecifiers: true,
}

export default config
