'use strict';

const MockXhr = require('./MockXhr');
const MockXhrServer = require('./MockXhrServer');

/**
 * Create a new "local" MockXhr subclass. This makes it easier to have self-contained unit tests
 * since "global" hooks can be registered directly on the subclass. These hooks don't need to then
 * be removed after tests because they are local to the new subclass.
 *
 * @returns {MockXhr} new MockXhr subclass
 */
function newMockXhr() {
  return class LocalMockXhr extends MockXhr {
    constructor() {
      super();

      // Call the local onCreate hook on the new mock instance
      if (typeof LocalMockXhr.onCreate === 'function') {
        LocalMockXhr.onCreate(this);
      }
    }

    // Override the parent method to enable the local MockXhr instance's
    // onSend() hook
    send(...args) {
      super.send(...args);

      // Execute in an empty callstack
      if (typeof LocalMockXhr.onSend === 'function') {
        // Save the callback in case it changes before it has a chance to run
        const { onSend } = LocalMockXhr;
        setTimeout(() => onSend.call(this, this), 0);
      }
    }
  };
}

/**
 * Create a new mock server using MockXhr.
 *
 * @returns {MockXhrServer} new mock server
 */
function newServer(routes) {
  return new MockXhrServer(newMockXhr(), routes);
}

module.exports = {
  newMockXhr,
  newServer,
};
