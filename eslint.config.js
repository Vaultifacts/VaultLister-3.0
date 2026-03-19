export default [
    {
        files: ['src/**/*.js', 'scripts/*.js'],
        languageOptions: {
            ecmaVersion: 2024,
            sourceType: 'module',
            globals: {
                console: 'readonly',
                process: 'readonly',
                Bun: 'readonly',
                Buffer: 'readonly',
                URL: 'readonly',
                URLSearchParams: 'readonly',
                setTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                clearTimeout: 'readonly',
                fetch: 'readonly',
                crypto: 'readonly',
                TextEncoder: 'readonly',
                TextDecoder: 'readonly',
                Response: 'readonly',
                Request: 'readonly',
                Headers: 'readonly',
                FormData: 'readonly',
                AbortController: 'readonly',
                performance: 'readonly',
                __dirname: 'readonly',
            }
        },
        rules: {
            'no-undef': 'error',
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            'no-constant-condition': 'warn',
            'no-debugger': 'error',
            'no-dupe-keys': 'error',
            'no-duplicate-case': 'error',
            'no-unreachable': 'warn',
            'eqeqeq': ['warn', 'smart'],
        }
    },
    {
        ignores: [
            'node_modules/**',
            'src/frontend/core-bundle.js',
            'src/frontend/app.js',
            'playwright-report/**',
            'data/**',
            'logs/**',
            'chrome-extension/**',
            'e2e/**',
        ]
    }
];
