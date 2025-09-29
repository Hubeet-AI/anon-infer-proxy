module.exports = {
	parser: '@typescript-eslint/parser',
	parserOptions: {
		ecmaVersion: 2020,
		sourceType: 'module',
		project: './tsconfig.json',
	},
	plugins: ['@typescript-eslint'],
	extends: [
		'eslint:recommended',
	],
	root: true,
	env: {
		node: true,
		jest: true,
	},
	rules: {
		// Basic ESLint rules
		'no-console': 'warn',
		'prefer-const': 'error',
		'no-unused-vars': 'off', // Disabled in favor of TypeScript rule
		'no-undef': 'off', // TypeScript handles this
		'no-useless-escape': 'off', // Regex patterns use escapes for clarity
		'no-case-declarations': 'off', // Allow declarations in case blocks

		// TypeScript-specific rules (only if the plugin is available)
		'@typescript-eslint/no-unused-vars': 'error',
		'@typescript-eslint/no-explicit-any': 'warn',
		'@typescript-eslint/explicit-function-return-type': 'off', // Too strict for examples
		'@typescript-eslint/explicit-module-boundary-types': 'off', // Too strict for examples
	},
	ignorePatterns: [
		'.eslintrc.js',
		'jest.config.js',
		'dist/',
		'node_modules/',
		'examples/',
		'*.d.ts'
	],
};
