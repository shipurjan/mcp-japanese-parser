// @ts-check

/** @type {import('rollup').RollupOptions} */
const config = {
  input: 'dist-tsc/src/index.js',
  output: {
    file: 'dist/index.js',
    format: 'esm',
  },
  external: [
    '@modelcontextprotocol/sdk/server/index.js',
    '@modelcontextprotocol/sdk/server/stdio.js',
    '@modelcontextprotocol/sdk/types.js',
    'zod',
    'zod-to-json-schema',
    'child_process',
    'util',
  ],
}

export default config
