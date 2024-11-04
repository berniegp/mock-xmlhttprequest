import eslint from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import tseslint from 'typescript-eslint';

const goodPracticesRules = {
  // Enforce consistent brace style for all control statements
  'curly': 'error',

  // Require the use of `===` and `!==`
  'eqeqeq': 'error',

  // Require `for-in` loops to include an `if` statement
  'guard-for-in': 'error',

  // Disallow the use of `console`
  'no-console': 'warn',

  // Disallow `else` blocks after `return` statements in `if` statements
  'no-else-return': 'error',

  // Disallow `new` operators with the `String`, `Number`, and `Boolean` objects
  'no-new-wrappers': 'error',

  // Enforce template literal expressions to be of `string` type, but allow numbers
  '@typescript-eslint/restrict-template-expressions': ['error', {
    allowNumber: true,
  }],
};

const styleRules = {
  // Enforce camelcase naming convention
  'camelcase': ['error', { properties: 'never', ignoreDestructuring: false }],

  // Require constructor names to begin with a capital letter
  'new-cap': 'error',

  // Disallow calls to the `Object` constructor without an argument
  'no-object-constructor': 'error',

  // Disallow dangling underscores in identifiers, except after `this`.
  // This is still the best way to express the private api intent.
  'no-underscore-dangle': ['error', {
    allowAfterThis: true,
  }],

  // Disallow using Object.assign with an object literal as the first
  // argument and prefer the use of object spread instead
  'prefer-object-spread': 'error',

  // Disallow Unicode byte order mark (BOM)
  'unicode-bom': 'error',

  // Enforce consistent indentation
  '@stylistic/indent': ['error', 2, { SwitchCase: 1 }],

  // Enforce consistent spacing inside array brackets
  '@stylistic/array-bracket-spacing': 'error',

  // Enforce consistent spacing before and after the arrow in arrow functions
  '@stylistic/arrow-spacing': 'error',

  // Enforce spaces inside of blocks after opening block and before closing block
  '@stylistic/block-spacing': 'error',

  // Enforce consistent brace style for blocks
  '@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: true }],

  // Require trailing commas in multiline object literals
  '@stylistic/comma-dangle': ['error', {
    arrays: 'always-multiline',
    objects: 'always-multiline',
    imports: 'always-multiline',
    exports: 'always-multiline',
  }],

  // Enforce consistent spacing before and after commas
  '@stylistic/comma-spacing': 'error',

  // Enforce consistent comma style
  '@stylistic/comma-style': 'error',

  // Enforce consistent spacing inside computed property brackets
  '@stylistic/computed-property-spacing': 'error',

  // Enforce consistent newlines before and after dots
  '@stylistic/dot-location': ['error', 'property'],

  // Require newline at the end of files
  '@stylistic/eol-last': 'error',

  // Enforce line breaks between arguments of a function call
  '@stylistic/function-call-argument-newline': ['error', 'consistent'],

  // Disallow spacing between function identifiers and their invocations
  '@stylistic/func-call-spacing': 'error',

  // Enforce consistent line breaks inside function parentheses for multiline arguments
  '@stylistic/function-paren-newline': ['error', 'multiline-arguments'],

  // Enforce the location of arrow function bodies
  '@stylistic/implicit-arrow-linebreak': 'error',

  // Enforce consistent spacing between property names and type annotations in types and interfaces
  '@stylistic/key-spacing': 'error',

  // Enforce consistent spacing before and after keywords
  '@stylistic/keyword-spacing': 'error',

  // Enforce a maximum line length
  '@stylistic/max-len': ['error', 100, 2, {
    ignoreComments: true, // Lines with multiple eslint-disable-next-line entries are too long
    ignoreUrls: true,
    ignoreRegExpLiterals: true,
    ignoreStrings: true,
    ignoreTemplateLiterals: true,
  }],

  // Disallow parentheses when invoking a constructor with no arguments
  '@stylistic/new-parens': 'error',

  // Disallow unnecessary semicolons
  '@stylistic/no-extra-semi': 'error',

  // Disallow mixed spaces and tabs for indentation
  '@stylistic/no-mixed-spaces-and-tabs': 'error',

  // Disallow multiple spaces
  '@stylistic/no-multi-spaces': 'error',

  // Disallow multiple empty lines, only one newline at the end, and no new lines at the beginning
  '@stylistic/no-multiple-empty-lines': ['error', { max: 1, maxBOF: 0, maxEOF: 0 }],

  // Disallow whitespace before properties
  '@stylistic/no-whitespace-before-property': 'error',

  // Enforce consistent spacing inside braces
  '@stylistic/object-curly-spacing': ['error', 'always'],

  // Enforce placing object properties on separate lines, unless they fit in a single line
  '@stylistic/object-property-newline': ['error', {
    allowAllPropertiesOnSameLine: true,
  }],

  // Enforce consistent linebreak style for operators
  '@stylistic/operator-linebreak': 'error',

  // Enforce spacing between rest and spread operators and their expressions
  '@stylistic/rest-spread-spacing': 'error',

  // Disallow all tabs
  '@stylistic/no-tabs': 'error',

  // Disallow trailing whitespace at the end of lines
  '@stylistic/no-trailing-spaces': 'error',

  // Enforce the consistent use of either backticks, double, or single quotes
  '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],

  // Require quotes around object literal, type literal, interfaces and enums property names
  '@stylistic/quote-props': ['error', 'consistent-as-needed', { keywords: false }],

  // Require or disallow semicolons instead of ASI
  '@stylistic/semi': 'error',

  // Enforce consistent spacing before and after semicolons
  '@stylistic/semi-spacing': 'error',

  // Enforce location of semicolons
  '@stylistic/semi-style': 'error',

  // Enforce consistent spacing before blocks
  '@stylistic/space-before-blocks': 'error',

  // Enforce consistent spacing before function parenthesis
  '@stylistic/space-before-function-paren': ['error', {
    anonymous: 'always',
    named: 'never',
    asyncArrow: 'always',
  }],

  // Enforce consistent spacing inside parentheses
  '@stylistic/space-in-parens': 'error',

  // Require spacing around infix operators
  '@stylistic/space-infix-ops': 'error',

  // Enforce consistent spacing before or after unary operators
  '@stylistic/space-unary-ops': 'error',

  // Enforce spacing around colons of switch statements
  '@stylistic/switch-colon-spacing': 'error',

  // Disallow spacing between template tags and their literals
  '@stylistic/template-tag-spacing': 'error',

  // Disallow spacing around embedded expressions of template strings
  // enforce usage of spacing in template strings
  '@stylistic/template-curly-spacing': 'error',

  // Require spacing after and disallow spacing before the `*` in `yield*` expressions
  '@stylistic/yield-star-spacing': 'error',
};

export default tseslint.config(
  eslint.configs.recommended,
  // ...tseslint.configs.recommended, type checked replaces this
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    ignores: [
      'dist/',
      'integration_tests/', // too difficult to configure with nested package.json
    ],
  },
  {
    plugins: {
      '@stylistic': stylistic,
    },
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2021,
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: { ...goodPracticesRules, ...styleRules },
  },
  {
    // Non TypeScript files don't get TypeScript rules
    files: [
      '**/*.js',
      '**/*.cjs',
      '**/*.mjs',
    ],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    // Build script rules
    files: ['build/**/*.ts'],
    rules: {
      // We want to print to console during the build
      'no-console': 0,
    },
  },
  {
    // Unit test rules
    files: ['test/**/*.ts'],
    rules: {
      // Often need mocks, etc. in tests
      '@typescript-eslint/no-empty-function': 0,

      // The test suite functions return promises that don't need awaiting
      '@typescript-eslint/no-floating-promises': [
        'error',
        {
          allowForKnownSafeCalls: [
            { from: 'package', name: ['describe', 'it', 'test'], package: 'node:test' },
          ],
        },
      ],
    },
  }
);
