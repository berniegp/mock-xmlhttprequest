import MockXhr from './MockXhr';
import MockXhrServer from './MockXhrServer';

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
    // Reset to default values
    static timeoutEnabled = true;

    static onCreate?: (xhr: MockXhr) => void = undefined;

    static onSend?: (this: MockXhr, xhr: MockXhr) => void = undefined;
  };
}

/**
 * Create a new mock server using MockXhr.
 *
 * @returns new mock server
 */
export function newServer(routes?: Record<string, [UrlMatcher, RequestHandler]>) {
  return new MockXhrServer(newMockXhr(), routes);
}
