import HeadersContainer from './HeadersContainer';
import XhrProgressEvent from './XhrProgressEvent';
import {
  getBodyByteSize,
  getStatusText,
  isRequestHeaderForbidden,
  isRequestMethodForbidden,
  normalizeHTTPMethodName,
} from './Utils';
import XhrEventTarget from './XhrEventTarget';

import type { TXhrProgressEventNames } from './XhrProgressEventsNames';

interface MockXhrResponse {
  isError?: boolean,
  status: number,
  statusMessage: string,
  headers: HeadersContainer,
  body?: any,
}

/**
 * XMLHttpRequest mock for testing.
 * Based on https://xhr.spec.whatwg.org version '18 August 2020'.
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
export default class MockXhr extends XhrEventTarget implements XMLHttpRequest {
  private _requestHeaders: HeadersContainer;

  private _method?: string;

  private _url?: string;

  private _body?: any;

  private _readyState: number;

  private _withCredentials: boolean;

  private _timeout: number;

  private readonly _upload: XhrEventTarget;

  responseURL: string;

  private _responseType: XMLHttpRequestResponseType;

  private _response: MockXhrResponse;

  private _sendFlag?: boolean;

  private _uploadListenerFlag?: boolean;

  private _uploadCompleteFlag?: boolean;

  private _timedOutFlag?: boolean;

  private _timeoutReference: number;

  private _timeoutTask: any;

  constructor() {
    super();
    this._requestHeaders = new HeadersContainer();

    this._readyState = MockXhr.UNSENT;
    this._withCredentials = false;
    this._timeout = 0;
    this._upload = new XhrEventTarget(this);
    this.responseURL = '';
    this._responseType = '';
    this._response = makeNetworkErrorResponse();
    this._timeoutReference = 0;

    this.onreadystatechange = null;

    this.timeoutEnabled = true;
    this._getPrototype().onCreate?.(this);
  }

  //-------
  // States
  //-------

  static readonly UNSENT = 0;

  static readonly OPENED = 1;

  static readonly HEADERS_RECEIVED = 2;

  static readonly LOADING = 3;

  static readonly DONE = 4;

  readonly UNSENT = MockXhr.UNSENT;

  readonly OPENED = MockXhr.OPENED;

  readonly HEADERS_RECEIVED = MockXhr.HEADERS_RECEIVED;

  readonly LOADING = MockXhr.LOADING;

  readonly DONE = MockXhr.DONE;

  onreadystatechange: ((this: XMLHttpRequest, ev: Event) => any) | null;

  //---------
  // Mock API
  //---------

  /**
   * Per-instance flag to enable the effects of the timeout attribute
   */
  timeoutEnabled: boolean;

  /**
   * Global flag to enable the effects of the timeout attribute
   */
  static timeoutEnabled = true;

  /**
   * Hook for creation of MockXhr instances
   */
  static onCreate?: (xhr: MockXhr) => void;

  /**
   * Per-instance hook for XMLHttpRequest.send(). Executes in an empty callstack.
   */
  onSend?: (this: this, xhr: this) => void;

  /**
   * Global hook for XMLHttpRequest.send(). Executes in an empty callstack.
   */
  static onSend?: (this: MockXhr, xhr: MockXhr) => void;

  /**
   * @returns request headers container
   */
  get requestHeaders() {
    return this._requestHeaders;
  }

  /**
   * @returns request method
   */
  get method() {
    return this._method ?? '';
  }

  /**
   * @returns request url
   */
  get url() {
    return this._url ?? '';
  }

  /**
   * @returns request body
   */
  get body() {
    return this._body;
  }

  /**
   * Note: the non-mocked body size will be larger than this for a multipart/form-data encoded
   * FormData body since it will include headers, encoding, etc. The value returned by this method
   * can therefore be seen as a floor value for the real thing that is nonetheless useful to
   * simulate upload progress events.
   *
   * @returns request body's total byte size
   */
  getRequestBodySize() {
    if (!this._sendFlag) {
      throw new Error('Mock usage error detected.');
    }
    return getBodyByteSize(this._body);
  }

  /**
   * Fire a request upload progress event.
   *
   * @param transmitted bytes transmitted
   */
  uploadProgress(transmitted: number) {
    if (!this._sendFlag || this._uploadCompleteFlag) {
      throw new Error('Mock usage error detected.');
    }
    if (this._uploadListenerFlag) {
      // If no listeners were registered before send(), no upload events should be fired.
      this._fireUploadEvent('progress', transmitted, this.getRequestBodySize());
    }
  }

  /**
   * Complete response method. Sets the response headers and body. Will set the
   * state to DONE.
   *
   * @param status response http status (default 200)
   * @param headers name-value headers (optional)
   * @param body response body (default null)
   * @param statusText response http status text (optional)
   */
  respond(
    status?: number,
    headers?: Record<string, string> | null,
    body?: any,
    statusText?: string
  ) {
    this.setResponseHeaders(status, headers, statusText);
    this.setResponseBody(body);
  }

  /**
   * Set only the response headers. Will change the state to HEADERS_RECEIVED.
   *
   * @param status response http status (default 200)
   * @param headers name-value headers (optional)
   * @param statusText response http status text (optional)
   */
  setResponseHeaders(
    status?: number,
    headers?: Record<string, string> | null,
    statusText?: string
  ) {
    if (this._readyState !== MockXhr.OPENED || !this._sendFlag) {
      throw new Error('Mock usage error detected.');
    }
    if (this._body) {
      this._requestEndOfBody();
    }
    status = typeof status === 'number' ? status : 200;
    const statusMessage = statusText ?? getStatusText(status);
    this._processResponse({
      status,
      statusMessage,
      headers: new HeadersContainer(headers),
    });
  }

  /**
   * Fire a response progress event. Will set the state to LOADING.
   *
   * @param transmitted transmitted bytes
   * @param length total bytes
   */
  downloadProgress(transmitted: number, length: number) {
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
   * @param body response body (default null)
   */
  setResponseBody(body: any = null) {
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

    this._response.body = body;
    this._handleResponseEndOfBody();
  }

  /**
   * Simulate a network error. Will set the state to DONE.
   */
  setNetworkError() {
    if (!this._sendFlag) {
      throw new Error('Mock usage error detected.');
    }
    this._processResponse(makeNetworkErrorResponse());
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
    this._processResponse(makeNetworkErrorResponse());
  }

  //-------
  // States
  //-------

  /**
   * https://xhr.spec.whatwg.org/#dom-xmlhttprequest-readystate
   *
   * @returns client's state
   */
  get readyState() {
    return this._readyState;
  }

  //--------
  // Request
  //--------

  /**
   * Set the request method and url.
   * https://xhr.spec.whatwg.org/#the-open()-method
   *
   * @param method request HTTP method (GET, POST, etc.)
   * @param url request url
   * @param async async request flag (only true is supported)
   */
  open(method: string, url: string, async = true) {
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
    this._method = method;
    this._url = url.toString();
    this._requestHeaders.reset();
    this._response = makeNetworkErrorResponse();
    if (this._readyState !== MockXhr.OPENED) {
      this._readyState = MockXhr.OPENED;
      this._fireReadyStateChange();
    }
  }

  /**
   * Add a request header value.
   * https://xhr.spec.whatwg.org/#the-setrequestheader()-method
   *
   * @param name header name
   * @param value header value
   */
  setRequestHeader(name: string, value: string) {
    if (this._readyState !== MockXhr.OPENED || this._sendFlag) {
      throwError('InvalidStateError');
    }
    if (typeof name !== 'string' || typeof value !== 'string') {
      throw new SyntaxError();
    }

    if (!isRequestHeaderForbidden(name)) {
      // Normalize value
      value = value.trim();
      this._requestHeaders.addHeader(name, value);
    }
  }

  /**
   * https://xhr.spec.whatwg.org/#dom-xmlhttprequest-timeout
   *
   * @returns timeout attribute
   */
  get timeout() {
    return this._timeout;
  }

  /**
   * https://xhr.spec.whatwg.org/#dom-xmlhttprequest-timeout
   *
   * @param value timeout value
   */
  set timeout(value: number) {
    // Since this library is meant to run on node, skip the step involving the Window object.
    this._timeout = value;
    if (this._sendFlag && this.timeoutEnabled && this._getPrototype().timeoutEnabled) {
      // A fetch is active so schedule a request timeout
      this._scheduleRequestTimeout();
    }
  }

  /**
   * https://xhr.spec.whatwg.org/#dom-xmlhttprequest-withcredentials
   *
   * @returns withCredentials attribute
   */
  get withCredentials() {
    return this._withCredentials;
  }

  /**
   * https://xhr.spec.whatwg.org/#dom-xmlhttprequest-withcredentials
   *
   * @param value withCredentials value
   */
  set withCredentials(value: boolean) {
    if ((this._readyState !== MockXhr.UNSENT && this._readyState !== MockXhr.OPENED)
      || this._sendFlag) {
      throwError('InvalidStateError');
    }
    this._withCredentials = !!value;
  }

  /**
   * https://xhr.spec.whatwg.org/#the-upload-attribute
   *
   * @returns upload attribute
   */
  get upload() {
    return this._upload;
  }

  /**
   * Initiate the request.
   * https://xhr.spec.whatwg.org/#the-send()-method
   *
   * @param body request body
   */
  send(body: any = null) {
    if (this._readyState !== MockXhr.OPENED || this._sendFlag) {
      throwError('InvalidStateError');
    }
    if (this._method === 'GET' || this._method === 'HEAD') {
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

      if (this._requestHeaders.getHeader('Content-Type') === null && extractedContentType !== null) {
        this._requestHeaders.addHeader('Content-Type', extractedContentType);
      }
    }

    this._uploadListenerFlag = this._upload.hasListeners();
    this._body = body;
    this._uploadCompleteFlag = this._body === null;
    this._timedOutFlag = false;
    this._sendFlag = true;

    this._fireEvent('loadstart', 0, 0);
    if (!this._uploadCompleteFlag && this._uploadListenerFlag) {
      this._fireUploadEvent('loadstart', 0, this.getRequestBodySize());
    }

    // Other interactions are done through the mock's response methods
    if (this._readyState !== MockXhr.OPENED || !this._sendFlag) {
      return;
    }

    this._timeoutReference = Date.now();
    this._scheduleRequestTimeout();

    {
      // Save the callback in case it changes before it has a chance to run
      const { onSend } = this;
      if (onSend) {
        Promise.resolve(true).then(() => onSend.call(this, this));
      }
    }
    {
      // Save the callback in case it changes before it has a chance to run
      const { onSend } = this._getPrototype();
      if (onSend) {
        Promise.resolve(true).then(() => onSend.call(this, this));
      }
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
      this._response = makeNetworkErrorResponse();
    }
  }

  //---------
  // Response
  //---------

  /**
   * https://xhr.spec.whatwg.org/#dom-xmlhttprequest-status
   *
   * @returns status attribute
   */
  get status() {
    return this._response.status;
  }

  /**
   * https://xhr.spec.whatwg.org/#the-statustext-attribute
   *
   * @returns statusText attribute
   */
  get statusText() {
    return this._response.statusMessage;
  }

  /**
   * Get a response header value.
   * https://xhr.spec.whatwg.org/#dom-xmlhttprequest-getresponseheader
   *
   * @param name header name
   * @returns header value
   */
  getResponseHeader(name: string): string | null {
    return this._response.headers.getHeader(name);
  }

  /**
   * Get all response headers as a string.
   * https://xhr.spec.whatwg.org/#dom-xmlhttprequest-getallresponseheaders
   *
   * @returns concatenated headers
   */
  getAllResponseHeaders(): string {
    return this._response.headers.getAll();
  }

  /**
   * Throws when required, but has no other effect.
   * https://xhr.spec.whatwg.org/#dom-xmlhttprequest-overridemimetype
   *
   * @param mime MIME type
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  overrideMimeType(mime: string) {
    if (this._readyState === MockXhr.LOADING || this._readyState === MockXhr.DONE) {
      throwError('InvalidStateError');
    }
    // noop
  }

  /**
   * https://xhr.spec.whatwg.org/#dom-xmlhttprequest-responsetype
   *
   * @returns responseType attribute
   */
  get responseType() {
    return this._responseType;
  }

  /**
   * https://xhr.spec.whatwg.org/#dom-xmlhttprequest-responsetype
   *
   * @param value responseType value
   */
  set responseType(value: XMLHttpRequestResponseType) {
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
   * @returns response
   */
  get response() {
    if (this._responseType === '' || this._responseType === 'text') {
      if (this._readyState !== MockXhr.LOADING && this._readyState !== MockXhr.DONE) {
        return '';
      }

      // No support for charset decoding as outlined in https://xhr.spec.whatwg.org/#text-response
      return this._response.body ?? '';
    }

    if (this._readyState !== MockXhr.DONE) {
      return null;
    }

    if (this._responseType === 'json') {
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
   * https://xhr.spec.whatwg.org/#the-responsetext-attribute
   *
   * @returns responseText attribute
   */
  get responseText() {
    if (this._responseType !== '' && this._responseType !== 'text') {
      throwError('InvalidStateError');
    }

    if (this._readyState !== MockXhr.LOADING && this._readyState !== MockXhr.DONE) {
      return '';
    }

    // No support for charset decoding as outlined in https://xhr.spec.whatwg.org/#text-response
    return this._response.body as string ?? '';
  }

  /**
   * https://xhr.spec.whatwg.org/#dom-xmlhttprequest-responsexml
   *
   * @returns responseXML attribute
   */
  get responseXML() {
    if (this._responseType !== '' && this._responseType !== 'document') {
      throwError('InvalidStateError');
    }

    if (this._readyState !== MockXhr.DONE) {
      return null;
    }

    // Since this library is meant to run on node, there is no support for charset decoding as
    // outlined in https://xhr.spec.whatwg.org/#text-response
    // If needed, a document response can be given to setResponseBody() to be returned here.
    return this._response.body ?? '';
  }

  //------------------------------
  // Request and response handling
  //------------------------------

  /**
   * Note: the "process request body" task is in the MockXhr response methods
   * Process request end-of-body task. When the whole request is sent.
   * https://xhr.spec.whatwg.org/#the-send()-method
   */
  private _requestEndOfBody() {
    this._uploadCompleteFlag = true;

    if (this._uploadListenerFlag) {
      // If no listeners were registered before send(), these steps do not run.
      const length = this.getRequestBodySize();
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
   * @param response response
   */
  private _processResponse(response: MockXhrResponse) {
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
  private _handleResponseEndOfBody() {
    this._handleResponseErrors();
    if (this._isNetworkErrorResponse()) {
      return;
    }
    const length = this._response.body?.length ?? 0;
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
  private _handleResponseErrors() {
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
   * @param event event name
   */
  private _requestErrorSteps(event: TXhrProgressEventNames) {
    this._readyState = MockXhr.DONE;
    this._sendFlag = false;
    this._response = makeNetworkErrorResponse();
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

  //----------
  // Internals
  //----------

  private _isNetworkErrorResponse() {
    return this._response.isError;
  }

  private _terminateRequest() {
    delete this._method;
    delete this._url;
  }

  private _fireEvent(name: TXhrProgressEventNames, transmitted: number, length: number) {
    this.dispatchEvent(new XhrProgressEvent(name, transmitted, length));
  }

  private _fireUploadEvent(name: TXhrProgressEventNames, transmitted: number, length: number) {
    this._upload.dispatchEvent(new XhrProgressEvent(name, transmitted, length));
  }

  private _fireReadyStateChange() {
    const event = new Event('readystatechange');
    if (this.onreadystatechange) {
      this.onreadystatechange(event);
    }
    this.dispatchEvent(event);
  }

  private _scheduleRequestTimeout() {
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

  private _getPrototype() {
    return this.constructor as typeof MockXhr;
  }
}

function throwError(type: string, text = '') {
  const exception = new Error(text);
  exception.name = type;
  throw exception;
}

function makeNetworkErrorResponse(): MockXhrResponse {
  return {
    isError: true,
    status: 0,
    statusMessage: '',
    headers: new HeadersContainer(),
    body: null,
  };
}
