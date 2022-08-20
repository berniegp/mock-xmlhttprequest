import HeadersContainer from './HeadersContainer';
import MockXhrRequest from './MockXhrRequest';
import RequestData from './RequestData';
import XhrEvent from './XhrEvent';
import XhrProgressEvent from './XhrProgressEvent';
import {
  getBodyByteSize,
  getStatusText,
  isRequestHeaderForbidden,
  isRequestMethodForbidden,
  normalizeHTTPMethodName,
} from './Utils';
import XhrEventTarget from './XhrEventTarget';

import type { MockXhrResponseReceiver } from './MockXhrResponseReceiver';
import type { TXhrProgressEventNames } from './XhrProgressEventsNames';

interface MockXhrResponse {
  isNetworkError?: boolean,
  status: number,
  statusMessage: string,
  headers: HeadersContainer,
  body?: any,
}

export type OnCreateCallback = (xhr: MockXhr) => void;

export type OnSendCallback = (this: MockXhrRequest, request: MockXhrRequest) => void;

/**
 * XMLHttpRequest mock for testing.
 * Based on https://xhr.spec.whatwg.org version '18 August 2020'.
 *
 * Supports:
 *  - Events and states
 *  - open(), setRequestHeader(), send() and abort()
 *  - Upload and download progress events
 *  - Response status, statusText, headers and body
 *  - The timeout attribute (can be disabled)
 *  - Simulating a network error (see setNetworkError())
 *  - Simulating a request timeout (see setRequestTimeout())
 *
 * Partial support:
 *  - overrideMimeType(): throws when required, but has no other effect.
 *  - responseType: '', 'text' and 'json' are fully supported. The responseType values have no
 *    effect on the response body passed to setResponseBody().
 *  - responseXml: the response body is not converted to a document response. To get a document
 *    response, pass it directly as the response body in setResponseBody().
 *  - responseUrl: the final request URL after redirects isn't automatically set. This can be
 *    emulated in a request handler.
 *
 * Not supported:
 * - Synchronous requests (i.e. async set to false in open())
 * - Parsing the request URL in open() and throwing SyntaxError on failure.
 */
