import { normalizeHTTPMethodName } from './Utils';

/**
 * Mock server for responding to XMLHttpRequest mocks from the class MockXhr. Provides simple route
 * matching and request handlers to make test harness creation easier.
 */
export default class MockXhrServer {
  /**
   * Constructor
   *
   * @param {MockXhr} xhrMock XMLHttpRequest mock class
   * @param {?object} routes routes
   */
  constructor(xhrMock, routes = {}) {
    this.MockXhr = xhrMock;
    this._requests = [];
    this._routes = {};
    Object.keys(routes).forEach((method) => {
      const [matcher, handler] = routes[method];
      this.addHandler(method, matcher, handler);
    });
    xhrMock.onSend = (xhr) => { this._handleRequest(xhr); };

    // Setup a mock request factory for users
    this.xhrMock = xhrMock; // For backwards compatibility with < 4.1.0
    this.xhrFactory = () => new this.MockXhr();
  }

  /**
   * Install the server's XMLHttpRequest mock in the context. Revert with remove().
   *
   * @param {object?} context context object (e.g. global, window)
   * @returns {MockXhrServer} this
   */
  install(context = global) {
    this._savedXMLHttpRequest = context.XMLHttpRequest;
    this._savedContext = context;
    context.XMLHttpRequest = this.MockXhr;
    return this;
  }

  /**
   * Remove the server as the global XMLHttpRequest mock. Reverts the actions of install(global).
   */
  remove() {
    if (!this._savedContext) {
      throw new Error('remove() called without matching install(global).');
    }

    if (this._savedXMLHttpRequest !== undefined) {
      this._savedContext.XMLHttpRequest = this._savedXMLHttpRequest;
      delete this._savedXMLHttpRequest;
    } else {
      delete this._savedContext.XMLHttpRequest;
    }
    delete this._savedContext;
  }

  /**
   * Disable the effects of the timeout attribute on the XMLHttpRequest mock used by the server.
   */
  disableTimeout() {
    this.MockXhr.timeoutEnabled = false;
  }

  /**
   * Enable the effects of the timeout attribute on the XMLHttpRequest mock used by the server.
   */
  enableTimeout() {
    this.MockXhr.timeoutEnabled = true;
  }

  /**
   * Add a GET request handler.
   *
   * @param {string|RegExp|Function} matcher url matcher
   * @param {object|Function|object[]|Function[]} handler request handler
   * @returns {MockXhrServer} this
   */
  get(matcher, handler) {
    return this.addHandler('GET', matcher, handler);
  }

  /**
   * Add a POST request handler.
   *
   * @param {string|RegExp|Function} matcher url matcher
   * @param {object|Function|object[]|Function[]} handler request handler
   * @returns {MockXhrServer} this
   */
  post(matcher, handler) {
    return this.addHandler('POST', matcher, handler);
  }

  /**
   * Add a PUT request handler.
   *
   * @param {string|RegExp|Function} matcher url matcher
   * @param {object|Function|object[]|Function[]} handler request handler
   * @returns {MockXhrServer} this
   */
  put(matcher, handler) {
    return this.addHandler('PUT', matcher, handler);
  }

  /**
   * Add a DELETE request handler.
   *
   * @param {string|RegExp|Function} matcher url matcher
   * @param {object|Function|object[]|Function[]} handler request handler
   * @returns {MockXhrServer} this
   */
  delete(matcher, handler) {
    return this.addHandler('DELETE', matcher, handler);
  }

  /**
   * Add a request handler.
   *
   * @param {string} method HTTP method
   * @param {string|RegExp|Function} matcher url matcher
   * @param {object|Function|object[]|Function[]} handler request handler
   * @returns {MockXhrServer} this
   */
  addHandler(method, matcher, handler) {
    // Match the processing done in MockXHR for the method name
    method = normalizeHTTPMethodName(method);

    if (!this._routes[method]) {
      this._routes[method] = [];
    }
    this._routes[method].push({
      matcher,
      handler,
      count: 0,
    });
    return this;
  }

  /**
   * Set the default request handler for requests that don't match any route.
   *
   * @param {object|Function|object[]|Function[]} handler request handler
   * @returns {MockXhrServer} this
   */
  setDefaultHandler(handler) {
    this._defaultRoute = {
      handler,
      count: 0,
    };
    return this;
  }

  /**
   * Return 404 responses for requests that don't match any route.
   *
   * @returns {MockXhrServer} this
   */
  setDefault404() {
    return this.setDefaultHandler({ status: 404 });
  }

  /**
   * @returns {object[]} list of requests received by the server. Entries: { method, url }
   */
  getRequestLog() {
    return this._requests;
  }

  _handleRequest(xhr) {
    // Record the request for easier debugging
    this._requests.push({
      method: xhr.method,
      url: xhr.url,
      headers: xhr.requestHeaders.getHash(),
      body: xhr.body,
    });

    const route = this._findFirstMatchingRoute(xhr) || this._defaultRoute;
    if (route) {
      // Routes can have arrays of handlers. Each one is used once and the last one is used if out
      // of elements.
      let { handler } = route;
      if (Array.isArray(handler)) {
        handler = handler[Math.min(handler.length - 1, route.count)];
      }
      route.count += 1;

      if (typeof handler === 'function') {
        handler(xhr);
      } else {
        xhr.respond(handler.status, handler.headers, handler.body, handler.statusText);
      }
    }
  }

  _findFirstMatchingRoute(xhr) {
    const method = normalizeHTTPMethodName(xhr.method);
    if (!this._routes[method]) {
      return undefined;
    }

    const { url } = xhr;
    return this._routes[method].find((route) => {
      const { matcher } = route;
      if (typeof matcher === 'function') {
        return matcher(url);
      } else if (matcher instanceof RegExp) {
        return matcher.test(url);
      }
      return matcher === url;
    });
  }
}
