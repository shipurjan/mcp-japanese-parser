// @ts-check

/** @type {import('rollup').RollupOptions} */
const config = {
  input: 'dist-tsc/src/index.js',
  output: {
    file: 'dist/index.js',
    format: 'esm',
  },
}

export default config
