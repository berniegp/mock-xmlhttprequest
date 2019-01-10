const Factories = require('./src/Factories');
const MockXhr = require('./src/MockXhr');
const MockXhrServer = require('./src/MockXhrServer');

module.exports = {
  // Access to the request mock and server classes
  MockXhr,
  MockXhrServer,

  // Factory methods
  newMockXhr: Factories.newMockXhr,
  newServer: Factories.newServer,
};