export default class MockXhr
  extends XhrEventTarget
  implements XMLHttpRequest, MockXhrResponseReceiver {
  private _authorRequestHeaders: HeadersContainer;

  private _requestMethod?: string;

  private _requestUrl?: string;

  private _readyState: number;

  private _timeout: number;

  private _crossOriginCredentials: boolean;

  private _currentRequest?: MockXhrRequest;

  private readonly _uploadObject: XhrEventTarget;

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
    this._authorRequestHeaders = new HeadersContainer();

    this._readyState = MockXhr.UNSENT;
    this._timeout = 0;
    this._crossOriginCredentials = false;
    this._uploadObject = new XhrEventTarget(this);
    this.responseURL = '';
    this._responseType = '';
    this._response = makeNetworkErrorResponse();
    this._timeoutReference = 0;

    this.onreadystatechange = null;

    this.timeoutEnabled = true;
    MockXhr.onCreate?.(this);
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
  static onCreate?: OnCreateCallback;

  /**
   * Per-instance hook for XMLHttpRequest.send(). Executes in an empty callstack.
   */
  onSend?: OnSendCallback;

  /**
   * Global hook for XMLHttpRequest.send(). Executes in an empty callstack.
   */
  static onSend?: OnSendCallback;

  /**
   * @returns The current active request, if any
   */
  get currentRequest() { return this._currentRequest; }

  /**
   * @returns All response headers as an object. The header names are in lower-case.
   */
  getResponseHeadersHash() {
    return this._response.headers.getHash();
  }

  //------------------------
  // MockXhrResponseReceiver
  //------------------------

  /**
   * Fire a request upload progress event.
   *
   * @param request Originating request
   * @param transmitted Bytes transmitted
   * @see {@link https://xhr.spec.whatwg.org/#the-send()-method "processRequestBodyChunkLength" steps}
   */
  uploadProgress(request: RequestData, transmitted: number) {
    // Only act if the originating request is the current active request
    if (this._currentRequest?.requestData === request) {
      if (!this._sendFlag) {
        throw new Error('Mock usage error detected: call send() first (the "send() flag" is not set)');
      }
      if (this._uploadCompleteFlag) {
        throw new Error('Mock usage error detected: upload already completed (the "upload complete flag" is set)');
      }
      if (this._uploadListenerFlag) {
        // If no listeners were registered before send(), no upload events should be fired.
        this._fireUploadProgressEvent('progress', transmitted, getBodyByteSize(request.body));
      }
    }
  }

  /**
   * Set the response headers. Changes the request's readyState to HEADERS_RECEIVED.
   *
   * @param request Originating request
   * @param status Response http status (default 200)
   * @param headers Name-value headers (optional)
   * @param statusText Response http status text (optional)
   */
  setResponseHeaders(
    request: RequestData,
    status?: number,
    headers?: Record<string, string> | null,
    statusText?: string
  ) {
    // Only act if the originating request is the current active request
    if (this._currentRequest?.requestData === request) {
      if (!this._sendFlag) {
        throw new Error('Mock usage error detected: call send() first (the "send() flag" is not set)');
      }
      if (this._readyState !== MockXhr.OPENED) {
        throw new Error(`Mock usage error detected: readyState is ${this._readyState}, but it must be OPENED (${MockXhr.OPENED})`);
      }
      if (request.body) {
        this._processRequestEndOfBody(getBodyByteSize(request.body));
      }
      status = typeof status === 'number' ? status : 200;
      const statusMessage = statusText ?? getStatusText(status);
      this._processResponse({
        status,
        statusMessage,
        headers: new HeadersContainer(headers),
      });
    }
  }

  /**
   * Fire a response progress event. Changes the request's readyState to LOADING.
   *
   * @param request Originating request
   * @param transmitted Transmitted bytes
   * @param length Total bytes
   * @see {@link https://xhr.spec.whatwg.org/#the-send()-method "processBodyChunk" steps}
   */
  downloadProgress(request: RequestData, transmitted: number, length: number) {
    // Only act if the originating request is the current active request
    if (this._currentRequest?.requestData === request) {
      if (this._readyState !== MockXhr.HEADERS_RECEIVED
        && this._readyState !== MockXhr.LOADING) {
        throw new Error(`Mock usage error detected: readyState is ${this._readyState}, but it must be `
          + `HEADERS_RECEIVED (${MockXhr.HEADERS_RECEIVED}) or LOADING (${MockXhr.LOADING})`);
      }

      if (this._readyState === MockXhr.HEADERS_RECEIVED) {
        this._readyState = MockXhr.LOADING;
      }

      // As stated in https://xhr.spec.whatwg.org/#the-send()-method
      // Web compatibility is the reason readystatechange fires more often than state changes.
      this._fireReadyStateChangeEvent();
      this._fireProgressEvent('progress', transmitted, length);
    }
  }

  /**
   * Set the response body. Changes the request's readyState to DONE.
   *
   * @param request Originating request
   * @param body Response body
   */
  setResponseBody(request: RequestData, body: any) {
    // Only act if the originating request is the current active request
    if (this._currentRequest?.requestData === request) {
      if (!this._sendFlag) {
        throw new Error('Mock usage error detected: call send() first (the "send() flag" is not set)');
      }
      if (this._readyState !== MockXhr.OPENED
          && this._readyState !== MockXhr.HEADERS_RECEIVED
          && this._readyState !== MockXhr.LOADING) {
        throw new Error(`Mock usage error detected: readyState is ${this._readyState}, but it must be `
          + `OPENED (${MockXhr.OPENED}), HEADERS_RECEIVED (${MockXhr.HEADERS_RECEIVED}) or LOADING (${MockXhr.LOADING})`);
      }

      if (this._readyState === MockXhr.OPENED) {
        // Default "200 - OK" response headers
        this.setResponseHeaders(request);
      }

      // As stated in https://xhr.spec.whatwg.org/#the-send()-method
      // Web compatibility is the reason readystatechange fires more often than
      // state changes.
      this._readyState = MockXhr.LOADING;
      this._fireReadyStateChangeEvent();

      this._response.body = body;
      this._handleResponseEndOfBody();
    }
  }

  /**
   * Simulate a network error. Changes the request's readyState to DONE.
   *
   * @param request Originating request
   */
  setNetworkError(request: RequestData) {
    // Only act if the originating request is the current active request
    if (this._currentRequest?.requestData === request) {
      if (!this._sendFlag) {
        throw new Error('Mock usage error detected: call send() first (the "send() flag" is not set)');
      }
      this._processResponse(makeNetworkErrorResponse());
    }
  }

  /**
   * Simulate a request timeout. Changes the request's readyState to DONE.
   *
   * @param request Originating request
   */
  setRequestTimeout(request: RequestData) {
    // Only act if the originating request is the current active request
    if (this._currentRequest?.requestData === request) {
      if (!this._sendFlag) {
        throw new Error('Mock usage error detected: call send() first (the "send() flag" is not set)');
      }
      if (this.timeout === 0) {
        throw new Error('Mock usage error detected: the timeout attribute must be greater than 0 for a timeout to occur');
      }
      this._terminateFetchController();
      this._timedOutFlag = true;
      this._processResponse(makeNetworkErrorResponse());
    }
  }

  //-------
  // States
  //-------

  /**
   * @returns Client's state
   * @see {@link https://xhr.spec.whatwg.org/#dom-xmlhttprequest-readystate}
   */
  get readyState() { return this._readyState; }

  //--------
  // Request
  //--------

  /**
   * Set the request method and url.
   *
   * @param method Request HTTP method (GET, POST, etc.)
   * @param url Request url
   * @param async Async request flag (only true or omitted is supported)
   * @see {@link https://xhr.spec.whatwg.org/#the-open()-method}
   */
  open(method: string, url: string | URL, async = true) {
    if (!async) {
      throw new Error('async = false is not supported.');
    }
    if (isRequestMethodForbidden(method)) {
      throwError('SecurityError', `Method "${method}" forbidden.`);
    }
    method = normalizeHTTPMethodName(method);
    // Skip parsing the url and setting the username and password

    this._terminateFetchController();

    // Set variables
    this._sendFlag = false;
    this._uploadListenerFlag = false;
    this._requestMethod = method;
    this._requestUrl = url.toString();
    this._authorRequestHeaders.reset();
    this._response = makeNetworkErrorResponse();
    if (this._readyState !== MockXhr.OPENED) {
      this._readyState = MockXhr.OPENED;
      this._fireReadyStateChangeEvent();
    }
  }

  /**
   * Add a request header value.
   *
   * @param name Header name
   * @param value Header value
   * @see {@link https://xhr.spec.whatwg.org/#the-setrequestheader()-method}
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
      this._authorRequestHeaders.addHeader(name, value);
    }
  }

  /**
   * @returns timeout attribute
   * @see {@link https://xhr.spec.whatwg.org/#dom-xmlhttprequest-timeout}
   */
  get timeout() { return this._timeout; }

  /**
   * @param value timeout value
   * @see {@link https://xhr.spec.whatwg.org/#dom-xmlhttprequest-timeout}
   */
  set timeout(value: number) {
    // Since this library is meant to run on node, skip the step involving the Window object.
    this._timeout = value;

    // Use this._getPrototype() to get the value of timeoutEnabled on the most derived class'
    // prototype. This allows overriding from a derived class.
    if (this._sendFlag && this.timeoutEnabled && this._getPrototype().timeoutEnabled) {
      this._scheduleRequestTimeout();
    }
  }

  /**
   * @returns withCredentials attribute
   * @see {@link https://xhr.spec.whatwg.org/#dom-xmlhttprequest-withcredentials}
   */
  get withCredentials() { return this._crossOriginCredentials; }

  /**
   * @param value withCredentials value
   * @see {@link https://xhr.spec.whatwg.org/#dom-xmlhttprequest-withcredentials}
   */
  set withCredentials(value: boolean) {
    if ((this._readyState !== MockXhr.UNSENT && this._readyState !== MockXhr.OPENED)
      || this._sendFlag) {
      throwError('InvalidStateError');
    }
    this._crossOriginCredentials = !!value;
  }

  /**
   * @returns upload attribute
   * @see {@link https://xhr.spec.whatwg.org/#the-upload-attribute}
   */
  get upload() { return this._uploadObject; }

  /**
   * Initiate the request.
   *
   * @param body Request body
   * @see {@link https://xhr.spec.whatwg.org/#the-send()-method}
   */
  send(body: any = null) {
    if (this._readyState !== MockXhr.OPENED || this._sendFlag) {
      throwError('InvalidStateError');
    }
    if (this._requestMethod === 'GET' || this._requestMethod === 'HEAD') {
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

      if (this._authorRequestHeaders.getHeader('Content-Type') === null && extractedContentType !== null) {
        this._authorRequestHeaders.addHeader('Content-Type', extractedContentType);
      }
    }

    this._uploadListenerFlag = this._uploadObject.hasListeners();
    this._uploadCompleteFlag = body === null;
    this._timedOutFlag = false;
    this._sendFlag = true;

    this._fireProgressEvent('loadstart', 0, 0);
    if (!this._uploadCompleteFlag && this._uploadListenerFlag) {
      this._fireUploadProgressEvent('loadstart', 0, getBodyByteSize(body));
    }

    if (this._readyState !== MockXhr.OPENED || !this._sendFlag) {
      return;
    }

    this._timeoutReference = Date.now();
    this._scheduleRequestTimeout();

    const requestData = new RequestData(
      new HeadersContainer(this._authorRequestHeaders),
      this._requestMethod as string,
      this._requestUrl as string,
      body,
      this._crossOriginCredentials
    );
    this._currentRequest = new MockXhrRequest(requestData, this);

    this._callOnSend(MockXhr.onSend);
    const prototype = this._getPrototype();
    if (prototype !== MockXhr) {
      this._callOnSend(prototype.onSend);
    }
    this._callOnSend(this.onSend);
  }

  /**
   * Abort the request.
   * @see {@link https://xhr.spec.whatwg.org/#the-abort()-method}
   */
  abort() {
    this._terminateFetchController();

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
   * @returns status attribute
   * @see {@link https://xhr.spec.whatwg.org/#dom-xmlhttprequest-status}
   */
  get status() { return this._response.status; }

  /**
   * @returns statusText attribute
   * @see {@link https://xhr.spec.whatwg.org/#the-statustext-attribute}
   */
  get statusText() { return this._response.statusMessage; }

  /**
   * Get a response header value.
   *
   * @param name Header name
   * @returns Header value
   * @see {@link https://xhr.spec.whatwg.org/#dom-xmlhttprequest-getresponseheader}
   */
  getResponseHeader(name: string): string | null {
    return this._response.headers.getHeader(name);
  }

  /**
   * Get all response headers as a string.
   *
   * @returns Concatenated headers
   * @see {@link https://xhr.spec.whatwg.org/#dom-xmlhttprequest-getallresponseheaders}
   */
  getAllResponseHeaders(): string {
    return this._response.headers.getAll();
  }

  /**
   * Throws when required, but has no other effect.
   *
   * @param mime MIME type
   * @see {@link https://xhr.spec.whatwg.org/#dom-xmlhttprequest-overridemimetype}
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  overrideMimeType(mime: string) {
    if (this._readyState === MockXhr.LOADING || this._readyState === MockXhr.DONE) {
      throwError('InvalidStateError');
    }
    // noop
  }

  /**
   * @returns responseType attribute
   * @see {@link https://xhr.spec.whatwg.org/#dom-xmlhttprequest-responsetype}
   */
  get responseType() { return this._responseType; }

  /**
   * @param value responseType value
   * @see {@link https://xhr.spec.whatwg.org/#dom-xmlhttprequest-responsetype}
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
   * @returns response attribute
   * @see {@link https://xhr.spec.whatwg.org/#the-response-attribute}
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
   * @returns responseText attribute
   * @see {@link https://xhr.spec.whatwg.org/#the-responsetext-attribute}
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
   * @returns responseXML attribute
   * @see {@link https://xhr.spec.whatwg.org/#dom-xmlhttprequest-responsexml}
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
   * Steps for when the request upload is complete.
   *
   * @param bodySize request body size in bytes
   * @see {@link https://xhr.spec.whatwg.org/#the-send()-method "processRequestEndOfBody" steps}
   */
  private _processRequestEndOfBody(bodySize: number) {
    this._uploadCompleteFlag = true;

    if (this._uploadListenerFlag) {
      // If no listeners were registered before send(), these steps do not run.
      const transmitted = bodySize;
      this._fireUploadProgressEvent('progress', transmitted, bodySize);
      this._fireUploadProgressEvent('load', transmitted, bodySize);
      this._fireUploadProgressEvent('loadend', transmitted, bodySize);
    }
  }

  /**
   * Steps for when the response headers are received.
   *
   * @param response Response
   * @see {@link https://xhr.spec.whatwg.org/#the-send()-method "processResponse" steps}
   */
  private _processResponse(response: MockXhrResponse) {
    this._response = response;
    this._handleErrors();
    if (this._response.isNetworkError) {
      return;
    }

    this._readyState = MockXhr.HEADERS_RECEIVED;
    this._fireReadyStateChangeEvent();
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
   *
   * @see {@link https://xhr.spec.whatwg.org/#handle-response-end-of-body}
   */
  private _handleResponseEndOfBody() {
    this._handleErrors();
    if (this._response.isNetworkError) {
      return;
    }
    const length = this._response.body?.length ?? 0;
    this._fireProgressEvent('progress', length, length);
    this._readyState = MockXhr.DONE;
    this._sendFlag = false;
    this._terminateFetchController();
    this._fireReadyStateChangeEvent();
    this._fireProgressEvent('load', length, length);
    this._fireProgressEvent('loadend', length, length);
  }

  /**
   * The "handle errors" steps.
   *
   * @see {@link https://xhr.spec.whatwg.org/#handle-errors}
   */
  private _handleErrors() {
    if (!this._sendFlag) {
      return;
    }
    if (this._timedOutFlag) {
      // Timeout
      this._requestErrorSteps('timeout');
    } else if (this._response.isNetworkError) {
      // Network error
      this._requestErrorSteps('error');
    }
  }

  /**
   * The "request error steps" for event 'event'.
   *
   * @param event Event name
   * @see {@link https://xhr.spec.whatwg.org/#request-error-steps}
   */
  private _requestErrorSteps(event: TXhrProgressEventNames) {
    this._readyState = MockXhr.DONE;
    this._sendFlag = false;
    this._response = makeNetworkErrorResponse();
    this._fireReadyStateChangeEvent();
    if (!this._uploadCompleteFlag) {
      this._uploadCompleteFlag = true;

      if (this._uploadListenerFlag) {
        // If no listeners were registered before send(), no upload events should be fired.
        this._fireUploadProgressEvent(event, 0, 0);
        this._fireUploadProgressEvent('loadend', 0, 0);
      }
    }
    this._fireProgressEvent(event, 0, 0);
    this._fireProgressEvent('loadend', 0, 0);
  }

  //----------
  // Internals
  //----------

  protected _callOnSend(onSend?: OnSendCallback) {
    // Saves the callback and request data in case they change before then() executes
    if (onSend) {
      const request = this._currentRequest as MockXhrRequest;
      Promise.resolve(true).then(() => onSend.call(request, request));
    }
  }

  private _terminateFetchController() {
    delete this._requestMethod;
    delete this._requestUrl;
    delete this._currentRequest;
  }

  private _fireProgressEvent(name: TXhrProgressEventNames, transmitted: number, length: number) {
    this.dispatchEvent(new XhrProgressEvent(name, transmitted, length));
  }

  private _fireUploadProgressEvent(
    name: TXhrProgressEventNames,
    transmitted: number,
    length: number
  ) {
    this._uploadObject.dispatchEvent(new XhrProgressEvent(name, transmitted, length));
  }

  private _fireReadyStateChangeEvent() {
    const event = new XhrEvent('readystatechange');
    if (this.onreadystatechange) {
      this.onreadystatechange(event as Event);
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
          this._currentRequest!.setRequestTimeout();
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
    isNetworkError: true,
    status: 0,
    statusMessage: '',
    headers: new HeadersContainer(),
    body: null,
  };
}
