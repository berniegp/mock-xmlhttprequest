import Event from './Event';
import EventTarget from './EventTarget';
import HeadersContainer from './HeadersContainer';
import {
  getStatusText,
  isRequestHeaderForbidden,
  isRequestMethodForbidden,
  normalizeHTTPMethodName,
} from './Utils';

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
 *  - the timeout attribute (can be disabled) (since v4.0.0)
 *  - simulating a network error
 *  - simulating a request timeout (see MockXhr.setRequestTimeout())
 *
 * Partial support:
 *  - overrideMimeType(): throws when required, but has no other effect.
 *  - responseType: '', 'text' and 'json' are fully supported. Other responseType values can also be
 *    used, but they will return the response body given to setResponseBody() as-is in xhr.response.
 *  - responseXml: the response body is not converted to a document response. To get a document
 *    response, use it directly as the response body in setResponseBody().
 *
 * Not supported:
 * - synchronous requests (i.e. async == false)
 * - parsing the url and setting the username and password since there are no actual HTTP requests
 * - responseUrl (i.e. the final request url with redirects) is not automatically set. This can be
 *   emulated in a request handler.
 */
export default class MockXhr extends EventTarget {
  /**
   * Constructor
   */
  constructor() {
    super();
    this._readyState = MockXhr.UNSENT;
    this.requestHeaders = new HeadersContainer();
    this._withCredentials = false;
    this._timeout = 0;
    this._upload = new EventTarget(this);
    this._response = this._networkErrorResponse();

    // Per-instance flag to enable the effects of the timeout attribute
    this.timeoutEnabled = true;

    // Hook for XMLHttpRequest creation
    if (typeof MockXhr.onCreate === 'function') {
      MockXhr.onCreate(this);
    }
  }

  ////////////
  // States //
  ////////////

  /**
   * https://xhr.spec.whatwg.org/#dom-xmlhttprequest-readystate
   *
   * @returns {number} readystate attribute
   */
  get readyState() {
    return this._readyState;
  }

  /**
   * noop setter
   *
   * @param {*} value ignored value
   * @returns {*} value
   */
  set readyState(value) { return value; }

  /////////////
  // Request //
  /////////////

  /**
   * Set the request method and url.
   * https://xhr.spec.whatwg.org/#the-open()-method
   *
   * @param {string} method request HTTP method (GET, POST, etc.)
   * @param {string} url request url
   * @param {boolean} async async request flag (only true is supported)
   */
  open(method, url, async = true) {
    if (!async) {
      throw new Error('async = false is not supported.');
    }
    if (isRequestMethodForbidden(method)) {
      throwError('SecurityError', `Method "${method}" forbidden.`);
    }
    method = normalizeHTTPMethodName(method);
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

    if (!isRequestHeaderForbidden(name)) {
      // Normalize value
      value = value.trim();
      this.requestHeaders.addHeader(name, value);
    }
  }

  /**
   * https://xhr.spec.whatwg.org/#dom-xmlhttprequest-timeout
   *
   * @returns {number} timeout attribute
   */
  get timeout() {
    return this._timeout;
  }

  /**
   * https://xhr.spec.whatwg.org/#dom-xmlhttprequest-timeout
   *
   * @param {number} value timeout value
   */
  set timeout(value) {
    // Since this library is meant to run on node, skip the step involving the Window object.
    this._timeout = value;
    if (this._sendFlag && this.timeoutEnabled && this.constructor.timeoutEnabled) {
      // A fetch is active so schedule a request timeout
      this._scheduleRequestTimeout();
    }
  }

  /**
   * https://xhr.spec.whatwg.org/#dom-xmlhttprequest-withcredentials
   *
   * @returns {EventTarget} withCredentials attribute
   */
  get withCredentials() {
    return this._withCredentials;
  }

  /**
   * noop setter
   *
   * @param {boolean} value withCredentials value
   */
  set withCredentials(value) {
    if ((this._readyState !== MockXhr.UNSENT && this._readyState !== MockXhr.OPENED)
      || this._sendFlag) {
      throwError('InvalidStateError');
    }
    this._withCredentials = !!value;
  }

  /**
   * https://xhr.spec.whatwg.org/#the-upload-attribute
   *
   * @returns {EventTarget} upload attribute
   */
  get upload() {
    return this._upload;
  }

  /**
   * noop setter
   *
   * @param {*} value ignored value
   * @returns {*} value
   */
  set upload(value) { return value; }

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

    this._timeoutReference = Date.now();
    this._scheduleRequestTimeout();

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

  //////////////
  // Response //
  //////////////

  /**
   * https://xhr.spec.whatwg.org/#dom-xmlhttprequest-status
   *
   * @returns {number} status attribute
   */
  get status() {
    return this._response.status;
  }

  /**
   * noop setter
   *
   * @param {*} value ignored value
   * @returns {*} value
   */
  set status(value) { return value; }

  /**
   * https://xhr.spec.whatwg.org/#the-statustext-attribute
   *
   * @returns {string} statusText attribute
   */
  get statusText() {
    return this._response.statusMessage;
  }

  /**
   * noop setter
   *
   * @param {*} value ignored value
   * @returns {*} value
   */
  set statusText(value) { return value; }

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

  /**
   * https://xhr.spec.whatwg.org/#dom-xmlhttprequest-overridemimetype
   *
   * @param {string} mime MIME type
   */
  overrideMimeType(/* mime */) {
    if (this._readyState === MockXhr.LOADING || this._readyState === MockXhr.DONE) {
      throwError('InvalidStateError');
    }
    // noop
  }

