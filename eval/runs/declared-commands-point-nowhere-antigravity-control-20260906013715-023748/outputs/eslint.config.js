export default [
  {
    files: ['src/**/*.js', 'test/**/*.js', 'scripts/**/*.js', 'bin/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module'
    },
    rules: {
      'no-unused-vars': 'error',
      'no-undef': 'off'
    }
  }
];
