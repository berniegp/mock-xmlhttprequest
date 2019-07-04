export class MockXhr {
  constructor();

  /**
   * Set the request method and url.
   * https://xhr.spec.whatwg.org/#the-open()-method
   *
   * @param method request HTTP method (GET, POST, etc.)
   * @param url request url
   * @param async async request flag (only true is supported)
   */
  open(method: string, url: string, async?: boolean): void;

  /**
   * Add a request header value.
   * https://xhr.spec.whatwg.org/#the-setrequestheader()-method
   *
   * @param name header name
   * @param value header value
   */
  setRequestHeader(name: string, value: string): void;

  /**
   * Initiate the request.
   * https://xhr.spec.whatwg.org/#the-send()-method
   *
   * @param body request body
   */
  send(body?: any): void;

  /**
   * Abort the request.
   * https://xhr.spec.whatwg.org/#the-abort()-method
   */
  abort(): void;

  /**
   * Get a response header value.
   * https://xhr.spec.whatwg.org/#dom-xmlhttprequest-getresponseheader
   *
   * @param name header name
   * @returns header value
   */
  getResponseHeader(name: string): string | null;

  /**
   * Get all response headers as a string.
   * https://xhr.spec.whatwg.org/#dom-xmlhttprequest-getallresponseheaders
   *
   * @returns concatenated headers
   */
  getAllResponseHeaders(): string;

  /**
   * https://xhr.spec.whatwg.org/#dom-xmlhttprequest-overridemimetype
   *
   * @param mime MIME type
   */
  overrideMimeType(mime: string): void;

  /**
   * Fire a request upload progress event.
   *
   * @param transmitted bytes transmitted
   */
  uploadProgress(transmitted: number): void;

  /**
   * Complete response method. Sets the response headers and body. Will set the
   * state to DONE.
   *
   * @param status response http status (default 200)
   * @param headers name-value headers (optional)
   * @param body response body (default null)
   * @param statusText response http status text (optional)
   */
  respond(status?: number, headers?: object, body?: any, statusText?: string): void;

  /**
   * Set only the response headers. Will change the state to HEADERS_RECEIVED.
   *
   * @param status response http status (default 200)
   * @param headers name-value headers (optional)
   * @param statusText response http status text (optional)
   */
  setResponseHeaders(status?: number, headers?: object, statusText?: string): void;

  /**
   * Fire a response progress event. Will set the state to LOADING.
   *
   * @param transmitted transmitted bytes
   * @param length total bytes
   */
  downloadProgress(transmitted: number, length: number): void;

  /**
   * Set the response body. Will set the state to DONE.
   *
   * @param body response body (default null)
   */
  setResponseBody(body?: any): void;

  /**
   * Simulate a network error. Will set the state to DONE.
   */
  setNetworkError(): void;

  /**
   * Simulate a request timeout. Will set the state to DONE.
   */
  setRequestTimeout(): void;

  // Global flag to enable the effects of the timeout attribute
  static timeoutEnabled: boolean;

  static DONE: number;
  static HEADERS_RECEIVED: number;
  static LOADING: number;
  static OPENED: number;
  static UNSENT: number;
}
