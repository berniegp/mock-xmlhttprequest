'use strict';
var MockXhr = require('./MockXhr');


module.exports = function MockXhrFactory() {

  function LocalMockXhr() {
    this.global = LocalMockXhr;
    MockXhr.call(this);
  }

  LocalMockXhr.prototype = Object.create(MockXhr.prototype);

  return LocalMockXhr;
};
