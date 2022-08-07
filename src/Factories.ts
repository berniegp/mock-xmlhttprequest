import MockXhr from './MockXhr';
import MockXhrServer from './MockXhrServer';

import type { OnCreateCallback, OnSendCallback } from './MockXhr';
import type { UrlMatcher, RequestHandler } from './MockXhrServer';

/**
 * Create a new "local" MockXhr subclass. Using a subclass of `MockXhr` in each test case makes it
 * easier to ensure they are self-contained. For example if you set the onSend static propertiy on
 * a subclass, this will only affect that subclass and not the others created in your other test
 * cases. You therefore don't need to add cleanup code to revert the changes made to the subclass.
 *
 * @returns New MockXhr subclass
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
 * @param routes Routes
 * @returns new MockXhrServerserver with its own MockXhr subclass.
 */
export function newServer(routes?: Record<string, [UrlMatcher, RequestHandler]>) {
  return new MockXhrServer(newMockXhr(), routes);
}
