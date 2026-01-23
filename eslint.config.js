module.exports = [
  {
    files: ['**/*.js'],
    ignores: [
      'node_modules/**',
      'static/js/runtime/**',
      'static/js/languages/**',
      'static/lib/font-awesome/**',
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        console: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        __dirname: 'readonly',
        process: 'readonly',
      },
    },
    rules: {
      indent: ['error', 2],
      quotes: ['error', 'single'],
      semi: ['error', 'always'],
      'no-trailing-spaces': 'error',
      'eol-last': 'error',
      'comma-dangle': ['error', 'always-multiline'],
      'no-unused-vars': 'warn',
      'no-console': 'off',
      'no-debugger': 'warn',
    },
  },
];
