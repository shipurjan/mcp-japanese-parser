// @ts-check
import js from '@eslint/js'
import eslintParserTypeScript from '@typescript-eslint/parser'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const config = tseslint.config([
  {
    ignores: [
      'node_modules/**/*',
      'dist-tsc/**/*',
      'dist/**/*',
      'coverage/**/*',
      '*.config.mjs',
    ],
  },
  {
    files: ['**/*.{js,mjs,ts}'],
    plugins: { js },
    extends: [js.configs.recommended],
  },
  {
    files: ['**/*.{js,mjs,ts}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.{ts}'],
    languageOptions: {
      parser: eslintParserTypeScript,
      parserOptions: {
        project: true,
      },
    },
  },
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    rules: {
      'no-control-regex': 0,
    },
  },
])

export default config
