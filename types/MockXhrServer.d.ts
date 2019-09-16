import MockXhr from "./MockXhr"

export class MockXhrServer {
  /**
   * Constructor
   *
   * @param xhrMock XMLHttpRequest mock class
   * @param routes routes
   */
  constructor(xhrMock: MockXhr, routes?: object);

  /**
   * Install the server's XMLHttpRequest mock in the context. Revert with remove().
   *
   * @param context context object (e.g. global, window)
   * @returns this
   */
  install(context?: object): this;

  /**
   * Remove the server as the global XMLHttpRequest mock. Reverts the actions of install(global).
   */
  remove(): void;

  /**
   * Disable the effects of the timeout attribute on the XMLHttpRequest mock used by the server.
   */
  disableTimeout(): void;

  /**
   * Enable the effects of the timeout attribute on the XMLHttpRequest mock used by the server.
   */
  enableTimeout(): void;

  /**
   * Add a GET request handler.
   *
   * @param matcher url matcher
   * @param handler request handler
   * @returns this
   */
  get(
    matcher: MockXhrServer.UrlMatcher,
    handler: MockXhrServer.RequestHandler
  ): this;

  /**
   * Add a POST request handler.
   *
   * @param matcher url matcher
   * @param handler request handler
   * @returns this
   */
  post(
    matcher: MockXhrServer.UrlMatcher,
    handler: MockXhrServer.RequestHandler
  ): this;

  /**
   * Add a PUT request handler.
   *
   * @param matcher url matcher
   * @param handler request handler
   * @returns this
   */
  put(
    matcher: MockXhrServer.UrlMatcher,
    handler: MockXhrServer.RequestHandler
  ): this;

  /**
   * Add a DELETE request handler.
   *
   * @param matcher url matcher
   * @param handler request handler
   * @returns this
   */
  delete(
    matcher: MockXhrServer.UrlMatcher,
    handler: MockXhrServer.RequestHandler
  ): this;

  /**
   * Add a request handler.
   *
   * @param method HTTP method
   * @param matcher url matcher
   * @param handler request handler
   * @returns this
   */
  addHandler(
    method: string,
    matcher: MockXhrServer.UrlMatcher,
    handler: MockXhrServer.RequestHandler
  ): this;

  /**
   * Set the default request handler for requests that don't match any route.
   *
   * @param handler request handler
   * @returns this
   */
  setDefaultHandler(handler: MockXhrServer.RequestHandler): this;

  /**
   * Return 404 responses for requests that don't match any route.
   *
   * @returns this
   */
  setDefault404(): this;

  /**
   * @returns list of requests received by the server. Entries: { method, url }
   */
  getRequestLog(): MockXhrServer.RequestLog;
}

export namespace MockXhrServer {
  type UrlMatcher =
    ((url: string) => boolean)
    | string
    | RegExp

  interface RequestHandlerResponse {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
  }

  type RequestHandlerCallback = (xhr: MockXhr) => void;

  type RequestHandler =
    Partial<RequestHandlerResponse>
    | RequestHandlerCallback
    | (Partial<RequestHandlerResponse> | RequestHandlerCallback)[]

  interface RequestLogEntry {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: any
  }

  type RequestLog = ReadonlyArray<RequestLogEntry>
}

export default MockXhrServer
