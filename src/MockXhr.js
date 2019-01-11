'use strict';

const Event = require('./Event');
const EventTarget = require('./EventTarget');
const HeadersContainer = require('./HeadersContainer');
const Utils = require('./Utils');

function throwError(type, text = '') {
  const exception = new Error(text);
  exception.name = type;
  throw exception;
}

/**
 * XMLHttpRequest mock for testing.
 * Based on https://xhr.spec.whatwg.org version '28 November 2018'.
 *
 * Supports:
 *  - events and states
 *  - open(), setRequestHeader(), send() and abort()
 *  - upload and download progress events
 *  - response status, statusText, headers and body
 *  - simulating a network error
 *  - simulating a request time out
 *
 * Does not support:
 * - synchronous requests (async == false)
 * - parsing the url and setting the username and password
 * - the timeout attribute (call MockXhr.setRequestTimeout() to trigger a timeout)
 * - withCredentials
 * - responseUrl (the final request url with redirects)
 * - Setting responseType (only the empty string responseType is used)
 * - overrideMimeType
 * - responseXml
 */
class MockXhr extends EventTarget {
  /**
   * Constructor
   */
  constructor() {
    super();
    this._readyState = MockXhr.UNSENT;
    this.requestHeaders = new HeadersContainer();
    this._upload = new EventTarget(this);
    this._response = this._networkErrorResponse();

    // Hook for XMLHttpRequest creation
    if (typeof MockXhr.onCreate === 'function') {
      MockXhr.onCreate(this);
    }
  }

  /**
   * Set the request method and url.
   * https://xhr.spec.whatwg.org/#the-open()-method
   *
   * @param {string} method request HTTP method (GET, POST, etc.)
   * @param {string} url request url
   */
  open(method, url) {
    if (Utils.isRequestMethodForbidden(method)) {
      throwError('SecurityError', `Method "${method}" forbidden.`);
    }
    method = Utils.normalizeHTTPMethodName(method);
    // Skip parsing the url and setting the username and password

    this._terminateRequest();

    // Set variables
    this._sendFlag = false;
    this._uploadListenerFlag = false;
    this.method = method;
    this.url = url;
    this.requestHeaders.reset();
    this._response = this._networkErrorResponse();
    if (this._readyState !== MockXhr.OPENED) {
      this._readyState = MockXhr.OPENED;
      this._fireReadyStateChange();
    }
  }

  /**
   * Add a request header value.
   * https://xhr.spec.whatwg.org/#the-setrequestheader()-method
   *
   * @param {string} name header name
   * @param {string} value header value
   */
  setRequestHeader(name, value) {
    if (this._readyState !== MockXhr.OPENED || this._sendFlag) {
      throwError('InvalidStateError');
    }
    if (typeof name !== 'string' || typeof value !== 'string') {
      throw new SyntaxError();
    }

    if (!Utils.isRequestHeaderForbidden(name)) {
      // Normalize value
      value = value.trim();
      this.requestHeaders.addHeader(name, value);
    }
  }

  /**
   * Initiate the request.
   * https://xhr.spec.whatwg.org/#the-send()-method
   *
   * @param {*} body request body
   */
  send(body = null) {
    if (this._readyState !== MockXhr.OPENED || this._sendFlag) {
      throwError('InvalidStateError');
    }
    if (this.method === 'GET' || this.method === 'HEAD') {
      body = null;
    }

    if (body !== null) {
      let extractedContentType = null;

      // Document body type not supported

      // https://fetch.spec.whatwg.org/#concept-bodyinit-extract
      {
        let contentType = null;
        if (typeof body === 'string') {
          contentType = 'text/plain;charset=UTF-8';
        } else if (body.type) {
          // As specified for Blob
          contentType = body.type;
        }

        // BufferSource, FormData, etc. not handled specially
        extractedContentType = contentType;
      }

      /*
      * Skipping step "4. If author request headers contains `Content-Type`, then:"
      * Parsing mime type strings and overriding the charset to UTF-8 seems like a lot of work
      * for little gain. If I'm wrong, please open an issue or better yet a pull request.
      */

      if (this.requestHeaders.getHeader('Content-Type') === null && extractedContentType !== null) {
        this.requestHeaders.addHeader('Content-Type', extractedContentType);
      }
    }

    this._uploadListenerFlag = this._upload.hasListeners();
    this.body = body;
    this._uploadCompleteFlag = this.body === null;
    this._timedOutFlag = false;
    this._sendFlag = true;

    this._fireEvent('loadstart', 0, 0);
    if (!this._uploadCompleteFlag && this._uploadListenerFlag) {
      this._fireUploadEvent('loadstart', 0, this._getRequestBodySize());
    }

    // Other interactions are done through the mock's response methods
    if (this._readyState !== MockXhr.OPENED || !this._sendFlag) {
      return;
    }

    // Hook for XMLHttpRequest.send(). Execute in an empty callstack
    if (typeof this.onSend === 'function') {
      // Save the callback in case it changes before it has a chance to run
      const { onSend } = this;
      setTimeout(() => onSend.call(this, this), 0);
    }
    if (typeof MockXhr.onSend === 'function') {
      // Save the callback in case it changes before it has a chance to run
      const { onSend } = MockXhr;
      setTimeout(() => onSend.call(this, this), 0);
    }
  }

