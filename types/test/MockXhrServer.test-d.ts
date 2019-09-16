import { expectError, expectType } from 'tsd'

import { newServer } from '../'
import MockXhr from '../MockXhr'
import MockXhrServer from '../MockXhrServer'

expectType<MockXhrServer.UrlMatcher>('http://foo/bar.com');
expectType<MockXhrServer.UrlMatcher>(/http:/);
expectType<MockXhrServer.UrlMatcher>((url: string) => url === 'http://foo/bar.com');
expectError<MockXhrServer.UrlMatcher>((url: string) => url);
expectError<MockXhrServer.UrlMatcher>(true);

const requestHandlerResponse = {
    status: 501,
    statusText: 'Fail',
    headers: { 'X-Test': 'true' },
    body: 'Failed',
};
const requestHandlerCallback = (xhr: MockXhr) => { xhr.respond(); };
expectType<MockXhrServer.RequestHandler>({});
expectType<MockXhrServer.RequestHandler>(requestHandlerResponse);
expectType<MockXhrServer.RequestHandler>(requestHandlerCallback);
expectType<MockXhrServer.RequestHandler>([requestHandlerResponse, requestHandlerCallback]);
expectError<MockXhrServer.RequestHandler>(true);

function quickStartCode() {
  // Install the server's XMLHttpRequest mock in the "global" context.
  // "new XMLHttpRequest()" will then create a mock request to which the server will reply.
  const server = newServer({
    get: ['/my/url', {
      // status: 200 is the default
      headers: { 'Content-Type': 'application/json' },
      body: '{ "message": "Success!" }',
    }],
  }).install( /* optional context; defaults to global */ );

  // Do something that send()s an XMLHttpRequest to '/my/url'
  // const result = MyModuleUsingXhr.someAjaxMethod();

  // Assuming someAjaxMethod() returns the parsed JSON body
  // assert.equal(result.message, 'Success!');

  // Restore the original XMLHttpRequest from the context given to install()
  server.remove();
}
quickStartCode();

function disableTimeout() {
  const server = newServer();
  server.disableTimeout();
}
disableTimeout();
