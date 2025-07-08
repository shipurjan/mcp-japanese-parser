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
      '*.config.*[t|j]s',
    ],
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    plugins: { js },
    extends: [js.configs.recommended],
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.{ts,tsx,cts,mts}'],
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
])

export default config
