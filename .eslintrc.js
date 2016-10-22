module.exports = {
  root: true,
  extends: ['eslint:recommended'],
  env: {
    node: true,
  },
  rules: {
    ////////////////////
    // Best practices //
    ////////////////////

    // Prohibit use of == and != in favor of === and !==.
    eqeqeq: ['error', 'always', {null: 'ignore'}],
    // Prohibit use of a variable before it is defined.
    'no-use-before-define': ['error', 'nofunc'],

    ///////////
    // Style //
    ///////////

    camelcase: ['error', {properties: 'always'}],
    indent: ['error', 2],
    'linebreak-style': ['error', 'unix'],
    'new-cap': ['error', {
      newIsCap: true,
      capIsNew: false,
    }],
    'no-trailing-spaces': ['error'],
    quotes: ['error', 'single'],
    semi: ['error', 'always'],
  },
};