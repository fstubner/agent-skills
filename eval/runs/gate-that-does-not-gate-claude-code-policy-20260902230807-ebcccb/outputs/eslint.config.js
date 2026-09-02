import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.js', 'test/**/*.js'],
    rules: {
      'no-unused-vars': 'error',
      'no-console': 'warn',
    },
  },
];
