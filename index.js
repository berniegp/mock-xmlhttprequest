/**
 * XMLHttpRequest mock for testing.
 *
 * Based on https://xhr.spec.whatwg.org version '24 October 2016'
 */

'use strict';

var MockXMLHttpRequest = require('./src/MockXhr');
MockXMLHttpRequest.MockXhrFactory = require('./src/MockXhrFactory');

module.exports = MockXMLHttpRequest;
