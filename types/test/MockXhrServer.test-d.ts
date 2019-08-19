import { expectError, expectType } from 'tsd'
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
