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
  install(context: object): MockXhrServer;

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
    matcher: string | RegExp | Function,
    handler: object | Function | object[] | Function[],
  ): MockXhrServer;

  /**
   * Add a POST request handler.
   *
   * @param matcher url matcher
   * @param handler request handler
   * @returns this
   */
  post(
    matcher: string | RegExp | Function,
    handler: object | Function | object[] | Function[],
  ): MockXhrServer;

  /**
   * Add a PUT request handler.
   *
   * @param matcher url matcher
   * @param handler request handler
   * @returns this
   */
  put(
    matcher: string | RegExp | Function,
    handler: object | Function | object[] | Function[],
  ): MockXhrServer;

  /**
   * Add a DELETE request handler.
   *
   * @param matcher url matcher
   * @param handler request handler
   * @returns this
   */
  delete(
    matcher: string | RegExp | Function,
    handler: object | Function | object[] | Function[],
  ): MockXhrServer;

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
    matcher: string | RegExp | Function,
    handler: object | Function | object[] | Function[],
  ): MockXhrServer;

  /**
   * Set the default request handler for requests that don't match any route.
   *
   * @param {object|Function|object[]|Function[]} handler request handler
   * @returns this
   */
  setDefaultHandler(handler: object | Function | object[] | Function[]): MockXhrServer;

  /**
   * Return 404 responses for requests that don't match any route.
   *
   * @returns this
   */
  setDefault404(): MockXhrServer;

  /**
   * @returns list of requests received by the server. Entries: { method, url }
   */
  getRequestLog(): object[];
}
