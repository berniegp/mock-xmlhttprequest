import RequestData from './RequestData';

import type { MockXhrResponseReceiver } from './MockXhrResponseReceiver';

/**
 * A request produced by MockXhr.send() and methods to respond to it.
 *
 * Each call to MockXhr.send() on an instance creates a new instance of MockXhrRequest. When there
 * are multiple active MockXhrRequest instances for the same MockXhr instance, only the response to
 * the last one is considered. Responses to previous MockXhrRequests are ignored.
 */
export default class MockXhrRequest {
  constructor(
    private readonly _requestData: RequestData,
    private readonly _responseReceiver: MockXhrResponseReceiver
  ) {}

  get requestData() { return this._requestData; }

  /**
   * @returns Request headers container
   */
  get requestHeaders() { return this._requestData.requestHeaders; }

  get method() { return this._requestData.method; }

  get url() { return this._requestData.url; }

  get body() { return this._requestData.body; }

  get withCredentials() { return this._requestData.withCredentials; }

  /**
   * Note: this isn't completely accurate for a multipart/form-data encoded FormData request body.
   * MockXhr not consider headers, encoding, and other factors that influence the request body size
   * of non-mocked XMLHttpRequest. You can consider the value returned by this method as a floor
   * value for the request body size. This can still be useful to simulate upload progress events.
   *
   * @returns Request body's total byte size
   */
  getRequestBodySize() { return this._requestData.getRequestBodySize(); }

  /**
   * Fire a request upload progress event.
   *
   * @param transmitted Transmitted bytes
   */
  uploadProgress(transmitted: number) {
    this._responseReceiver.uploadProgress(this._requestData, transmitted);
  }

  /**
   * Complete response method that sets the response headers and body. Changes the request's
   * readyState to DONE.
   *
   * @param status Response http status (default 200)
   * @param headers Name-value headers (optional)
   * @param body Response body (default null)
   * @param statusText Response http status text (optional)
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
   * Set the response headers. Changes the request's readyState to HEADERS_RECEIVED.
   *
   * @param status Response http status (default 200)
   * @param headers Name-value headers (optional)
   * @param statusText Response http status text (optional)
   */
  setResponseHeaders(
    status?: number,
    headers?: Record<string, string> | null,
    statusText?: string
  ) {
    this._responseReceiver.setResponseHeaders(this._requestData, status, headers, statusText);
  }

  /**
   * Fire a response progress event. Changes the request's readyState to LOADING.
   *
   * @param transmitted Transmitted bytes
   * @param length Body length in bytes
   */
  downloadProgress(transmitted: number, length: number) {
    this._responseReceiver.downloadProgress(this._requestData, transmitted, length);
  }

  /**
   * Set the response body. Changes the request's readyState to DONE.
   *
   * @param body Response body (default null)
   */
  setResponseBody(body: any = null) {
    this._responseReceiver.setResponseBody(this._requestData, body);
  }

  /**
   * Simulate a network error. Changes the request's readyState to DONE.
   */
  setNetworkError() {
    this._responseReceiver.setNetworkError(this._requestData);
  }

  /**
   * Simulate a request timeout. Changes the request's readyState to DONE.
   */
  setRequestTimeout() {
    this._responseReceiver.setRequestTimeout(this._requestData);
  }
}
