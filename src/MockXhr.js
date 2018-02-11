'use strict';

var Event = require('./Event');
var EventTarget = require('./EventTarget');
var HeadersContainer = require('./HeadersContainer');

function throwError(type, text) {
  var exception = new Error(text || '');
  exception.name = type;
  throw exception;
}

/**
 * Constructor.
 *
 * MockXhr supports:
 *  - events and states
 *  - open(), setRequestHeader(), send() and abort()
 *  - upload and download progress events
 *  - response status, statusText, headers and body
 *  - simulating a network error
 *
 * MockXhr does not support:
 * - synchronous requests (async == false)
 * - parsing the url and setting the username and password
 * - the timeout attribute and associated logic
 * - withCredentials
 * - responseUrl (the final request url with redirects)
 * - Setting responseType (only the empty string responseType is used)
 * - overrideMimeType
 * - responseXml
 */
var MockXhr = function() {
  EventTarget.call(this);
  this._readyState = MockXhr.UNSENT;
  this.requestHeaders = new HeadersContainer();
  this._upload = new EventTarget(this);
  this._response = this._networkErrorResponse();

  // Hook for XMLHttpRequest creation
  if (typeof MockXhr.onCreate === 'function') {
    MockXhr.onCreate(this);
  }
};
MockXhr.prototype = Object.create(EventTarget.prototype, {
  readyState: {
    get: function() { return this._readyState; },
  },
  upload: {
    get: function() { return this._upload; },
  },
  status: {
    get: function() { return this._response.status; },
  },
  statusText: {
    get: function() { return this._response.statusMessage; },
  },
  responseType: {
    get: function() { return ''; },
    set: function() { throw new Error('Operation not supported.'); },
  },
  response: {
    get: function() { return this._getResponseText(); },
  },
  responseText: {
    get: function() { return this._getResponseText(); },
  },
});
MockXhr.prototype.constructor = MockXhr;

// The client states
// https://xhr.spec.whatwg.org/#states
MockXhr.UNSENT = 0;
MockXhr.OPENED = 1;
MockXhr.HEADERS_RECEIVED = 2;
MockXhr.LOADING = 3;
MockXhr.DONE = 4;

// Set the request method and url
// https://xhr.spec.whatwg.org/#the-open()-method
MockXhr.prototype.open = function(method, url) {
  if (this._methodForbidden(method)) {
    throwError('SecurityError', 'Method "' + method + '" forbidden.');
  }
  method = this._normalizeMethodName(method);
  // Skip parsing the url and setting the username and password

  this._terminateRequest();

  // Set variables
  this.sendFlag = false;
  this.method = method;
  this.url = url;
  this.requestHeaders.reset();
  this._response = this._networkErrorResponse();
  if (this._readyState !== MockXhr.OPENED) {
    this._readyState = MockXhr.OPENED;
    this._fireReadyStateChange();
  }
};

// https://xhr.spec.whatwg.org/#the-setrequestheader()-method
MockXhr.prototype.setRequestHeader = function(name, value) {
  if (this._readyState !== MockXhr.OPENED || this.sendFlag) {
    throwError('InvalidStateError');
  }
  if (typeof name !== 'string' || typeof value !== 'string') {
    throw new SyntaxError();
  }

  if (!this._requestHeaderForbidden(name)) {
    // Normalize value
    value = value.trim();
    this.requestHeaders.addHeader(name, value);
  }
};

// https://xhr.spec.whatwg.org/#the-send()-method
MockXhr.prototype.send = function(body) {
  if (body === undefined) {
    body = null;
  }
  if (this._readyState !== MockXhr.OPENED || this.sendFlag) {
    throwError('InvalidStateError');
  }
  if (this.method === 'GET' || this.method === 'HEAD') {
    body = null;
  }

  if (body !== null) {
    // Set request body and Content-Type to the result of extracting body.
    // https://fetch.spec.whatwg.org/#concept-bodyinit-extract
    if (this.requestHeaders.getHeader('Content-Type') === null) {
      var mimeType = null;
      // Approximate some support for mime type detection
      if (typeof body === 'string') {
        mimeType = 'text/plain;charset=UTF-8';
      } else if (body.type) {
        // As specified for Blob
        mimeType = body.type;
      }
      // Document, BufferSource and FormData not handled
      // Does not modify the Content-Type header charset as specified in the spec

      if (mimeType !== null) {
        this.requestHeaders.addHeader('Content-Type', mimeType);
      }
    }
  }

  this.body = body;
  this.uploadCompleteFlag = this.body === null;
  this.sendFlag = true;

  this._fireEvent('loadstart', 0, 0);
  if (!this.uploadCompleteFlag) {
    this._fireUploadEvent('loadstart', 0, this._getRequestBodySize());
  }

  // Other interactions are done through the mock's response methods

  // Hook for XMLHttpRequest.send(). Execute in an empty callstack
  var xhr = this;
  if (typeof this.onSend === 'function') {
    // Save the callback in case it changes on the global object
    var instanceOnSend = this.onSend;
    setTimeout(function() {
      instanceOnSend.call(xhr, xhr);
    }, 0);
  }
  if (typeof MockXhr.onSend === 'function') {
    // Save the callback in case it changes on the global object
    var globalOnSend = MockXhr.onSend;
    setTimeout(function() {
      globalOnSend.call(xhr, xhr);
    }, 0);
  }
};

