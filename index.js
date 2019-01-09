const Factories = require('./src/Factories');
const MockXhr = require('./src/MockXhr');

module.exports = {
  // Access to the request mock class
  MockXhr,

  // Factory method
  newMockXhr: Factories.newMockXhr,
};
