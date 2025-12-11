export default {
  root: true,
  env: {
    node: true, // Enable Node.js globals
    es2021: true, // Modern JS features
    jest: true, // If using Jest for testing
  },
  extends: [
    'eslint:recommended',
    // "plugin:node/recommended", // Node.js best practices
    'plugin:import/recommended', // Import/export sanity
    // "plugin:security/recommended", // Common security pitfalls
    'plugin:prettier/recommended', // Prettier integration
  ],
  plugins: ['prettier', 'import', 'node', 'security'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module', // important for ESM
  },
  rules: {
    'prettier/prettier': 'error', // Prettier issues = ESLint errors
    'no-unused-vars': 'warn',
    'no-console': 'off', // allow console but warn in PRs
    'no-undef': 'error',
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal'],
        alphabetize: { order: 'asc', caseInsensitive: true },
      },
    ],
  },
};