  /**
   * Abort the request.
   * https://xhr.spec.whatwg.org/#the-abort()-method
   */
  abort() {
    this._terminateRequest();

    if ((this._readyState === MockXhr.OPENED && this._sendFlag)
      || this._readyState === MockXhr.HEADERS_RECEIVED
      || this._readyState === MockXhr.LOADING) {
      this._requestErrorSteps('abort');
    }

    if (this._readyState === MockXhr.DONE) {
      // No readystatechange event is dispatched.
      this._readyState = MockXhr.UNSENT;
      this._response = this._networkErrorResponse();
    }
  }

  _networkErrorResponse() {
    return {
      type: 'error',
      status: 0,
      statusMessage: '',
      headers: new HeadersContainer(),
      body: null,
    };
  }

  _isNetworkErrorResponse() {
    return this._response.type === 'error';
  }

  _terminateRequest() {
    delete this.method;
    delete this.url;
  }

  _getRequestBodySize() {
    if (!this.body) {
      return 0;
    }
    return this.body.size ? this.body.size : this.body.length;
  }

  /**
   * Get a response header value.
   * https://xhr.spec.whatwg.org/#dom-xmlhttprequest-getresponseheader
   *
   * @param {string} name header name
   * @returns {string} header value
   */
  getResponseHeader(name) {
    return this._response.headers.getHeader(name);
  }

  /**
   * Get all response headers as a string.
   * https://xhr.spec.whatwg.org/#dom-xmlhttprequest-getallresponseheaders
   *
   * @returns {string} concatenated headers
   */
  getAllResponseHeaders() {
    return this._response.headers.getAll();
  }

  _getResponseText() {
    // Only supports responseType === '' or responseType === 'text'
    if (this._readyState !== MockXhr.LOADING && this._readyState !== MockXhr.DONE) {
      return '';
    }

    // Return the text response
    return this._response.body ? this._response.body : '';
  }

  _newEvent(name, transmitted, length) {
    return new Event(name, transmitted, length);
  }

  _fireEvent(name, transmitted, length) {
    this.dispatchEvent(this._newEvent(name, transmitted, length));
  }

  _fireUploadEvent(name, transmitted, length) {
    this._upload.dispatchEvent(this._newEvent(name, transmitted, length));
  }

  _fireReadyStateChange() {
    const event = new Event('readystatechange');
    if (this.onreadystatechange) {
      this.onreadystatechange(event);
    }
    this.dispatchEvent(event);
  }

  ///////////////////////////////////
  // Request and response handling //
  ///////////////////////////////////

  /**
   * Note: the "process request body" task is in the MockXhr response methods
   * Process request end-of-body task. When the whole request is sent.
   * https://xhr.spec.whatwg.org/#the-send()-method
   */
  _requestEndOfBody() {
    this._uploadCompleteFlag = true;

    if (this._uploadListenerFlag) {
      // If no listeners were registered before send(), these steps do not run.
      const length = this._getRequestBodySize();
      const transmitted = length;
      this._fireUploadEvent('progress', transmitted, length);
      this._fireUploadEvent('load', transmitted, length);
      this._fireUploadEvent('loadend', transmitted, length);
    }
  }

  /**
   * Process response task. When the response headers are received.
   * https://xhr.spec.whatwg.org/#the-send()-method
   *
   * @param {*} response response
   */
  _processResponse(response) {
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
  }

  /**
   * Handle response end-of-body for response.
   * https://xhr.spec.whatwg.org/#handle-response-end-of-body
   */
  _handleResponseEndOfBody() {
    this._handleResponseErrors();
    if (this._isNetworkErrorResponse()) {
      return;
    }
    const length = this._response.body ? this._response.body.length : 0;
    this._fireEvent('progress', length, length);
    this._readyState = MockXhr.DONE;
    this._sendFlag = false;
    this._fireReadyStateChange();
    this._fireEvent('load', length, length);
    this._fireEvent('loadend', length, length);
  }

  /**
   * Handle errors for response.
   * https://xhr.spec.whatwg.org/#handle-errors
   */
  _handleResponseErrors() {
    if (!this._sendFlag) {
      return;
    }
    if (this._timedOutFlag) {
      // Timeout
      this._requestErrorSteps('timeout');
    } else if (this._isNetworkErrorResponse()) {
      // Network error
      this._requestErrorSteps('error');
    }
  }

