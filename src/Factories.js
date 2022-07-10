import MockXhr from './MockXhr';
import MockXhrServer from './MockXhrServer';

import type { OnCreateCallback, OnSendCallback } from './MockXhr';
import type { UrlMatcher, RequestHandler } from './MockXhrServer';

/**
 * Create a new "local" MockXhr subclass. This makes it easier to have self-contained unit tests
 * since "global" hooks can be registered directly on the subclass. These hooks don't need to then
 * be removed after tests because they are local to the new subclass.
 *
 * @returns new MockXhr subclass
 */
export function newMockXhr(): typeof MockXhr {
  return class LocalMockXhr extends MockXhr {
    // Reset to default value to override the parent class' flag
    static timeoutEnabled = true;

    static onCreate?: OnCreateCallback;

    static onSend?: OnSendCallback;

    constructor() {
      super();

      // Call the local MockXhr subclass' onCreate hook on the new mock instance
      LocalMockXhr.onCreate?.(this);
    }

    send(body: any) {
      super.send(body);

      // Call the local MockXhr subclass' onSend hook
      this._callOnSend(LocalMockXhr.onSend);
    }
  };
}

/**
 * Create a new mock server using MockXhr.
 *
 * @param routes routes
 * @returns new mock server
 */
export function newServer(routes?: Record<string, [UrlMatcher, RequestHandler]>) {
  return new MockXhrServer(newMockXhr(), routes);
}
