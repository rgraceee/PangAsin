// WHAT: ESLint 9 flat config for the React frontend.
// WHY: Catches runtime-only defects (undefined identifiers, import mismatches,
//      hook-order violations) at lint time instead of at runtime.
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import importPlugin from 'eslint-plugin-import';

export default [
  importPlugin.flatConfigs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        ResizeObserver: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        File: 'readonly',
        FormData: 'readonly',
        Blob: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        history: 'readonly',
        location: 'readonly',
        React: 'readonly',
        performance: 'readonly',
        IntersectionObserver: 'readonly',
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    settings: {
      react: { version: '18.2' },
      'import/resolver': {
        node: { paths: ['src'], extensions: ['.js', '.jsx'] },
      },
    },
    rules: {
      // --- Catch the exact class of bug the admin pages keep hitting ---
      'no-undef': 'error',
      'no-unused-vars': ['error', { args: 'after-used', ignoreRestSiblings: true }],
      'no-unused-expressions': 'error',
      'no-constant-condition': 'error',
      // --- Import integrity (default vs named import mismatches) ---
      'import/named': 'error',
      'import/default': 'error',
      'import/no-unresolved': 'error',
      'import/no-anonymous-default-export': 'warn',
      'import/first': 'error',
      'import/no-duplicates': 'error',

      // --- React hooks ---
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'off',

      // --- React basics ---
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',
      'react/no-unknown-property': 'error',
      'react/no-deprecated': 'warn',
      'react/prop-types': 'off',
      'react/no-unescaped-entities': 'error',

      // --- Style ---
      'no-extra-semi': 'error',
      'semi': ['error', 'always'],
      'no-trailing-spaces': 'error',
      'eol-last': 'error',
    },
  },
];