  /**
   * https://xhr.spec.whatwg.org/#dom-xmlhttprequest-responsetype
   *
   * @returns {string} responseType attribute
   */
  get responseType() {
    return this._responseType || '';
  }

  /**
   * https://xhr.spec.whatwg.org/#dom-xmlhttprequest-responsetype
   *
   * @param {string} value responseType value
   */
  set responseType(value) {
    // Since this library is meant to run on node, skip the steps involving the Window object.
    if (this._readyState === MockXhr.LOADING || this._readyState === MockXhr.DONE) {
      throwError('InvalidStateError');
    }

    // The spec doesn't mandate throwing anything on invalid values since values must be of type
    // XMLHttpRequestResponseType. Observed browser behavior is to ignore invalid values.
    const responseTypes = ['', 'arraybuffer', 'blob', 'document', 'json', 'text'];
    if (responseTypes.includes(value)) {
      this._responseType = value;
    }
  }

  /**
   * https://xhr.spec.whatwg.org/#the-response-attribute
   *
   * @returns {*} response
   */
  get response() {
    if (this.responseType === '' || this.responseType === 'text') {
      if (this._readyState !== MockXhr.LOADING && this._readyState !== MockXhr.DONE) {
        return '';
      }

      // No support for charset decoding as outlined in https://xhr.spec.whatwg.org/#text-response
      return this._response.body === null ? '' : this._response.body;
    }

    if (this._readyState !== MockXhr.DONE) {
      return null;
    }

    if (this.responseType === 'json') {
      if (this._response.body === null) {
        return null;
      }
      try {
        return JSON.parse(this._response.body);
      } catch (e) {
        return null;
      }
    }

    // Other responseTypes are sent as-is. They can be given directly by setResponseBody() anyway.
    return this._response.body;
  }

  /**
   * noop setter
   *
   * @param {*} value ignored value
   * @returns {*} value
   */
  set response(value) { return value; }

  /**
   * https://xhr.spec.whatwg.org/#the-responsetext-attribute
   *
   * @returns {string} responseText attribute
   */
  get responseText() {
    if (this.responseType !== '' && this.responseType !== 'text') {
      throwError('InvalidStateError');
    }
    if (this._readyState !== MockXhr.LOADING && this._readyState !== MockXhr.DONE) {
      return '';
    }

    // No support for charset decoding as outlined in https://xhr.spec.whatwg.org/#text-response
    return this._response.body === null ? '' : this._response.body;
  }

  /**
   * noop setter
   *
   * @param {*} value ignored value
   * @returns {*} value
   */
  set responseText(value) { return value; }

  /**
   * https://xhr.spec.whatwg.org/#dom-xmlhttprequest-responsexml
   *
   * @returns {*} responseXML attribute
   */
  get responseXML() {
    if (this.responseType !== '' && this.responseType !== 'document') {
      throwError('InvalidStateError');
    }
    if (this._readyState !== MockXhr.DONE) {
      return null;
    }

    // Since this library is meant to run on node, there is no support for charset decoding as
    // outlined in https://xhr.spec.whatwg.org/#text-response
    // If needed, a document response can be given to setResponseBody() to be returned here.
    return this._response.body === null ? '' : this._response.body;
  }

  /**
   * noop setter
   *
   * @param {*} value ignored value
   * @returns {*} value
   */
  set responseXML(value) { return value; }

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
   * @param {?number} status response http status (default 200)
   * @param {?object} headers name-value headers (optional)
   * @param {?*} body response body (default null)
   * @param {?string} statusText response http status text (optional)
   */
  respond(status, headers, body, statusText) {
    this.setResponseHeaders(status, headers, statusText);
    this.setResponseBody(body);
  }

  /**
   * Set only the response headers. Will change the state to HEADERS_RECEIVED.
   *
   * @param {?number} status response http status (default 200)
   * @param {?object} headers name-value headers (optional)
   * @param {?string} statusText response http status text (optional)
   */
  setResponseHeaders(status, headers, statusText) {
    if (this._readyState !== MockXhr.OPENED || !this._sendFlag) {
      throw new Error('Mock usage error detected.');
    }
    if (this.body) {
      this._requestEndOfBody();
    }
    status = typeof status === 'number' ? status : 200;
    const statusMessage = statusText !== undefined ? statusText : getStatusText(status);
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
   * @param {?*} body response body (default null)
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

  ///////////////
  // Internals //
  ///////////////

  /**
   * @returns {object} new network error response object
   */
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

  _scheduleRequestTimeout() {
    // Cancel any previous timeout task
    if (this._timeoutTask) {
      clearTimeout(this._timeoutTask);
    }

    if (this._timeout > 0) {
      // The timeout delay must be measured relative to the start of fetching
      // https://xhr.spec.whatwg.org/#the-timeout-attribute
      const delay = Math.max(0, this._timeout - (Date.now() - this._timeoutReference));
      this._timeoutTask = setTimeout(() => {
        if (this._sendFlag) {
          this.setRequestTimeout();
        }
        delete this._timeoutTask;
      }, delay);
    }
  }
}

// Global flag to enable the effects of the timeout attribute
MockXhr.timeoutEnabled = true;

/**
 * The client states
 * https://xhr.spec.whatwg.org/#states
 */
MockXhr.UNSENT = 0;
MockXhr.OPENED = 1;
MockXhr.HEADERS_RECEIVED = 2;
MockXhr.LOADING = 3;
MockXhr.DONE = 4;
