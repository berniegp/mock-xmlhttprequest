/**
 * HTTP header container
 */
export default class HeadersContainer {
  private _headers: Map<string, string>;

  /**
   * @param headers Initial headers
   */
  constructor(headers?: Record<string, string> | null);
  constructor(src: HeadersContainer);
  constructor(headersOrSrc?: Record<string, string> | null | HeadersContainer) {
    this._headers = new Map();
    if (headersOrSrc) {
      if (headersOrSrc instanceof HeadersContainer) {
        // eslint-disable-next-line no-underscore-dangle
        this._headers = new Map(headersOrSrc._headers);
      } else {
        Object.entries(headersOrSrc).forEach(([key, value]) => this.addHeader(key, value));
      }
    }
  }

  /**
   * Reset the container to its empty state.
   *
   * @returns this
   */
  reset() {
    this._headers.clear();
    return this;
  }

  /**
   * @param name Header name (case insensitive)
   * @returns Header value or null
   */
  getHeader(name: string) {
    return this._headers.get(name.toUpperCase()) ?? null;
  }

  /**
   * Get all headers as a string. Each header is on its own line. All header names are lower-case.
   *
   * @returns Concatenated headers
   */
  getAll() {
    // Sort the header names. It's not mandated by RFC 7230 but it makes assertion testing easier
    // and, most importantly, it is required by getAllResponseHeaders() of XMLHttpRequest.
    // See https://xhr.spec.whatwg.org/#the-getallresponseheaders()-method
    const headerNames = [...this._headers.keys()].sort();

    // Combine the header values
    const headers = headerNames.reduce((result, name) => {
      const headerValue = this._headers.get(name);
      return `${result}${name.toLowerCase()}: ${headerValue}\r\n`;
    }, '');
    return headers;
  }

  /**
   * @returns All headers as an object. The header names are in lower-case.
   */
  getHash() {
    const headers: Record<string, string> = {};
    this._headers.forEach((value, name) => {
      headers[name.toLowerCase()] = value;
    });
    return headers;
  }

  /**
   * Add a header value, combining it with any previous value for the same header name.
   *
   * @param name Header name
   * @param value Header value
   * @returns this
   */
  addHeader(name: string, value: string) {
    name = name.toUpperCase();
    const currentValue = this._headers.get(name);
    if (currentValue) {
      value = `${currentValue}, ${value}`;
    }
    this._headers.set(name, value);
    return this;
  }
}