  /**
   * The request error steps for event 'event'.
   * https://xhr.spec.whatwg.org/#request-error-steps
   *
   * @param {string} event event name
   */
  _requestErrorSteps(event) {
    this._readyState = MockXhr.DONE;
    this._sendFlag = false;
    this._response = this._networkErrorResponse();
    this._fireReadyStateChange();
    if (!this._uploadCompleteFlag) {
      this._uploadCompleteFlag = true;

      if (this._uploadListenerFlag) {
        // If no listeners were registered before send(), no upload events should be fired.
        this._fireUploadEvent(event, 0, 0);
        this._fireUploadEvent('loadend', 0, 0);
      }
    }
    this._fireEvent(event, 0, 0);
    this._fireEvent('loadend', 0, 0);
  }

  ///////////////////////////
  // Mock response methods //
  ///////////////////////////

  /**
   * Fire a request upload progress event.
   *
   * @param {number} transmitted bytes transmitted
   */
  uploadProgress(transmitted) {
    if (!this._sendFlag || this._uploadCompleteFlag) {
      throw new Error('Mock usage error detected.');
    }
    if (this._uploadListenerFlag) {
      // If no listeners were registered before send(), no upload events should be fired.
      this._fireUploadEvent('progress', transmitted, this._getRequestBodySize());
    }
  }

  /**
   * Complete response method. Sets the response headers and body. Will set the
   * state to DONE.
   *
   * @param {number} status response http status (default 200)
   * @param {object} headers name-value headers (optional)
   * @param {*} body response body (default null)
   * @param {string} statusText response http status text (optional)
   */
  respond(status, headers, body, statusText) {
    this.setResponseHeaders(status, headers, statusText);
    this.setResponseBody(body);
  }

  /**
   * Set only the response headers. Will change the state to HEADERS_RECEIVED.
   *
   * @param {number} status response http status (default 200)
   * @param {object} headers name-value headers (optional)
   * @param {string} statusText response http status text (optional)
   */
  setResponseHeaders(status, headers, statusText) {
    if (this._readyState !== MockXhr.OPENED || !this._sendFlag) {
      throw new Error('Mock usage error detected.');
    }
    if (this.body) {
      this._requestEndOfBody();
    }
    status = typeof status === 'number' ? status : 200;
    const statusMessage = statusText !== undefined ? statusText : Utils.getStatusText(status);
    this._processResponse({
      status,
      statusMessage,
      headers: new HeadersContainer(headers),
    });
  }

  /**
   * Fire a response progress event. Will set the state to LOADING.
   *
   * @param {number} transmitted transmitted bytes
   * @param {number} length total bytes
   */
  downloadProgress(transmitted, length) {
    if (this._readyState !== MockXhr.HEADERS_RECEIVED
      && this._readyState !== MockXhr.LOADING) {
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
  }

  /**
   * Set the response body. Will set the state to DONE.
   *
   * @param {*} body response body (default null)
   */
  setResponseBody(body = null) {
    if (!this._sendFlag
      || (this._readyState !== MockXhr.OPENED
        && this._readyState !== MockXhr.HEADERS_RECEIVED
        && this._readyState !== MockXhr.LOADING)) {
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
  }

  /**
   * Simulate a network error. Will set the state to DONE.
   */
  setNetworkError() {
    if (!this._sendFlag) {
      throw new Error('Mock usage error detected.');
    }
    this._processResponse(this._networkErrorResponse());
  }

  /**
   * Simulate a request timeout. Will set the state to DONE.
   */
  setRequestTimeout() {
    if (!this._sendFlag) {
      throw new Error('Mock usage error detected.');
    }
    this._terminateRequest();
    this._timedOutFlag = true;
    this._processResponse(this._networkErrorResponse());
  }
}

// Properties of the XMLHttpRequest class
Object.defineProperties(MockXhr.prototype, {
  readyState: {
    get() { return this._readyState; },
  },
  upload: {
    get() { return this._upload; },
  },
  status: {
    get() { return this._response.status; },
  },
  statusText: {
    get() { return this._response.statusMessage; },
  },
  responseType: {
    get() { return ''; },
    set() { throw new Error('Operation not supported.'); },
  },
  response: {
    get() { return this._getResponseText(); },
  },
  responseText: {
    get() { return this._getResponseText(); },
  },
});

/**
 * The client states
 * https://xhr.spec.whatwg.org/#states
 */
MockXhr.UNSENT = 0;
MockXhr.OPENED = 1;
MockXhr.HEADERS_RECEIVED = 2;
MockXhr.LOADING = 3;
MockXhr.DONE = 4;

module.exports = MockXhr;
