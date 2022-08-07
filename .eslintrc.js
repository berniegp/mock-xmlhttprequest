const { rules: baseStyleRules } = require('eslint-config-airbnb-base/rules/style');
const { rules: baseVariablesRules } = require('eslint-config-airbnb-base/rules/variables');
const { rules: tsBaseRules } = require('eslint-config-airbnb-typescript/lib/shared');

const forOfStatementRuleIndex = baseStyleRules['no-restricted-syntax'].findIndex((option) => {
  return option.selector === 'ForOfStatement';
});

// Rules that apply to both TypeScript and JavaScript
const commonRules = {
  // Allow to use braces if desired
  'arrow-body-style': 0,

  // Generally makes sense, but too strict to enforce
  'class-methods-use-this': 0,

  // Saving 2 characters is not worth the potential errors
  curly: ['error', 'all'],

  // A chain of 'if' and 'else if' statements is clearer than multiple individual 'if' blocks
  'no-else-return': ['error', { allowElseIf: true }],

  // Finding good names is hard so allow reuse
  'no-param-reassign': 0,

  // Increment with += 1 is just too long to type
  'no-plusplus': 0,

  // Allow for...of statements because they are natively supported in all target environments.
  // Leave the rest of the options intact.
  // https://github.com/airbnb/javascript/issues/1122
  'no-restricted-syntax': [
    baseStyleRules['no-restricted-syntax'][0],
    ...baseStyleRules['no-restricted-syntax'].slice(1, forOfStatementRuleIndex),
    ...baseStyleRules['no-restricted-syntax'].slice(forOfStatementRuleIndex + 1),
  ],

  // This is still the best way to express the private api intent
  'no-underscore-dangle': [baseStyleRules['no-underscore-dangle'][0], {
    ...baseStyleRules['no-underscore-dangle'][1],
    allowAfterThis: true,
    enforceInMethodNames: false,
  }],
};

const jsRules = {
  ...commonRules,

  // Trailing commas on function arguments is just silly
  'comma-dangle': [baseStyleRules['comma-dangle'][0], {
    ...baseStyleRules['comma-dangle'][1],
    functions: 'never',
  }],

  // Finding good names is hard so allow reuse
  'no-shadow': 0,

  // Allow functions to be used before defined because:
  // 1) they are hoisted;
  // 2) it allows code ordering that moves helper functions to the bottom.
  'no-use-before-define': [baseVariablesRules['no-use-before-define'][0], {
    ...baseVariablesRules['no-use-before-define'][1],
    functions: false,
  }],
};

const tsRules = {
  ...commonRules,

  // Trailing commas on function arguments is just silly
  '@typescript-eslint/comma-dangle': ['error', {
    ...tsBaseRules['@typescript-eslint/comma-dangle'][1],
    functions: 'never',
  }],

  // Finding good names is hard so allow reuse
  '@typescript-eslint/no-shadow': 0,

  // Allow functions to be used before defined because:
  // 1) they are hoisted;
  // 2) it allows code ordering that moves helper functions to the bottom.
  '@typescript-eslint/no-use-before-define': ['error', {
    ...tsBaseRules['@typescript-eslint/no-use-before-define'][1],
    functions: false,
  }],
};

module.exports = {
  root: true,
  extends: [
    'airbnb-base',
  ],
  overrides: [
    // Enable TypeScript ESLint only for TS files
    {
      files: ['./**/*.ts'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: 'tsconfig.eslint.json',
      },
      plugins: [
        '@typescript-eslint',
      ],
      extends: [
        'airbnb-typescript/base',
      ],
      rules: tsRules,
    },
  ],
  parserOptions: {
    ecmaVersion: 2019,
  },
  rules: jsRules,
};
