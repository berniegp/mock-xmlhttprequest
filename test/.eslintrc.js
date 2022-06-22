module.exports = {
  rules: {
    // Arrow functions can't access the Mocha context so we allow unnamed functions
    'func-names': 0,

    // Don't force spreading test classes over multiple files
    'max-classes-per-file': 0,
  },
};
