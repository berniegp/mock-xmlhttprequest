import HeadersContainer from './HeadersContainer';

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
}
