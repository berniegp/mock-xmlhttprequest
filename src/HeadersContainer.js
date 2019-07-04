/**
 * HTTP header container
 */
export default class HeadersContainer {
  /**
   * @param {object} headers initial headers
   */
  constructor(headers) {
    this._headers = new Map();
    if (headers && headers instanceof Object) {
      Object.keys(headers).forEach((key) => {
        this.addHeader(key, headers[key]);
      });
    }
  }

  /**
   * Reset the container to its empty state.
   */
  reset() {
    this._headers.clear();
  }

  /**
   * Get header value. Header names are case-insensitive.
   *
   * @param  {string} name header name
   * @returns {string|null} header value or null
   */
  getHeader(name) {
    const value = this._headers.get(name.toLowerCase());
    return value !== undefined ? value : null;
  }

  /**
   * Get all headers as a string. Each header is on its own line.
   *
   * @returns {string} concatenated headers
   */
  getAll() {
    // Sort the header names. It's not mandated by RFC 7230 but it makes assertion testing easier
    // and, most importantly, it is required by getAllResponseHeaders() of XMLHttpRequest.
    // See https://xhr.spec.whatwg.org/#the-getallresponseheaders()-method
    const headerNames = [...this._headers.keys()].sort();

    // Combine the header values
    const headers = headerNames.reduce((result, name) => {
      const headerValue = this._headers.get(name);
      return `${result}${name}: ${headerValue}\r\n`;
    }, '');
    return headers;
  }

  /**
   * Get all headers as an object.
   *
   * @returns {object} headers
   */
  getHash() {
    const headers = {};
    this._headers.forEach((value, name) => {
      headers[name] = value;
    });
    return headers;
  }

  /**
   * Add a header value, combining it with any previous value for the same header name.
   *
   * @param {string} name header name
   * @param {string} value header value
   */
  addHeader(name, value) {
    name = name.toLowerCase();
    const currentValue = this._headers.get(name);
    if (currentValue) {
      value = `${currentValue}, ${value}`;
    }
    this._headers.set(name, value);
  }
}
