import MockXhr from './MockXhr';
import { normalizeHTTPMethodName } from './Utils';

export type UrlMatcher = ((url: string) => boolean) | string | RegExp;

interface RequestHandlerResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
}

type RequestHandlerCallback = (xhr: MockXhr) => void;

export type RequestHandler =
  Partial<RequestHandlerResponse>
  | RequestHandlerCallback
  | (Partial<RequestHandlerResponse> | RequestHandlerCallback)[];

interface Route {
  matcher: UrlMatcher,
  handler: RequestHandler,
  count: number,
}

interface RequestLogEntry {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: any
}

/**
 * Mock server for responding to XMLHttpRequest mocks from the class MockXhr. Provides simple route
 * matching and request handlers to make test harness creation easier.
 */
export default class MockXhrServer {
  private _MockXhr: typeof MockXhr;

  private _requests: RequestLogEntry[];

  private _routes: Record<string, Route[]>;

  private _xhrFactory: () => MockXhr;

  private _savedContext?: any;

  private _savedContextHadXMLHttpRequest?: boolean;

  private _savedXMLHttpRequest?: any;

  private _defaultRoute?: { handler: RequestHandler; count: number; };

  /**
   * Constructor
   *
   * @param xhrMock XMLHttpRequest mock class
   * @param routes routes
   */
  constructor(xhrMock: typeof MockXhr, routes?: Record<string, [UrlMatcher, RequestHandler]>) {
    this._MockXhr = xhrMock;
    this._requests = [];
    this._routes = {};
    if (routes) {
      Object.entries(routes).forEach(([method, [requestMatcher, handler]]) => {
        this.addHandler(method, requestMatcher, handler);
      });
    }
    xhrMock.onSend = (xhr) => { this._handleRequest(xhr); };

    // Setup a mock request factory for users
    this._xhrFactory = () => new this._MockXhr();
  }

  public get MockXhr() {
    return this._MockXhr;
  }

  public get xhrFactory() {
    return this._xhrFactory;
  }

  /**
   * Install the server's XMLHttpRequest mock in the context. Revert with remove().
   *
   * @param context context object (e.g. global, window)
   * @returns this
   */
  install(context: any = globalThis) {
    this._savedContext = context;

    // Distinguish between an undefined and a missing XMLHttpRequest property
    if ('XMLHttpRequest' in context) {
      this._savedContextHadXMLHttpRequest = true;
      this._savedXMLHttpRequest = context.XMLHttpRequest;
    } else {
      this._savedContextHadXMLHttpRequest = false;
    }
    context.XMLHttpRequest = this._MockXhr;
    return this;
  }

  /**
   * Remove the server as the global XMLHttpRequest mock. Reverts the actions of install(global).
   */
  remove() {
    if (!this._savedContext) {
      throw new Error('remove() called without a matching install(context).');
    }

    if (this._savedContextHadXMLHttpRequest) {
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
    this._MockXhr.timeoutEnabled = false;
  }

  /**
   * Enable the effects of the timeout attribute on the XMLHttpRequest mock used by the server.
   */
  enableTimeout() {
    this._MockXhr.timeoutEnabled = true;
  }

  /**
   * Add a GET request handler.
   *
   * @param matcher url matcher
   * @param handler request handler
   * @returns this
   */
  get(matcher: UrlMatcher, handler: RequestHandler) {
    return this.addHandler('GET', matcher, handler);
  }

  /**
   * Add a POST request handler.
   *
   * @param matcher url matcher
   * @param handler request handler
   * @returns this
   */
  post(matcher: UrlMatcher, handler: RequestHandler) {
    return this.addHandler('POST', matcher, handler);
  }

  /**
   * Add a PUT request handler.
   *
   * @param matcher url matcher
   * @param handler request handler
   * @returns this
   */
  put(matcher: UrlMatcher, handler: RequestHandler) {
    return this.addHandler('PUT', matcher, handler);
  }

  /**
   * Add a DELETE request handler.
   *
   * @param matcher url matcher
   * @param handler request handler
   * @returns this
   */
  delete(matcher: UrlMatcher, handler: RequestHandler) {
    return this.addHandler('DELETE', matcher, handler);
  }

  /**
   * Add a request handler.
   *
   * @param method HTTP method
   * @param matcher url matcher
   * @param handler request handler
   * @returns this
   */
  addHandler(method: string, matcher: UrlMatcher, handler: RequestHandler) {
    // Match the processing done in MockXHR for the method name
    method = normalizeHTTPMethodName(method);
    const routes = this._routes[method] ?? (this._routes[method] = []);
    routes.push({ matcher, handler, count: 0 });
    return this;
  }

  /**
   * Set the default request handler for requests that don't match any route.
   *
   * @param handler request handler
   * @returns this
   */
  setDefaultHandler(handler: RequestHandler) {
    this._defaultRoute = { handler, count: 0 };
    return this;
  }

  /**
   * Return 404 responses for requests that don't match any route.
   *
   * @returns this
   */
  setDefault404() {
    return this.setDefaultHandler({ status: 404 });
  }

  /**
   * @returns list of requests received by the server. Entries: { method, url, headers, body? }
   */
  getRequestLog(): readonly RequestLogEntry[] {
    return this._requests;
  }

  private _handleRequest(xhr: MockXhr) {
    // Record the request for easier debugging
    this._requests.push({
      method: xhr.method,
      url: xhr.url,
      headers: xhr.requestHeaders.getHash(),
      body: xhr.body,
    });

    const route = this._findFirstMatchingRoute(xhr) ?? this._defaultRoute;
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

  private _findFirstMatchingRoute(xhr: MockXhr) {
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
