/**
 * HTTP header container
 */
export default class HeadersContainer {
  private _headers: Map<string, string>;

  /**
   * @param headers initial headers
   */
  constructor(headers?: Record<string, string> | null) {
    this._headers = new Map();
    if (headers) {
      Object.entries(headers).forEach(([key, value]) => this.addHeader(key, value));
    }
  }

  /**
   * Reset the container to its empty state.
   */
  reset() {
    this._headers.clear();
  }

  /**
   * @param name header name (case-insensitive)
   * @returns header value or null
   */
  getHeader(name: string) {
    return this._headers.get(name.toUpperCase()) ?? null;
  }

  /**
   * Get all headers as a string. Each header is on its own line.
   *
   * @returns concatenated headers
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
   * @returns all headers as an object.
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
   * @param name header name
   * @param value header value
   */
  addHeader(name: string, value: string) {
    name = name.toUpperCase();
    const currentValue = this._headers.get(name);
    if (currentValue) {
      value = `${currentValue}, ${value}`;
    }
    this._headers.set(name, value);
  }
}
