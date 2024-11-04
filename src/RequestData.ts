import HeadersContainer from './HeadersContainer.ts';
import { getBodyByteSize } from './Utils.ts';

/**
 * Request parameters from MockXhr.send()
 */
export default class RequestData {
  private readonly _requestHeaders: HeadersContainer;
  private readonly _method: string;
  private readonly _url: string;
  private readonly _body: unknown;
  private readonly _credentialsMode: boolean;

  constructor(
    requestHeaders: HeadersContainer,
    method: string,
    url: string,
    body: unknown = null,
    credentialsMode = false
  ) {
    this._requestHeaders = requestHeaders;
    this._method = method;
    this._url = url;
    this._body = body;
    this._credentialsMode = credentialsMode;
  }

  /**
   * @returns Request headers container
   */
  get requestHeaders() { return new HeadersContainer(this._requestHeaders); }

  get method() { return this._method; }

  get url() { return this._url; }

  // Changing the return type to unknown is a breaking change with little to no benefit to users
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any
  get body() { return this._body as any; }

  get withCredentials() { return this._credentialsMode; }

  /**
   * Note: this isn't completely accurate for a multipart/form-data encoded FormData request body.
   * MockXhr not consider headers, encoding, and other factors that influence the request body size
   * of non-mocked XMLHttpRequest. You can consider the value returned by this method as a floor
   * value for the request body size. This can still be useful to simulate upload progress events.
   *
   * @returns Request body's total byte size
   */
  getRequestBodySize() {
    return getBodyByteSize(this.body);
  }
}