// https://xhr.spec.whatwg.org/#the-abort()-method
MockXhr.prototype.abort = function() {
  this._terminateRequest();

  if ((this._readyState === MockXhr.OPENED && this.sendFlag)||
      this._readyState === MockXhr.HEADERS_RECEIVED ||
      this._readyState === MockXhr.LOADING) {
    this._requestErrorSteps('abort');
  }

  if (this._readyState === MockXhr.DONE) {
    // No readystatechange event is dispatched.
    this._readyState = MockXhr.UNSENT;
  }
};

MockXhr.prototype._networkErrorResponse = function() {
  return {
    type: 'error',
    status: 0,
    statusMessage: '',
    headers: new HeadersContainer(),
    body: null,
  };
};

MockXhr.prototype._isNetworkErrorResponse = function() {
  return this._response.type === 'error';
};

MockXhr.prototype._terminateRequest = function() {
  delete this.method;
  delete this.url;
};

MockXhr.prototype._getRequestBodySize = function() {
  if (!this.body) {
    return 0;
  }
  return this.body.size ? this.body.size : this.body.length;
};

MockXhr.prototype.getResponseHeader = function(name) {
  return this._response.headers.getHeader(name);
};

MockXhr.prototype.getAllResponseHeaders = function() {
  return this._response.headers.getAll();
};

MockXhr.prototype._getResponseText = function() {
  // Only supports responseType === ''
  if (this._readyState !== MockXhr.LOADING && this._readyState !== MockXhr.DONE) {
    return '';
  }
  // Return the text response
  return this._response.body ? this._response.body : '';
};

MockXhr.prototype._newEvent = function(name, transmitted, length) {
  return new Event(name, transmitted, length);
};

MockXhr.prototype._fireEvent = function(name, transmitted, length) {
  this.dispatchEvent(this._newEvent(name, transmitted, length));
};

MockXhr.prototype._fireUploadEvent = function(name, transmitted, length) {
  this._upload.dispatchEvent(this._newEvent(name, transmitted, length));
};

MockXhr.prototype._fireReadyStateChange = function() {
  var event = new Event('readystatechange');
  if (this.onreadystatechange) {
    this.onreadystatechange(event);
  }
  this.dispatchEvent(event);
};

///////////////////////////////////
// Request and response handling //
///////////////////////////////////

// Note: the "process request body" task is in the MockXhr repsonse methods

// Process request end-of-body task. When the whole request is sent
// https://xhr.spec.whatwg.org/#the-send()-method
MockXhr.prototype._requestEndOfBody= function() {
  this.uploadCompleteFlag = true;

  // Don't check the status of the "upload listener flag"
  // See https://github.com/whatwg/xhr/issues/95
  var length = this._getRequestBodySize();
  var transmitted = length;
  this._fireUploadEvent('progress', transmitted, length);
  this._fireUploadEvent('load', transmitted, length);
  this._fireUploadEvent('loadend', transmitted, length);
};

// Process response task. When the response headers are received.
// https://xhr.spec.whatwg.org/#the-send()-method
MockXhr.prototype._processResponse = function(response) {
  this._response = response;
  this._handleResponseErrors();
  if (this._isNetworkErrorResponse()) {
    return;
  }
  this._readyState = MockXhr.HEADERS_RECEIVED;
  this._fireReadyStateChange();
  if (this._readyState !== MockXhr.HEADERS_RECEIVED) {
    return;
  }
  if (this._response.body === null) {
    this._handleResponseEndOfBody();
  }
  // Further steps are triggered by the MockXhr response methods
};

// https://xhr.spec.whatwg.org/#handle-response-end-of-body
MockXhr.prototype._handleResponseEndOfBody = function() {
  this._handleResponseErrors();
  if (this._isNetworkErrorResponse()) {
    return;
  }
  var length = this._response.body ? this._response.body.length : 0;
  this._fireEvent('progress', length, length);
  this._readyState = MockXhr.DONE;
  this.sendFlag = false;
  this._fireReadyStateChange();
  this._fireEvent('load', length, length);
  this._fireEvent('loadend', length, length);
};

