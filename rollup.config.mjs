// @ts-check
import json from '@rollup/plugin-json'
import terser from '@rollup/plugin-terser'

/** @type {import('rollup').RollupOptions} */
const config = {
  input: 'dist/index.js',
  output: {
    file: 'build/index.js',
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
  plugins: [json(), terser()],
}

export default config
