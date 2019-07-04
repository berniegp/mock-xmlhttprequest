import './MockXhr';
import './MockXhrServer';

/**
 * Create a new "local" MockXhr subclass. This makes it easier to have self-contained unit tests
 * since "global" hooks can be registered directly on the subclass. These hooks don't need to then
 * be removed after tests because they are local to the new subclass.
 *
 * @returns new MockXhr subclass
 */
export function newMockXhr(): MockXhr;

/**
 * Create a new mock server using MockXhr.
 *
 * @returns new mock server
 */
export function newServer(routes: any): MockXhrServer;