// https://xhr.spec.whatwg.org/#handle-errors
MockXhr.prototype._handleResponseErrors = function() {
  if (!this.sendFlag) {
    return;
  }
  if (this._isNetworkErrorResponse()) {
    // Network error
    this._requestErrorSteps('error');
  } else {
    switch (this._response.terminationReason) {
    case 'end-user abort':
      this._requestErrorSteps('abort');
      break;
    case 'fatal':
      this._readyState = MockXhr.DONE;
      this.sendFlag = false;
      this._response = this._networkErrorResponse();
      break;
    }
  }
};

// The request error steps for event 'event'
// https://xhr.spec.whatwg.org/#request-error-steps
MockXhr.prototype._requestErrorSteps = function(event) {
  this._readyState = MockXhr.DONE;
  this.sendFlag = false;
  this._response = this._networkErrorResponse();
  this._fireReadyStateChange();
  if (!this.uploadCompleteFlag) {
    this.uploadCompleteFlag = true;

    // Don't check the status of the "upload listener flag"
    // See https://github.com/whatwg/xhr/issues/95
    this._fireUploadEvent(event, 0, 0);
    this._fireUploadEvent('loadend', 0, 0);
  }
  this._fireEvent(event, 0, 0);
  this._fireEvent('loadend', 0, 0);
};


///////////////////////////
// Mock response methods //
///////////////////////////

/**
 * Fire a request upload progress event.
 *
 * @param  {number} transmitted bytes transmitted
 */
MockXhr.prototype.uploadProgress = function(transmitted) {
  if (!this.sendFlag || this.uploadCompleteFlag) {
    throw new Error('Mock usage error detected.');
  }
  // Don't check the status of the "upload listener flag"
  // See https://github.com/whatwg/xhr/issues/95
  this._fireUploadEvent('progress', transmitted, this._getRequestBodySize());
};

/**
 * Complete response method. Sets the response headers and body. Will set the
 * state to DONE.
 *
 * @param  {number} status     response http status (default 200)
 * @param  {object} headers    name-value headers (optional)
 * @param  {mixed}  body       response body )default null)
 * @param  {string} statusText response http status text (optional)
 */
MockXhr.prototype.respond = function(status, headers, body, statusText) {
  this.setResponseHeaders(status, headers, statusText);
  this.setResponseBody(body);
};

/**
 * Set only the response headers. Will change the state to HEADERS_RECEIVED.
 *
 * @param  {number} status     response http status (default 200)
 * @param  {object} headers    name-value headers (optional)
 * @param  {string} statusText response http status text (optional)
 */
MockXhr.prototype.setResponseHeaders = function(status, headers, statusText) {
  if (this._readyState !== MockXhr.OPENED || !this.sendFlag) {
    throw new Error('Mock usage error detected.');
  }
  if (this.body) {
    this._requestEndOfBody();
  }
  status = typeof status === 'number' ? status : 200;
  this._processResponse({
    status: status,
    statusMessage: statusText !== undefined ?
      statusText :
      MockXhr.statusCodes[status],
    headers: new HeadersContainer(headers),
  });
};

/**
 * Fire a response progress event. Will set the state to LOADING.
 *
 * @param  {number} transmitted transmitted bytes
 * @param  {number} length      total bytes
 */
MockXhr.prototype.downloadProgress = function(transmitted, length) {
  if (this._readyState !== MockXhr.HEADERS_RECEIVED &&
    this._readyState !== MockXhr.LOADING) {
    throw new Error('Mock usage error detected.');
  }

  // Useless condition but follows the spec's wording
  if (this._readyState === MockXhr.HEADERS_RECEIVED) {
    this._readyState = MockXhr.LOADING;
  }

  // As stated in https://xhr.spec.whatwg.org/#the-send()-method
  // Web compatibility is the reason readystatechange fires more often than
  // state changes.
  this._fireReadyStateChange();
  this._fireEvent('progress', transmitted, length);
};

/**
 * Set the response body. Will set the state to DONE.
 *
 * @param {mixed} body response body (default null)
 */
MockXhr.prototype.setResponseBody = function(body) {
  if (!this.sendFlag ||
    (this._readyState !== MockXhr.OPENED &&
    this._readyState !== MockXhr.HEADERS_RECEIVED &&
    this._readyState !== MockXhr.LOADING)) {
    throw new Error('Mock usage error detected.');
  }
  if (this._readyState === MockXhr.OPENED) {
    // Default "200 - OK" response headers
    this.setResponseHeaders();
  }

  // As stated in https://xhr.spec.whatwg.org/#the-send()-method
  // Web compatibility is the reason readystatechange fires more often than
  // state changes.
  this._readyState = MockXhr.LOADING;
  this._fireReadyStateChange();

  this._response.body = body !== undefined ? body : null;
  this._handleResponseEndOfBody();
};

