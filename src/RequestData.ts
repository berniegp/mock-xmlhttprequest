import HeadersContainer from './HeadersContainer';
import { getBodyByteSize } from './Utils';

/**
 * Request parameters from MockXhr.send()
 */
export default class RequestData {
  constructor(
    private readonly _requestHeaders: HeadersContainer,
    private readonly _method: string,
    private readonly _url: string,
    private readonly _body: any = null,
    private readonly _credentialsMode: boolean = false
  ) {}

  /**
   * @returns Request headers container
   */
  get requestHeaders() { return new HeadersContainer(this._requestHeaders); }

  get method() { return this._method; }

  get url() { return this._url; }

  get body() { return this._body; }

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
