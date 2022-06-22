module.exports = {
  // We don't need to validate TypeScript in tests so we use ts-node/register/transpile-only
  // instead of ts-node/register.
  "require": "ts-node/register/transpile-only",
  "extension": ["ts"],
  "spec": [
    "test/**/*Test.*"
  ],
};