/**
 * Simulate a network error. Will set the state to DONE.
 */
MockXhr.prototype.setNetworkError = function() {
  if (!this.sendFlag) {
    throw new Error('Mock usage error detected.');
  }
  this._processResponse(this._networkErrorResponse());
};


/////////////
// Utility //
/////////////

// Disallowed request headers for setRequestHeader()
// See https://fetch.spec.whatwg.org/#forbidden-header-name
var forbiddenHeaders = [
  'Accept-Charset',
  'Accept-Encoding',
  'Access-Control-Request-Headers',
  'Access-Control-Request-Method',
  'Connection',
  'Content-Length',
  'Cookie',
  'Cookie2',
  'Date',
  'DNT',
  'Expect',
  'Host',
  'Keep-Alive',
  'Origin',
  'Referer',
  'TE',
  'Trailer',
  'Transfer-Encoding',
  'Upgrade',
  'Via',
];
var forbiddenHeaderRegEx = new RegExp('^(' + forbiddenHeaders.join('|') + '|Proxy-.*|Sec-.*)$', 'i');

MockXhr.prototype._requestHeaderForbidden = function(name) {
  return forbiddenHeaderRegEx.test(name);
};

MockXhr.prototype._methodForbidden = function(method) {
  return /^(CONNECT|TRACE|TRACK)$/i.test(method);
};

// Normalize method names as described in open()
// See https://fetch.spec.whatwg.org/#concept-method-normalize
var upperCaseMethods = [
  'DELETE',
  'GET',
  'HEAD',
  'OPTIONS',
  'POST',
  'PUT',
];
var upperCaseMethodsRegEx = new RegExp('^(' + upperCaseMethods.join('|') + ')$', 'i');
MockXhr.prototype._normalizeMethodName = function(method) {
  if (upperCaseMethodsRegEx.test(method)) {
    method = method.toUpperCase();
  }
  return method;
};

MockXhr.statusCodes = {
  100: 'Continue',
  101: 'Switching Protocols',
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  203: 'Non-Authoritative Information',
  204: 'No Content',
  205: 'Reset Content',
  206: 'Partial Content',
  207: 'Multi-Status',
  300: 'Multiple Choice',
  301: 'Moved Permanently',
  302: 'Found',
  303: 'See Other',
  304: 'Not Modified',
  305: 'Use Proxy',
  307: 'Temporary Redirect',
  400: 'Bad Request',
  401: 'Unauthorized',
  402: 'Payment Required',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  406: 'Not Acceptable',
  407: 'Proxy Authentication Required',
  408: 'Request Timeout',
  409: 'Conflict',
  410: 'Gone',
  411: 'Length Required',
  412: 'Precondition Failed',
  413: 'Request Entity Too Large',
  414: 'Request-URI Too Long',
  415: 'Unsupported Media Type',
  416: 'Requested Range Not Satisfiable',
  417: 'Expectation Failed',
  422: 'Unprocessable Entity',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
  505: 'HTTP Version Not Supported'
};

/**
 * Create a new "local" MockXhr instance. This makes it easier to have
 * self-contained unit tests since they don't need to remove registered hook
 * functions.
 *
 * @return {MockXhr} Local MockXhr instance
 */
MockXhr.newMockXhr = function() {
  var LocalMockXhr = function() {
    MockXhr.call(this);

    // Call the local onCreate hook on the new mock instance
    if (typeof LocalMockXhr.onCreate === 'function')
    {
      LocalMockXhr.onCreate(this);
    }
  };
  LocalMockXhr.prototype = Object.create(MockXhr.prototype);
  LocalMockXhr.prototype.constructor = LocalMockXhr;

  // Override the parent method to enable the local MockXhr instance's
  // onSend() hook
  LocalMockXhr.prototype.send = function() {
    Object.getPrototypeOf(LocalMockXhr.prototype).send.apply(this, arguments);

    // Execute in an empty callstack
    var xhr = this;
    if (typeof LocalMockXhr.onSend === 'function') {
      // Save the callback in case it changes on the LocalMockXhr object
      var globalOnSend = LocalMockXhr.onSend;
      setTimeout(function() {
        globalOnSend.call(xhr, xhr);
      }, 0);
    }
  };

  return LocalMockXhr;
};

module.exports = MockXhr;
